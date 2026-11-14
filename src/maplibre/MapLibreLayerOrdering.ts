import type * as maplibregl from 'maplibre-gl';
import type { OverlayRenderBand } from "../overlay/index";

export const PLACES_APPLICATION_LAYER_ANCHOR_ID = 'places-application-layer-anchor';

export function ensureApplicationLayerAnchor(map: maplibregl.Map): void {
  if (map.getLayer(PLACES_APPLICATION_LAYER_ANCHOR_ID)) return;
  map.addLayer({
    id: PLACES_APPLICATION_LAYER_ANCHOR_ID,
    type: 'background',
    paint: { 'background-opacity': 0 },
  });
}

export function getRenderBandBeforeId(map: maplibregl.Map, renderBand: OverlayRenderBand): string | undefined {
  if (renderBand !== 'background') return undefined;
  ensureApplicationLayerAnchor(map);

  return PLACES_APPLICATION_LAYER_ANCHOR_ID;
}

export function promotePointIconLayers(map: maplibregl.Map, layerIds: readonly string[]): void {
  for (const layerId of new Set(layerIds)) {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  }
}

export function lowestLayerId(map: maplibregl.Map, layerIds: readonly string[]): string | undefined {
  const present = new Set(layerIds.filter(layerId => map.getLayer(layerId)));

  return map.getStyle().layers.find(layer => present.has(layer.id))?.id;
}
