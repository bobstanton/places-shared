import type * as maplibregl from 'maplibre-gl';
import type { MapRuntimeContext } from "../settings/index";
export declare function recordOverlayVisibility(options: {
    map: maplibregl.Map;
    runtime: MapRuntimeContext;
    setLayerVisibility: (layerIds: string[], visibility: 'visible' | 'none') => void;
}): void;
