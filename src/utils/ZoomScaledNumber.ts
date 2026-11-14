export interface ZoomValueStop {
  readonly zoom: number;
  readonly value: number;
}

export type ZoomScaledNumber = number | readonly ZoomValueStop[];

export function parseZoomScaledNumber(value: unknown): ZoomScaledNumber | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const raw = value.trim();

  if (!raw) return undefined;

  if (!raw.includes('@')) {
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const stops: ZoomValueStop[] = [];

  for (const part of raw.split(',')) {
    const match = part.trim().match(/^(\d*\.?\d+)\s*@\s*z?\s*(\d*\.?\d+)$/i);

    if (!match) return undefined;
    const value = Number(match[1]);
    const zoom = Number(match[2]);

    if (!Number.isFinite(value) || !Number.isFinite(zoom)) return undefined;
    stops.push({ value, zoom });
  }

  if (stops.length === 0) return undefined;
  stops.sort((a, b) => a.zoom - b.zoom);

  return stops.length === 1 ? stops[0].value : stops;
}
