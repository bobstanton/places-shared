import type { Coordinate } from '../geo/DistanceCalculator';
import type { RouteTravelMode } from './IRouteOverlayService';
import type { SnappedPoint } from './ISnapService';

export function assertProviderApiKey(apiKey: string | undefined, providerDisplayName: string): void {
  if (!apiKey) {
    throw new Error(`${providerDisplayName} API key is not configured`);
  }
}

// Map the block-level travel mode onto a provider's own mode/profile/costing names.
export function mapTravelMode<T>(mode: RouteTravelMode, names: { walk: T; bike: T; drive: T }): T {
  if (mode === 'walk') return names.walk;
  if (mode === 'bike') return names.bike;

  return names.drive;
}

// A matched [lng, lat] tuple, or the original point marked unsnapped when matching failed.
export function toSnappedPoint(location: number[] | null | undefined, original: Coordinate): SnappedPoint {
  if (Array.isArray(location) && location.length >= 2) {
    return { latitude: location[1], longitude: location[0], snapped: true };
  }

  return { latitude: original.latitude, longitude: original.longitude, snapped: false };
}
