import type * as maplibregl from 'maplibre-gl';
import { addSharedDebugOverlay, createVectorDebugOverlayAdapter, type DebugData, type DebugOverlayInput } from "../map/index";

export type { DebugData, DebugOverlayInput };

export function addDebugOverlay(map: maplibregl.Map, container: HTMLElement, input: DebugOverlayInput): DebugData {
  return addSharedDebugOverlay(container, input, createVectorDebugOverlayAdapter(map, { includeClickFeatures: true }));
}
