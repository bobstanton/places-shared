import { DEFAULT_COLOR_RELIEF_STOPS, type ColorReliefStop, type TerrainDemSpec } from './TerrainDem';

export const TERRAIN_SOURCE_ID = 'places-terrain-dem';
export const HILLSHADE_SOURCE_ID = 'places-hillshade-dem';
export const HILLSHADE_LAYER_ID = 'places-hillshade';
export const COLOR_RELIEF_SOURCE_ID = 'places-colorrelief-dem';
export const COLOR_RELIEF_LAYER_ID = 'places-color-relief';

export interface RasterDemSourceSpec {
  readonly type: 'raster-dem';
  readonly tiles: string[];
  readonly encoding: 'terrarium' | 'mapbox';
  readonly tileSize: number;
  readonly maxzoom?: number;
  readonly attribution?: string;
}

export function rasterDemSource(spec: TerrainDemSpec): RasterDemSourceSpec {
  return {
    type: 'raster-dem',
    tiles: [...spec.tiles],
    encoding: spec.encoding,
    tileSize: spec.tileSize ?? 256,
    ...(spec.maxzoom !== undefined ? { maxzoom: spec.maxzoom } : {}),
    ...(spec.attribution ? { attribution: spec.attribution } : {}),
  };
}

export interface HillshadeOptions {
  intensity: number;
  method?: string;
  direction?: number;
  shadowColor?: string;
  highlightColor?: string;
  accentColor?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function hillshadePaint(options: HillshadeOptions): Record<string, unknown> {
  const paint: Record<string, unknown> = { 'hillshade-exaggeration': clamp01(options.intensity) };

  if (options.method) paint['hillshade-method'] = options.method;
  if (options.direction !== undefined) paint['hillshade-illumination-direction'] = options.direction;
  if (options.shadowColor) paint['hillshade-shadow-color'] = options.shadowColor;
  if (options.highlightColor) paint['hillshade-highlight-color'] = options.highlightColor;
  if (options.accentColor) paint['hillshade-accent-color'] = options.accentColor;

  return paint;
}

export function colorReliefRamp(stops: readonly ColorReliefStop[]): unknown[] {
  return ['interpolate', ['linear'], ['elevation'], ...stops.flatMap(stop => [stop.elevation, stop.color])];
}

export function colorReliefPaint(opacity: number, stops?: readonly ColorReliefStop[]): Record<string, unknown> {
  return {
    'color-relief-color': colorReliefRamp(stops ?? DEFAULT_COLOR_RELIEF_STOPS),
    'color-relief-opacity': clamp01(opacity),
  };
}

export function reliefInsertBeforeId(layers: readonly { id: string; type?: string }[]): string | undefined {
  return layers.find(layer => layer.type === 'line' || layer.type === 'symbol')?.id;
}
