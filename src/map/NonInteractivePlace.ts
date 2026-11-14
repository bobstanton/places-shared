import type { MapPlace } from '../Place';

export function isNonInteractivePlace(place: MapPlace | undefined): boolean {
  if (!place) return true;

  return place.metadata?.frequency !== undefined || place.metadata?.boundsAnchor === true;
}

export function hasPlaceMarker(place: MapPlace | undefined): boolean {
  return !isNonInteractivePlace(place) && place?.markerEnabled !== false;
}
