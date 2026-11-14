import type * as maplibregl from 'maplibre-gl';
import { logger as rootLogger } from "../../utils/index";
import { DEFAULT_TERRAIN_EXAGGERATION, TERRAIN_SOURCE_ID, exaggerationAtZoom, rasterDemSource, type TerrainDemSpec, type TerrainExaggeration } from "../../map/index";

const logger = rootLogger.scope('Terrain');

function toRasterDemSpec(spec: TerrainDemSpec): maplibregl.RasterDEMSourceSpecification {
  return rasterDemSource(spec);
}

export function applyTerrain(map: maplibregl.Map, dem: TerrainDemSpec, exaggeration: TerrainExaggeration = DEFAULT_TERRAIN_EXAGGERATION): void {
  try {
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, toRasterDemSpec(dem));
    }

    if (typeof exaggeration === 'number') {
      map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration });
    } else {
      applyZoomExaggeration(map, exaggeration);
    }

    trySetSky(map);
  } catch (error) {
    logger.warn('Failed to enable 3D terrain', { error });
  }
}

const EXAGGERATION_GESTURE_STEP = 0.05;

function applyZoomExaggeration(map: maplibregl.Map, stops: readonly import('../map/index').TerrainExaggerationStop[]): void {
  let lastApplied = NaN;
  const apply = (factor: number): void => {
    if (factor === lastApplied) return;
    lastApplied = factor;
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: factor });
  };
  const exactFactor = (): number => Number(exaggerationAtZoom(stops, map.getZoom()).toFixed(3));

  apply(exactFactor());
  map.on('zoom', () => {
    const factor = exactFactor();

    if (Number.isFinite(lastApplied) && Math.abs(factor - lastApplied) < EXAGGERATION_GESTURE_STEP) return;
    apply(factor);
  });
  map.on('zoomend', () => apply(exactFactor()));
}

function trySetSky(map: maplibregl.Map): void {
  const withSky = map as maplibregl.Map & { setSky?: (spec: unknown) => void };

  if (typeof withSky.setSky !== 'function') return;

  try {
    withSky.setSky({
      'sky-color': '#8ec5fc',
      'sky-horizon-blend': 0.5,
      'horizon-color': '#ffffff',
      'horizon-fog-blend': 0.5,
      'fog-color': '#dfe9f2',
      'fog-ground-blend': 0.5,
    });
  } catch {
    return;
  }
}
