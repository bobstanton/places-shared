import type * as maplibregl from 'maplibre-gl';
import type { OverlayRenderBand } from "../overlay/index";
export declare const PLACES_APPLICATION_LAYER_ANCHOR_ID = "places-application-layer-anchor";
export declare function ensureApplicationLayerAnchor(map: maplibregl.Map): void;
export declare function getRenderBandBeforeId(map: maplibregl.Map, renderBand: OverlayRenderBand): string | undefined;
export declare function promotePointIconLayers(map: maplibregl.Map, layerIds: readonly string[]): void;
export declare function lowestLayerId(map: maplibregl.Map, layerIds: readonly string[]): string | undefined;
