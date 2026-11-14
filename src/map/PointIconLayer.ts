export interface PointIconLayoutOptions {
  image: unknown;
  size: unknown;
  rotate?: unknown;
  rotationAlignment?: 'map' | 'viewport';
  pitchAlignment?: 'map' | 'viewport';
}

export function createPointIconLayout(options: PointIconLayoutOptions): Record<string, unknown> {
  return {
    'icon-image': options.image,
    'icon-size': options.size,
    'icon-anchor': 'center',
    ...(options.rotate !== undefined ? { 'icon-rotate': options.rotate } : {}),
    'icon-rotation-alignment': options.rotationAlignment ?? 'viewport',
    'icon-pitch-alignment': options.pitchAlignment ?? 'viewport',
    'icon-allow-overlap': true,
    'icon-ignore-placement': false,
  };
}
