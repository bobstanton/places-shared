import type { ComputedIconStyle, IconZoomSizeStop } from '../Place';

export function iconZoomStopKey(zoom: number): string {
  return String(zoom).replace('.', '_');
}

export function iconScaleAtZoom(stops: readonly IconZoomSizeStop[], zoom: number): number {
  if (stops.length === 0) return 1;
  if (zoom <= stops[0].zoom) return stops[0].scale;
  const last = stops[stops.length - 1];

  if (zoom >= last.zoom) return last.scale;

  for (let index = 1; index < stops.length; index++) {
    if (zoom <= stops[index].zoom) {
      const from = stops[index - 1];
      const to = stops[index];
      const ratio = (zoom - from.zoom) / (to.zoom - from.zoom);

      return from.scale + ratio * (to.scale - from.scale);
    }
  }

  return last.scale;
}

export function collectIconZoomSizeStops(styles: Array<ComputedIconStyle | undefined>): number[] {
  const stops = new Set<number>();

  for (const style of styles) {
    for (const stop of style?.zoomSizeStops ?? []) stops.add(stop.zoom);
  }

  return [...stops].sort((a, b) => a - b);
}

export function iconZoomScaleProperties(style: ComputedIconStyle | undefined, layerStops: readonly number[]): Record<string, number> {
  const properties: Record<string, number> = {};
  const stops = style?.zoomSizeStops;

  if (!stops?.length) return properties;

  for (const zoom of layerStops) {
    properties[`iconScaleZ${iconZoomStopKey(zoom)}`] = iconScaleAtZoom(stops, zoom);
  }

  return properties;
}

export function buildIconSizeExpression(layerStops: readonly number[]): unknown[] {
  const base: unknown[] = ['coalesce', ['get', 'iconScale'], 1];

  if (layerStops.length === 0) return base;

  if (layerStops.length === 1) {
    return ['*', base, ['coalesce', ['get', `iconScaleZ${iconZoomStopKey(layerStops[0])}`], 1]];
  }

  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];

  for (const zoom of layerStops) {
    expression.push(zoom, ['*', base, ['coalesce', ['get', `iconScaleZ${iconZoomStopKey(zoom)}`], 1]]);
  }

  return expression;
}
