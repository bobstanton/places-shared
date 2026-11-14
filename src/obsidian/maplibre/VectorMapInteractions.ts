import { MapPlace } from "../../overlay/index";
import { getPlaceId } from "../../track/index";
import { PlacesBoundingBox } from "../../geo/index";
import { MapControlHandle } from "../../services/index";
import type * as maplibregl from "maplibre-gl";

type VectorPaintValue = string | number | boolean | maplibregl.ExpressionSpecification;

export interface VectorFocusMap {
  getLayer?(id: string): unknown;
  setPaintProperty?(layerId: string, property: string, value: VectorPaintValue): void;
  once?(event: 'moveend', listener: () => void): unknown;
}

export interface VectorControlMap {
  getBounds: () => { getSouth: () => number; getWest: () => number; getNorth: () => number; getEast: () => number } | null | undefined;
  getZoom: () => number;
  jumpTo: (options: { center: [number, number]; zoom: number }) => unknown;
}

export interface MissingSpriteImageMap {
  addImage: (id: string, image: ImageData) => unknown;
}

const LABEL_LAYER_ID = 'places-markers';
const LABEL_OPACITY_PROPERTY = 'text-opacity';
const ICON_OPACITY_PROPERTY = 'icon-opacity';
const FOCUSED_MARKER_CLASS = 'places-marker-focused';

export const SYMBOL_MARKER_LAYER_ID = 'places-symbol-markers';
export const SYMBOL_BENEATH_LAYER_ID = 'places-symbol-markers-beneath';
export const SYMBOL_MARKER_LAYER_IDS: readonly string[] = [SYMBOL_MARKER_LAYER_ID, SYMBOL_BENEATH_LAYER_ID];

export const SYMBOL_ICON_BASE_OPACITY: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'iconOpacity'], 1];

function setLabelOpacity(map: VectorFocusMap | undefined, opacity: VectorPaintValue): void {
  if (map?.getLayer?.(LABEL_LAYER_ID)) {
    map.setPaintProperty?.(LABEL_LAYER_ID, LABEL_OPACITY_PROPERTY, opacity);
  }
}

const LABEL_BASE_OPACITY: VectorPaintValue = ['case', ['has', 'labelOpacity'], ['get', 'labelOpacity'], 1];

export const VECTOR_FOCUS_DIM_OPACITY = 0.2;

function setSymbolIconOpacity(map: VectorFocusMap | undefined, opacity: VectorPaintValue): void {
  for (const layerId of SYMBOL_MARKER_LAYER_IDS) {
    if (map?.getLayer?.(layerId)) map.setPaintProperty?.(layerId, ICON_OPACITY_PROPERTY, opacity);
  }
}

export function restoreVectorLabelOpacity(map: VectorFocusMap | undefined): void {
  setLabelOpacity(map, LABEL_BASE_OPACITY);
  setSymbolIconOpacity(map, SYMBOL_ICON_BASE_OPACITY);
}

export function dimVectorLabels(map: VectorFocusMap | undefined, focusedPlaceId?: string): void {
  setLabelOpacity(map, focusedPlaceId !== undefined
    ? ['case', ['==', ['get', 'placeId'], focusedPlaceId], LABEL_BASE_OPACITY, VECTOR_FOCUS_DIM_OPACITY]
    : VECTOR_FOCUS_DIM_OPACITY);
  setSymbolIconOpacity(map, focusedPlaceId !== undefined
    ? ['case', ['==', ['get', 'placeId'], focusedPlaceId], SYMBOL_ICON_BASE_OPACITY, VECTOR_FOCUS_DIM_OPACITY]
    : VECTOR_FOCUS_DIM_OPACITY);
}

export function focusMapMarkerElement(container: HTMLElement, place: MapPlace, map?: VectorFocusMap): void {
  const placeId = getPlaceId(place);
  const applyFocusedClass = () => {
    container.querySelectorAll(`.${FOCUSED_MARKER_CLASS}`).forEach((el) => el.removeClass(FOCUSED_MARKER_CLASS));
    const target = container.querySelector<HTMLElement>(`.places-marker[data-place-id="${CSS.escape(placeId)}"]`);

    target?.addClass(FOCUSED_MARKER_CLASS);
  };

  applyFocusedClass();
  map?.once?.('moveend', () => {
    const ownerWindow = container.ownerDocument.defaultView;

    if (!ownerWindow) {
      applyFocusedClass();

      return;
    }

    window.requestAnimationFrame(() => window.requestAnimationFrame(applyFocusedClass));
  });
}

export function enterVectorFocusMode(container: HTMLElement, map?: VectorFocusMap, focusedPlaceId?: string): void {
  container.addClass('places-focus-mode');
  dimVectorLabels(map, focusedPlaceId);
}

export function clearVectorFocusMode(container: HTMLElement, map?: VectorFocusMap): void {
  container.removeClass('places-focus-mode');
  container.querySelectorAll(`.${FOCUSED_MARKER_CLASS}`).forEach((el) => el.removeClass(FOCUSED_MARKER_CLASS));
  restoreVectorLabelOpacity(map);
}

export function addTransparentMissingSpriteImage(map: MissingSpriteImageMap, id: string): void {
  const canvas = createEl('canvas');

  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');

  if (!ctx) return;

  ctx.clearRect(0, 0, 1, 1);
  map.addImage(id, ctx.getImageData(0, 0, 1, 1));
}

export function shouldSkipPlacePopup(place: MapPlace): boolean {
  return Boolean(
    place.metadata?.boundsAnchor ||
      place.metadata?.frequency !== undefined ||
      (!place.name && !place.icon && !place.filePath && !place.overlay),
  );
}

export interface CreateVectorMapControlHandleOptions<TMap extends VectorControlMap> {
  container: HTMLElement;
  map: TMap;
  highlightPlace: (place: MapPlace) => void;
  clearHighlight: () => void;
  setGeocodingSearchMarkers: (places: MapPlace[]) => void;
}

export function createVectorMapControlHandle<TMap extends VectorControlMap>(options: CreateVectorMapControlHandleOptions<TMap>): MapControlHandle {
  const { map, highlightPlace, clearHighlight, setGeocodingSearchMarkers } = options;

  return {
    getBounds: () => {
      const bounds = map.getBounds();

      if (!bounds) return new PlacesBoundingBox();

      return new PlacesBoundingBox(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast());
    },
    centerOnPlace: (place: MapPlace) => {
      map.jumpTo({
        center: [place.longitude, place.latitude],
        zoom: Math.max(map.getZoom(), 14),
      });
    },
    highlightPlace,
    clearHighlight,
    setGeocodingSearchMarkers,
  };
}
