import { parseZoomScaledNumber } from '../utils/ZoomScaledNumber';

export interface TerrainDemSpec {
  readonly tiles: readonly string[];
  // DEM pixel encoding. `terrarium` = AWS; `mapbox` = Terrain-RGB.
  readonly encoding: 'terrarium' | 'mapbox';
  readonly tileSize?: number;
  readonly maxzoom?: number;
  readonly attribution?: string;
}

export const DEFAULT_TERRAIN_EXAGGERATION = 1.4;
export const DEFAULT_HILLSHADE_INTENSITY = 0.5;
export const DEFAULT_COLOR_RELIEF_OPACITY = 0.4;

export const HILLSHADE_METHODS = ['standard', 'basic', 'combined', 'igor', 'multidirectional'] as const;

export type HillshadeMethod = typeof HILLSHADE_METHODS[number];

export interface ColorReliefStop {
  readonly elevation: number;
  readonly color: string;
}

export const DEFAULT_COLOR_RELIEF_STOPS: readonly ColorReliefStop[] = [
  { elevation: 0, color: '#8fae86' },
  { elevation: 400, color: '#c8c079' },
  { elevation: 1000, color: '#b0885a' },
  { elevation: 2000, color: '#8a5a3a' },
  { elevation: 3000, color: '#7c6f63' },
  { elevation: 4500, color: '#ffffff' },
];

export const COLOR_RELIEF_PRESETS: Record<string, readonly ColorReliefStop[]> = {
  hypsometric: DEFAULT_COLOR_RELIEF_STOPS,
  viridis: [
    { elevation: 0, color: '#440154' },
    { elevation: 900, color: '#414487' },
    { elevation: 1800, color: '#2a788e' },
    { elevation: 2700, color: '#22a884' },
    { elevation: 3600, color: '#7ad151' },
    { elevation: 4500, color: '#fde725' },
  ],
  spectral: [
    { elevation: 0, color: '#3288bd' },
    { elevation: 900, color: '#99d594' },
    { elevation: 1800, color: '#e6f598' },
    { elevation: 2700, color: '#fee08b' },
    { elevation: 3600, color: '#fc8d59' },
    { elevation: 4500, color: '#d53e4f' },
  ],
  grayscale: [
    { elevation: 0, color: '#000000' },
    { elevation: 4500, color: '#ffffff' },
  ],
};

// For completion lists.
export const COLOR_RELIEF_PRESET_NAMES = Object.keys(COLOR_RELIEF_PRESETS);

// Accepts a preset name or a list of single-entry `<elevation>: <color>` maps
// (e.g. `- 0: "#8fae86"`), sorted by elevation. Returns undefined for empty,
// unknown, or malformed input, leaving the default ramp to apply.
export function parseColorReliefStops(value: unknown): readonly ColorReliefStop[] | undefined {
  if (typeof value === 'string') {
    return COLOR_RELIEF_PRESETS[value.trim().toLowerCase()];
  }

  if (!Array.isArray(value)) return undefined;
  const stops: ColorReliefStop[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const pairs = Object.entries(entry as Record<string, unknown>);

    if (pairs.length !== 1) continue;
    const [rawElevation, rawColor] = pairs[0];
    const elevation = Number(rawElevation);
    const color = typeof rawColor === 'string' ? rawColor.trim() : '';

    if (Number.isFinite(elevation) && color) stops.push({ elevation, color });
  }

  if (stops.length === 0) return undefined;

  return stops.sort((a, b) => a.elevation - b.elevation);
}

// AWS Terrain Tiles, Terrarium-encoded. Renders on every MapLibre/Mapbox GL provider.
export const DEFAULT_AWS_TERRAIN_DEM: TerrainDemSpec = {
  tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution: 'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
};

// Terrarium encoding unless the URL ends in #mapbox, which selects Terrain-RGB.
export function terrainDemFromUrl(url: string): TerrainDemSpec {
  const mapboxEncoded = /#mapbox$/i.test(url);
  const tiles = mapboxEncoded ? url.replace(/#mapbox$/i, '') : url;

  return { tiles: [tiles], encoding: mapboxEncoded ? 'mapbox' : 'terrarium', tileSize: 256 };
}

export interface TerrainExaggerationStop {
  readonly zoom: number;
  readonly factor: number;
}

// Piecewise-linear between `@z` stops. MapLibre's terrain exaggeration is not
// expression-driven; a curve is applied by recomputing the scalar per zoom.
export type TerrainExaggeration = number | readonly TerrainExaggerationStop[];

export function parseTerrainExaggeration(value: unknown): TerrainExaggeration | undefined {
  const parsed = parseZoomScaledNumber(value);

  if (typeof parsed === 'number') return parsed >= 0 ? parsed : undefined;

  return parsed?.map(({ zoom, value }) => ({ zoom, factor: value }));
}

// Clamped to the first/last stop outside the range.
export function exaggerationAtZoom(stops: readonly TerrainExaggerationStop[], zoom: number): number {
  if (stops.length === 0) return DEFAULT_TERRAIN_EXAGGERATION;
  if (zoom <= stops[0].zoom) return stops[0].factor;
  const last = stops[stops.length - 1];

  if (zoom >= last.zoom) return last.factor;

  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];

    if (zoom <= to.zoom) {
      const t = (zoom - from.zoom) / (to.zoom - from.zoom);

      return from.factor + t * (to.factor - from.factor);
    }
  }

  return last.factor;
}

export interface TerrainDemResolution {
  readonly dem?: TerrainDemSpec;
  readonly error?: string;
}

export function resolveTerrainDemSpec(terrainProvider: string | undefined, lookupProvider: (name: string) => TerrainDemSpec | null | undefined, availableProviders: () => readonly string[]): TerrainDemResolution {
  const choice = terrainProvider?.trim();

  if (!choice) return {};

  if (/^https?:\/\//i.test(choice)) return { dem: terrainDemFromUrl(choice) };
  if (choice.toLowerCase() === 'aws') return { dem: DEFAULT_AWS_TERRAIN_DEM };

  const source = lookupProvider(choice);

  if (source) return { dem: source };

  const installed = availableProviders();
  const optionsSuffix = installed.length > 0
    ? `Terrain providers: ${installed.join(', ')}. Use aws or a tile URL for provider-independent terrain.`
    : `No provider supplies terrain - use aws or a tile URL.`;

  return { error: `Terrain provider "${choice}" is not available. ${optionsSuffix}` };
}

export interface TerrainRuntimeConfig {
  readonly terrainProvider: string;
  readonly reliefProvider: string;
  readonly hillshadeIntensity: number;
  readonly colorReliefOpacity: number;
  readonly mapProvider: string;
}

export interface TerrainRuntime {
  terrainDem?: TerrainDemSpec;
  reliefDem?: TerrainDemSpec;
  errors: Array<{ path: string; error: string }>;
}

export function resolveTerrainRuntime(config: TerrainRuntimeConfig, lookupProvider: (name: string) => TerrainDemSpec | null | undefined, availableProviders: () => readonly string[]): TerrainRuntime {
  const terrain = resolveTerrainDemSpec(config.terrainProvider, lookupProvider, availableProviders);
  const errors: Array<{ path: string; error: string }> = [];

  if (terrain.error) errors.push({ path: 'terrain.provider', error: terrain.error });

  const relief = config.reliefProvider.trim()
    ? resolveTerrainDemSpec(config.reliefProvider, lookupProvider, availableProviders)
    : undefined;

  if (relief?.error) errors.push({ path: 'terrain.reliefProvider', error: relief.error });

  const reliefWanted = config.hillshadeIntensity > 0 || config.colorReliefOpacity > 0;
  const reliefDem = !reliefWanted
    ? undefined
    : relief
      ? relief.dem
      : config.terrainProvider.trim()
        ? terrain.dem
        : (lookupProvider(config.mapProvider) ?? undefined);

  return { terrainDem: terrain.dem, reliefDem, errors };
}
