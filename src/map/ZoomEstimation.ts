import { PlacesBoundingBox } from '../geo/index';

// Applies when no saved state or explicit zoom setting exists.
export function estimateInitialZoom(bounds: PlacesBoundingBox, fallbackZoom = 9): number {
  if (!bounds.isValid()) {
    return fallbackZoom;
  }

  const span = Math.max(bounds.maxLng - bounds.minLng, bounds.maxLat - bounds.minLat);

  if (span > 80) return 3;
  if (span > 30) return 4;
  if (span > 12) return 5;
  if (span > 4) return 6;
  if (span > 1) return 8;
  if (span > 0.25) return 10;

  return 12;
}
