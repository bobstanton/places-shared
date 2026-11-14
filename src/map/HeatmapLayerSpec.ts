import { ColorSchemes, DEFAULT_DENSITY_COLOR_SCHEME } from '../track/ColorSchemes';

export const HEATMAP_OPACITY = 0.65;
export const HEATMAP_GAUSSIAN_COEFFICIENT = 1 / Math.sqrt(2 * Math.PI);
export const HEATMAP_POINT_SOURCE_OPTIONS = {
  cluster: true,
  clusterRadius: 1,
  clusterMaxZoom: 23,
  maxzoom: 24,
} as const;

function heatmapWeightExpression(): unknown[] {
  return ['sqrt', ['max', 0, ['coalesce', ['get', 'weight'], 1]]];
}

export function createHeatmapSourceOptions(weighted = false) {
  return {
    ...HEATMAP_POINT_SOURCE_OPTIONS,
    ...(weighted ? { clusterProperties: { densityWeight: ['+', heatmapWeightExpression()] } } : {}),
  };
}

const INTENSITY_STOPS = [[0, 0.015], [6, 0.015], [10, 0.02], [14, 0.03], [18, 0.04], [22, 0.05]] as const;
const RADIUS_STOPS = [[0, 14], [6, 18], [10, 20], [14, 18], [18, 14], [22, 12]] as const;

function interpolateZoom(zoom: number, stops: readonly (readonly [number, number])[]): number {
  for (let index = 1; index < stops.length; index++) {
    const [endZoom, endValue] = stops[index];
    const [startZoom, startValue] = stops[index - 1];

    if (zoom <= endZoom) return startValue + (endValue - startValue) * Math.max(0, (zoom - startZoom) / (endZoom - startZoom));
  }

  return stops[stops.length - 1][1];
}

export function heatmapRadius(zoom: number): number {
  return interpolateZoom(zoom, RADIUS_STOPS);
}

export function heatmapIntensity(zoom: number): number {
  return interpolateZoom(zoom, INTENSITY_STOPS);
}

export function heatmapWeight(weight: number): number {
  return Math.sqrt(Number.isFinite(weight) && weight > 0 ? weight : 1);
}

export function heatmapAlpha(density: number): number {
  return Math.min(1, Math.max(0, density) / 0.016) * HEATMAP_OPACITY;
}

function heatmapColor(density: number, colorScheme: string): [number, number, number, number] {
  return [...ColorSchemes.getHeatmapColorRgb(Math.sqrt(Math.min(1, Math.max(0, density))), colorScheme || DEFAULT_DENSITY_COLOR_SCHEME), heatmapAlpha(density)];
}

export function createHeatmapLayerPaint(colorScheme = DEFAULT_DENSITY_COLOR_SCHEME): Record<string, unknown> {
  return {
    ...createClusterHeatmapPaint(colorScheme),
    'heatmap-weight': ['coalesce', ['get', 'densityWeight'], heatmapWeightExpression()],
  };
}

export function createClusterHeatmapPaint(colorScheme = DEFAULT_DENSITY_COLOR_SCHEME): Record<string, unknown> {
  const positions = Array.from({ length: 256 }, (_, index) => index / 255);
  const color: unknown[] = ['interpolate', ['linear'], ['heatmap-density']];

  for (const density of positions) {
    const [r, g, b, alpha] = heatmapColor(density, colorScheme);

    color.push(density, `rgba(${r}, ${g}, ${b}, ${alpha / HEATMAP_OPACITY})`);
  }

  return {
    'heatmap-weight': ['coalesce', ['get', 'point_count'], 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], ...INTENSITY_STOPS.flat()],
    'heatmap-color': color,
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], ...RADIUS_STOPS.flat()],
    'heatmap-opacity': HEATMAP_OPACITY,
  };
}

export function buildHeatmapRamp(colorScheme = DEFAULT_DENSITY_COLOR_SCHEME): Uint8ClampedArray {
  const ramp = new Uint8ClampedArray(256 * 4);

  for (let step = 0; step < 256; step++) {
    const [red, green, blue, alpha] = heatmapColor(step / 255, colorScheme);

    ramp[step * 4] = red;
    ramp[step * 4 + 1] = green;
    ramp[step * 4 + 2] = blue;
    ramp[step * 4 + 3] = Math.round(255 * alpha);
  }

  return ramp;
}

export const CLUSTER_HEATMAP_HIT_TOLERANCE_PX = 20;
export const CLUSTER_HEATMAP_HIT_LIMIT = 8;
