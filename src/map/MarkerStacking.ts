import type { MapPlace } from '../Place';

export const PICTURE_MARKER_Z_INDEX = -1;

export function explicitMarkerZIndex(place: MapPlace): number | undefined {
  return (place.iconImageUrl ? place.iconImageStyle?.zIndex : undefined) ?? place.iconStyle?.zIndex;
}

export function markerStackingOrder(place: MapPlace): number {
  return explicitMarkerZIndex(place) ?? (place.iconImageUrl ? PICTURE_MARKER_Z_INDEX : 0);
}
