import { ownPopupContent } from './PopupContentRenderer';
import type { App } from "obsidian";
import type * as GeoJSON from "geojson";
import type { MapPlace } from "../../place/index";
import { buildOverlayPointPopupContent, buildPoiPopupContent, buildPopupContent, createSourceLinkClickHandler, poiPlaceNoteRequest } from "../../map/index";
import { hostPrimitives } from "../../services/index";
import type { RenderedNoteContent } from "../../map/index";
import { copyToClipboard } from "../utils/FileUtils";
import { DEFAULT_MARKER_ICON } from "../../map/index";
import type { PlaceNoteHost } from "../../map/index";
import { queryPoiGeometry } from "./VectorFeatureHelpers";
import { openLocalFile } from '../utils/LocalFile';

export interface PopupLike<TMap, TCoordinates> {
  setLngLat(coordinates: TCoordinates): this;
  setDOMContent(content: Node): this;
  addTo(map: TMap): this;
  remove(): void;
  getElement(): HTMLElement | null | undefined;
  on?(type: 'close', listener: () => void): unknown;
}

export interface CreatePlacePopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
  app: App;
  map: TMap;
  place: MapPlace;
  coordinates: TCoordinates;
  popupSelector: string;
  createPopup: () => TPopup;
  onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void;
}

export interface CreatePlaceSummaryPopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
  onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void;
  app: App;
  map: TMap;
  place: MapPlace;
  coordinates: TCoordinates;
  popupSelector: string;
  createPopup: () => TPopup;
}

export interface CreateContentPopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
  map: TMap;
  coordinates: TCoordinates;
  content: Node;
  popupSelector: string;
  createPopup: () => TPopup;
}

export interface CreateOverlayPointPopupOptions<TMap, TPopup extends PopupLike<TMap, [number, number]>> {
  app: App;
  map: TMap;
  feature: GeoJSON.Feature;
  popupSelector?: string;
  createPopup: () => TPopup;
}

export interface PoiDiscoveryPopupInfo {
  name: string;
  class: string;
  subclass: string;
  coordinates: { lat: number; lng: number };
  layer: string;
}

export interface BuildPoiDiscoveryPopupContentOptions<TMap> {
  map: TMap;
  poi: PoiDiscoveryPopupInfo;
  sourcePath?: string;
  placeNoteHost?: PlaceNoteHost;
  createNoteText?: string;
  copyTextPrefix?: string;
  popupSelector?: string;
  closePopups?: () => void;
  geometryQuery?: Pick<Parameters<typeof queryPoiGeometry>[0], 'nameProperties' | 'queryLayerDirectly'>;
}

export interface StandardPlacePopupOptions {
  [key: string]: unknown;
  offset: number | [number, number];
  className: string;
  closeOnClick: boolean;
  closeOnMove: boolean;
  focusAfterOpen: boolean;
}

export function createStandardPlacePopupOptions(overrides: Partial<StandardPlacePopupOptions> = {}): StandardPlacePopupOptions {
  return {
    offset: [0, -15],
    className: 'places-popup',
    closeOnClick: true,
    closeOnMove: false,
    focusAfterOpen: false,
    ...overrides,
  };
}

export const GL_POPUP_SELECTOR = '.maplibregl-popup, .mapboxgl-popup';

type TrackablePopup = Pick<PopupLike<unknown, unknown>, 'remove' | 'getElement' | 'on'>;

const openPopups = new Set<TrackablePopup>();

function trackPopup<T extends TrackablePopup>(popup: T): T {
  openPopups.add(popup);
  popup.on?.('close', () => openPopups.delete(popup));

  return popup;
}

function attachRenderedContentLifetime(popup: PopupLike<unknown, unknown>, rendered: RenderedNoteContent | null): void {
  if (!rendered) return;

  if (popup.on) {
    popup.on('close', () => rendered.dispose());

    return;
  }

  const element = popup.getElement();

  if (!element) {
    rendered.dispose();

    return;
  }

  let wasConnected = element.isConnected;
  const Observer = (element.ownerDocument.defaultView)?.MutationObserver ?? MutationObserver;
  const observer = new Observer(() => {
    wasConnected ||= element.isConnected;

    if (wasConnected && !element.isConnected) {
      observer.disconnect();
      rendered.dispose();
    }
  });

  observer.observe(element.parentNode ?? activeDocument, { childList: true, subtree: true });
}

export function closeExistingPopups(selector: string): void {
  for (const popup of [...openPopups]) {
    const element = popup.getElement();

    if (!element || !element.isConnected) {
      openPopups.delete(popup); // already closed by the engine (e.g. closeOnClick)
    } else if (element.ownerDocument === activeDocument && (element.matches(selector) || element.closest(selector))) {
      // Only popups in the active window's document close.
      popup.remove();
      openPopups.delete(popup);
    }
  }
}

export async function createPlacePopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreatePlacePopupOptions<TMap, TCoordinates, TPopup>): Promise<TPopup> {
  closeExistingPopups(options.popupSelector);

  const popupRef: { current?: TPopup } = {};
  const content = buildPopupContent({
    icon: options.place.icon,
    name: options.place.name,
    isLink: !!options.place.filePath,
    linkPath: options.place.filePath,
    subtitle: options.place.subtitle,
    onLinkClick: options.place.filePath
      ? (linkPath) => openLocalFile(options.app, linkPath)
      : undefined,
    placeActions: options.place.actions,
    onPlaceAction: options.onPlaceAction ? (actionId, state) => options.onPlaceAction!(options.place, actionId, state) : undefined,
    closePopup: () => {
      if (popupRef.current) {
        popupRef.current.remove();
        openPopups.delete(popupRef.current);
      }
    },
  });

  const rendered = await hostPrimitives().renderNoteContent(options.place, content);

  const popup = trackPopup(options.createPopup()
    .setLngLat(options.coordinates)
    .setDOMContent(content)
    .addTo(options.map));

  popupRef.current = popup;
  attachRenderedContentLifetime(popup, rendered);

  return popup;
}

export function createPlaceSummaryPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreatePlaceSummaryPopupOptions<TMap, TCoordinates, TPopup>): TPopup {
  const popupRef: { current?: TPopup } = {};
  const content = buildPopupContent({
    icon: options.place.icon,
    name: options.place.name,
    isLink: !!options.place.filePath,
    linkPath: options.place.filePath,
    subtitle: options.place.subtitle,
    onLinkClick: options.place.filePath
      ? (linkPath) => openLocalFile(options.app, linkPath)
      : undefined,
    placeActions: options.place.actions,
    onPlaceAction: options.onPlaceAction ? (actionId, state) => options.onPlaceAction!(options.place, actionId, state) : undefined,
    closePopup: () => {
      if (popupRef.current) {
        popupRef.current.remove();
        openPopups.delete(popupRef.current);
      }
    },
  });

  const popup = createContentPopup({
    map: options.map,
    coordinates: options.coordinates,
    content,
    popupSelector: options.popupSelector,
    createPopup: options.createPopup,
  });

  popupRef.current = popup;

  return popup;
}

export function createContentPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreateContentPopupOptions<TMap, TCoordinates, TPopup>): TPopup {
  closeExistingPopups(options.popupSelector);

  const popup = trackPopup(options.createPopup()
    .setLngLat(options.coordinates)
    .setDOMContent(options.content)
    .addTo(options.map));

  if (popup.on) ownPopupContent(options.content, dispose => popup.on!('close', dispose));

  return popup;
}

export function createOverlayPointPopup<TMap, TPopup extends PopupLike<TMap, [number, number]>>(options: CreateOverlayPointPopupOptions<TMap, TPopup>): TPopup {
  if (options.popupSelector) {
    closeExistingPopups(options.popupSelector);
  }

  const properties = options.feature.properties || {};
  const coordinates = (options.feature.geometry as GeoJSON.Point).coordinates as [number, number];
  const sourcePath = properties._overlaySource as string | undefined;
  const content = buildOverlayPointPopupContent({
    properties,
    sourcePath,
    defaultName: 'Point',
    onSourceLinkClick: createSourceLinkClickHandler(
      sourcePath,
      (linkPath) => openLocalFile(options.app, linkPath),
    ),
  });

  return trackPopup(options.createPopup()
    .setLngLat(coordinates)
    .setDOMContent(content)
    .addTo(options.map));
}

export function buildPoiDiscoveryPopupContent<TMap>(options: BuildPoiDiscoveryPopupContentOptions<TMap>): HTMLElement {
  const { poi, placeNoteHost } = options;
  const discovered = {
    name: poi.name,
    class: poi.class,
    subclass: poi.subclass || undefined,
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    layer: poi.layer,
  };
  const closePopups = options.closePopups ?? (() => closeExistingPopups(options.popupSelector ?? GL_POPUP_SELECTOR));

  return buildPoiPopupContent({
    poi: discovered,
    icon: placeNoteHost?.resolveIcon({ ...poiPlaceNoteRequest(discovered), sourcePath: options.sourcePath }) ?? DEFAULT_MARKER_ICON,
    createNoteText: options.createNoteText,
    copyTextPrefix: options.copyTextPrefix,
    closePopup: closePopups,
    onCreateNote: placeNoteHost
      ? () => {
          const geometry = queryPoiGeometry({
            map: options.map as never,
            name: poi.name,
            layer: poi.layer,
            ...options.geometryQuery,
          });

          void placeNoteHost.createNote({ ...poiPlaceNoteRequest(discovered, geometry), sourcePath: options.sourcePath });
        }
      : undefined,
    onCopy: (text, message) => void copyToClipboard(text, message),
  });
}
