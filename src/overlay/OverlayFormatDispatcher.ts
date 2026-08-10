export type OverlayContentFormat = 'gpx' | 'geojson' | 'csv' | 'polyline';
export type OverlayPathFormat = OverlayContentFormat | 'md' | 'image' | 'unknown';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif']);

export interface OverlayFormatDispatchInput {
  path?: string;
  content?: string;
  allowTrack?: boolean;
}

export function overlayFormatFromPath(path: string): OverlayPathFormat {
  const cleanPath = path.split('|')[0].trim().toLowerCase();
  const extension = cleanPath.match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension) return 'unknown';
  if (extension === 'geojson' || extension === 'json') return 'geojson';
  if (extension === 'gpx') return 'gpx';
  if (extension === 'csv') return 'csv';
  if (extension === 'md') return 'md';
  return IMAGE_EXTENSIONS.has(extension) ? 'image' : 'unknown';
}

export function overlayFormatFromContent(content: string, allowTrack = false): OverlayContentFormat | 'unknown' {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'geojson';
  if (/^(?:<\?xml[^>]*>\s*)?<gpx(?:\s|>)/i.test(trimmed)) return 'gpx';
  if (hasCoordinateCsvHeader(trimmed.split(/\r?\n/, 1)[0] ?? '')) return 'csv';
  return allowTrack && looksLikeEncodedPolyline(trimmed) ? 'polyline' : 'unknown';
}

export function dispatchOverlayFormat(input: OverlayFormatDispatchInput): OverlayContentFormat | OverlayPathFormat {
  if (input.path) {
    const fromPath = overlayFormatFromPath(input.path);
    if (fromPath !== 'unknown') return fromPath;
  }
  return input.content === undefined
    ? 'unknown'
    : overlayFormatFromContent(input.content, input.allowTrack);
}

function hasCoordinateCsvHeader(header: string): boolean {
  const columns = header.toLowerCase().split(',').map(column => column.trim().replace(/^["']|["']$/g, ''));
  return columns.some(column => column === 'lat' || column === 'latitude')
    && columns.some(column => column === 'lng' || column === 'lon' || column === 'longitude');
}

function looksLikeEncodedPolyline(value: string): boolean {
  return value.length >= 2 && !/\s/.test(value) && /^[\x3f-\x7e]+$/.test(value);
}
