export const PLACES_TILE_CACHE_PROTOCOL = 'places-cache';

export function encodeCacheProtocolUrl(url: string): string {
  return `${PLACES_TILE_CACHE_PROTOCOL}://${encodeURIComponent(url)}`;
}

export function decodeCacheProtocolUrl(protocolUrl: string): string {
  return decodeURIComponent(protocolUrl.slice(`${PLACES_TILE_CACHE_PROTOCOL}://`.length));
}
