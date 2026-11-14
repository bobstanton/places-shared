import type * as maplibregl from 'maplibre-gl';
import { logger as rootLogger } from "../utils/index";
import { COLOR_RELIEF_LAYER_ID, COLOR_RELIEF_SOURCE_ID, HILLSHADE_LAYER_ID, HILLSHADE_SOURCE_ID, colorReliefPaint, hillshadePaint, rasterDemSource, reliefInsertBeforeId as reliefInsertBefore, type HillshadeOptions, type TerrainDemSpec, type ColorReliefStop } from "../map/index";

const logger = rootLogger.scope('Relief');

function toRasterDemSpec(spec: TerrainDemSpec): maplibregl.RasterDEMSourceSpecification {
  return rasterDemSource(spec);
}

function reliefInsertBeforeId(map: maplibregl.Map): string | undefined {
  return reliefInsertBefore(map.getStyle()?.layers ?? []);
}

export type { HillshadeOptions };

export function applyHillshade(map: maplibregl.Map, dem: TerrainDemSpec, options: HillshadeOptions): void {
  try {
    if (!map.getSource(HILLSHADE_SOURCE_ID)) map.addSource(HILLSHADE_SOURCE_ID, toRasterDemSpec(dem));
    if (map.getLayer(HILLSHADE_LAYER_ID)) return;
    map.addLayer({
      id: HILLSHADE_LAYER_ID,
      type: 'hillshade',
      source: HILLSHADE_SOURCE_ID,
      paint: hillshadePaint(options),
    }, reliefInsertBeforeId(map));
  } catch (error) {
    logger.warn('Failed to enable hillshade', { error });
  }
}

export function applyColorRelief(map: maplibregl.Map, dem: TerrainDemSpec, opacity: number, stops?: readonly ColorReliefStop[]): void {
  try {
    if (!map.getSource(COLOR_RELIEF_SOURCE_ID)) map.addSource(COLOR_RELIEF_SOURCE_ID, toRasterDemSpec(dem));
    if (map.getLayer(COLOR_RELIEF_LAYER_ID)) return;
    map.addLayer({
      id: COLOR_RELIEF_LAYER_ID,
      type: 'color-relief',
      source: COLOR_RELIEF_SOURCE_ID,
      paint: colorReliefPaint(opacity, stops),
    }, reliefInsertBeforeId(map));
  } catch (error) {
    logger.warn('Failed to enable color relief', { error });
  }
}
