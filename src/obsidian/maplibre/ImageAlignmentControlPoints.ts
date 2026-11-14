import { isRecord } from "../../utils/index";
import type { ImageOverlayAlignmentCorner, ImageOverlayAlignmentCorners } from './ImageOverlayAlignment';

export type PixelPoint = [number, number];
export interface AlignmentPointPair {
  pixel: PixelPoint;
  latlng: [number, number];
  enabled?: boolean;
}
export interface ControlPointAlignment {
  fit: 'similarity' | 'affine';
  points: AlignmentPointPair[];
  imageSize?: PixelPoint;
}
export type AlignmentStatus = 'Not fitted' | 'Fit up to date' | 'Points changed — fit again' | 'Manually adjusted';
export interface AlignmentSnapshot {
  corners: ImageOverlayAlignmentCorners;
  alignment: ControlPointAlignment;
  status: AlignmentStatus;
}

export function cloneAlignment<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AlignmentHistory {
  private entries: AlignmentSnapshot[];
  private index = 0;
  constructor(initial: AlignmentSnapshot) { this.entries = [cloneAlignment(initial)]; }
  get canUndo(): boolean { return this.index > 0; }
  get canRedo(): boolean { return this.index < this.entries.length - 1; }
  commit(state: AlignmentSnapshot): void {
    if (JSON.stringify(state) === JSON.stringify(this.entries[this.index])) return;
    this.entries.splice(this.index + 1);
    this.entries.push(cloneAlignment(state));
    if (this.entries.length > 100) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo(): AlignmentSnapshot { if (this.canUndo) this.index--;

 return cloneAlignment(this.entries[this.index]); }
  redo(): AlignmentSnapshot { if (this.canRedo) this.index++;

 return cloneAlignment(this.entries[this.index]); }
}

function numericPair(value: unknown): value is PixelPoint {
  return Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number' && Number.isFinite(v));
}

export function parseControlPointAlignment(value: unknown): ControlPointAlignment {
  if (value === undefined) return { fit: 'similarity', points: [] };
  if (!isRecord(value)) throw new Error('Image alignment must contain fit and points.');
  const fit = value.fit ?? 'similarity';

  if (fit !== 'similarity' && fit !== 'affine') throw new Error('alignment.fit must be similarity or affine.');

  if (value.imageSize !== undefined && (!numericPair(value.imageSize) || value.imageSize.some(n => n <= 0))) {
    throw new Error('alignment.imageSize requires positive [width, height] values.');
  }

  const points = value.points ?? [];

  if (!Array.isArray(points)) throw new Error('alignment.points must be a list of pixel/latlng pairs.');
  const parsed = points.map((point: unknown, i): AlignmentPointPair => {
    if (!isRecord(point) || !numericPair(point.pixel) || point.pixel.some(n => n < 0)
      || !numericPair(point.latlng) || Math.abs(point.latlng[0]) > 85.05112878 || Math.abs(point.latlng[1]) > 180
      || (point.enabled !== undefined && typeof point.enabled !== 'boolean')) {
      throw new Error(`Invalid alignment point ${i + 1}.`);
    }

    return { pixel: [...point.pixel], latlng: [...point.latlng], ...(point.enabled === false ? { enabled: false } : {}) };
  });

  return { fit, points: parsed, ...(numericPair(value.imageSize) ? { imageSize: [...value.imageSize] as PixelPoint } : {}) };
}

export function projectAlignmentPoint(latlng: [number, number], originLng = latlng[1]): PixelPoint {
  const [lat, lng] = latlng;
  const unwrapped = originLng + ((((lng - originLng) + 180) % 360 + 360) % 360 - 180);
  const phi = lat * Math.PI / 180;

  return [(unwrapped + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
}

export function unprojectAlignmentPoint([x, y]: PixelPoint): ImageOverlayAlignmentCorner {
  return { lng: x * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI };
}

export interface ControlPointFit {
  corners: ImageOverlayAlignmentCorners;
  errors: (number | null)[];
  warning?: string;
}

export function fitAlignmentPoints(alignment: ControlPointAlignment, width: number, height: number): ControlPointFit {
  if (!(width > 0 && height > 0)) throw new Error('Image dimensions unavailable.');

  if (alignment.imageSize && (alignment.imageSize[0] !== width || alignment.imageSize[1] !== height)) {
    throw new Error('Image dimensions have changed. Replace point pairs.');
  }

  const points = alignment.points.filter(p => p.enabled !== false);
  const minimum = alignment.fit === 'affine' ? 3 : 2;

  if (points.length < minimum) throw new Error(`Requires at least ${minimum} enabled pairs.`);

  if (points.some(p => p.pixel[0] < 0 || p.pixel[0] > width || p.pixel[1] < 0 || p.pixel[1] > height)) {
    throw new Error('Point outside image.');
  }

  for (let i = 0; i < points.length; i++) for (let j = 0; j < i; j++) {
    if (Math.hypot(points[i].pixel[0] - points[j].pixel[0], points[i].pixel[1] - points[j].pixel[1]) < 0.01
      || Math.hypot(points[i].latlng[0] - points[j].latlng[0], points[i].latlng[1] - points[j].latlng[1]) < 1e-10) {
      throw new Error('Two pairs use the same location.');
    }
  }

  const originLng = points[0].latlng[1];
  const targets = points.map(p => projectAlignmentPoint(p.latlng, originLng));
  const mean = (values: PixelPoint[]): PixelPoint => [
    values.reduce((s, p) => s + p[0], 0) / values.length,
    values.reduce((s, p) => s + p[1], 0) / values.length,
  ];
  const sourceMean = mean(points.map(p => p.pixel));
  const targetMean = mean(targets);
  let xx = 0, yy = 0, xy = 0, xu = 0, xv = 0, yu = 0, yv = 0;

  points.forEach((point, i) => {
    const x = point.pixel[0] - sourceMean[0], y = point.pixel[1] - sourceMean[1];
    const u = targets[i][0] - targetMean[0], v = targets[i][1] - targetMean[1];

    xx += x * x; yy += y * y; xy += x * y;
    xu += x * u; xv += x * v; yu += y * u; yv += y * v;
  });
  let a: number, b: number, c: number, d: number;

  if (alignment.fit === 'similarity') {
    a = d = (xu + yv) / (xx + yy);
    c = (xv - yu) / (xx + yy);
    b = -c;
  } else {
    const det = xx * yy - xy * xy;

    if (det <= 1e-8 * (xx + yy) ** 2) throw new Error('Image points lie on a single line.');
    a = (xu * yy - yu * xy) / det; b = (yu * xx - xu * xy) / det;
    c = (xv * yy - yv * xy) / det; d = (yv * xx - xv * xy) / det;
  }

  if (![a, b, c, d].every(Number.isFinite) || a * d - b * c <= 1e-8 * (a * a + b * b + c * c + d * d)
    || Math.hypot(a, b, c, d) < 1e-14) {
    throw new Error('Matches collapse or mirror the image.');
  }

  const transform = ([x, y]: PixelPoint): PixelPoint => [
    targetMean[0] + a * (x - sourceMean[0]) + b * (y - sourceMean[1]),
    targetMean[1] + c * (x - sourceMean[0]) + d * (y - sourceMean[1]),
  ];
  const projected = [[0, 0], [width, 0], [width, height], [0, height]].map(p => transform(p as PixelPoint));

  if (projected.some(p => !p.every(Number.isFinite) || p[1] < 0 || p[1] > 1) || Math.max(...projected.map(p => p[0])) - Math.min(...projected.map(p => p[0])) >= 1) {
    throw new Error('Fit extends beyond the map.');
  }

  const [nw, ne, se, sw] = projected.map(unprojectAlignmentPoint);
  const spread = (values: PixelPoint[], center: PixelPoint): number => {
    let xx = 0, yy = 0, xy = 0;

    for (const point of values) {
      const x = point[0] - center[0], y = point[1] - center[1];

      xx += x * x; yy += y * y; xy += x * y;
    }

    return (xx * yy - xy * xy) / ((xx + yy) ** 2 || 1);
  };
  const warning = alignment.fit === 'similarity' && points.length >= 3 && spread(targets, targetMean) < 0.001
    && spread(points.map(p => p.pixel), sourceMean) > 0.01
    ? 'These pairs need directional stretching that Preserve proportions cannot provide. Choose Allow stretching/skew and fit again to allow unequal scaling and skew.'
    : undefined;

  return {
    corners: { nw, ne, se, sw },
    ...(warning ? { warning } : {}),
    errors: alignment.points.map(p => {
      if (p.enabled === false) return null;
      const fitted = transform(p.pixel), target = projectAlignmentPoint(p.latlng, originLng);

      return Math.hypot(fitted[0] - target[0], fitted[1] - target[1]) * 40075016.686 * Math.cos(p.latlng[0] * Math.PI / 180);
    }),
  };
}

export function snapAlignmentPoint(
  point: ImageOverlayAlignmentCorner,
  lines: readonly (readonly [number, number][])[],
  map: { project(p: ImageOverlayAlignmentCorner): { x: number; y: number }; unproject(p: PixelPoint): ImageOverlayAlignmentCorner },
  threshold = 12,
): ImageOverlayAlignmentCorner | undefined {
  const pointer = map.project(point);
  let best = threshold ** 2;
  let result: ImageOverlayAlignmentCorner | undefined;

  for (const line of lines) for (let i = 1; i < line.length; i++) {
    const a = map.project({ lng: line[i - 1][0], lat: line[i - 1][1] });
    const b = map.project({ lng: line[i][0], lat: line[i][1] });
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const x = a.x + t * dx, y = a.y + t * dy;
    const distance = (pointer.x - x) ** 2 + (pointer.y - y) ** 2;

    if (distance <= best) { best = distance; result = map.unproject([x, y]); }
  }

  return result;
}
