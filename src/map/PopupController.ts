import type { App } from "obsidian";
import type * as GeoJSON from "geojson";
import type { MapPlace } from "../Place";
import { buildOverlayPointPopupContent, buildPopupContent, createSourceLinkClickHandler } from "./PopupBuilder";
import { renderPopupContent, type RenderedPopupContent } from "./PopupContentRenderer";
import { copyToClipboard } from "../utils/FileUtils";
import { formatDisplayCoordinate } from "../utils/Utilities";
import { DEFAULT_MARKER_ICON } from "./MarkerIcon";
import type { PlaceNoteHost, PoiPlaceNoteRequest } from "./PlaceNoteRequest";
import { queryPoiGeometry } from "./VectorFeatureHelpers";

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

type TrackablePopup = Pick<PopupLike<unknown, unknown>, 'remove' | 'getElement'>;

const openPopups = new Set<TrackablePopup>();

function trackPopup<T extends TrackablePopup>(popup: T): T {
  openPopups.add(popup);
  return popup;
}

function attachRenderedContentLifetime(popup: PopupLike<unknown, unknown>, rendered: RenderedPopupContent | null): void {
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

export async function createPlacePopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(
  options: CreatePlacePopupOptions<TMap, TCoordinates, TPopup>,
): Promise<TPopup> {
  closeExistingPopups(options.popupSelector);

  // closePopup is captured while the content is built, which is necessarily before
  // the popup it closes exists. The ref cell carries that forward reference.
  const popupRef: { current?: TPopup } = {};
  const content = buildPopupContent({
    icon: options.place.icon,
    name: options.place.name,
    isLink: !!options.place.filePath,
    linkPath: options.place.filePath,
    subtitle: options.place.subtitle,
    onLinkClick: options.place.filePath
      ? (linkPath) => void options.app.workspace.openLinkText(linkPath, '')
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

  const rendered = await renderPopupContent(options.app, options.place, content);

  const popup = trackPopup(options.createPopup()
    .setLngLat(options.coordinates)
    .setDOMContent(content)
    .addTo(options.map));
  popupRef.current = popup;
  attachRenderedContentLifetime(popup, rendered);
  return popup;
}

export function createPlaceSummaryPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(
  options: CreatePlaceSummaryPopupOptions<TMap, TCoordinates, TPopup>,
): TPopup {
  // closePopup is captured before the popup it closes exists.
  const popupRef: { current?: TPopup } = {};
  const content = buildPopupContent({
    icon: options.place.icon,
    name: options.place.name,
    isLink: !!options.place.filePath,
    linkPath: options.place.filePath,
    subtitle: options.place.subtitle,
    onLinkClick: options.place.filePath
      ? (linkPath) => void options.app.workspace.openLinkText(linkPath, '')
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

export function createContentPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(
  options: CreateContentPopupOptions<TMap, TCoordinates, TPopup>,
): TPopup {
  closeExistingPopups(options.popupSelector);

  return trackPopup(options.createPopup()
    .setLngLat(options.coordinates)
    .setDOMContent(options.content)
    .addTo(options.map));
}

export function createOverlayPointPopup<TMap, TPopup extends PopupLike<TMap, [number, number]>>(
  options: CreateOverlayPointPopupOptions<TMap, TPopup>,
): TPopup {
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
      (linkPath) => void options.app.workspace.openLinkText(linkPath, ''),
    ),
  });

  return trackPopup(options.createPopup()
    .setLngLat(coordinates)
    .setDOMContent(content)
    .addTo(options.map));
}

export function buildPoiDiscoveryPopupContent<TMap>(options: BuildPoiDiscoveryPopupContentOptions<TMap>): HTMLElement {
  const { poi, placeNoteHost } = options;
  const request: PoiPlaceNoteRequest = {
    kind: 'poi',
    name: poi.name,
    class: poi.class,
    subclass: poi.subclass || undefined,
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
  };
  // The icon the created note would get.
  const icon = placeNoteHost?.resolveIcon(request) ?? DEFAULT_MARKER_ICON;
  const coordString = formatDisplayCoordinate({ latitude: poi.coordinates.lat, longitude: poi.coordinates.lng });
  const closePopups = options.closePopups ?? (() => closeExistingPopups(options.popupSelector ?? GL_POPUP_SELECTOR));

  return buildPopupContent({
    icon,
    name: poi.name,
    isLink: false,
    closePopup: closePopups,
    actions: [
      ...(placeNoteHost ? [{
        text: options.createNoteText ?? '📝 Create Note',
        onClick: () => {
          const geometry = queryPoiGeometry({
            map: options.map as never,
            name: poi.name,
            layer: poi.layer,
            ...options.geometryQuery,
          });
          void placeNoteHost.createNote({ ...request, geometry });
        },
      }] : []),
      {
        text: `📋 ${coordString}`,
        onClick: () => {
          void copyToClipboard(coordString, `${options.copyTextPrefix ?? 'Copied'}: ${coordString}`);
        },
      },
    ],
  });
}
