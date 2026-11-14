import type * as GeoJSON from 'geojson';
import { DEFAULT_MARKER_ICON } from './MarkerIcon';
import { buildPopupContent } from './PopupBuilder';
import { formatDisplayCoordinate } from '../utils/Utilities';
import type { PoiPlaceNoteRequest } from './PlaceNoteRequest';

export interface DiscoveredPoi {
  name: string;
  class: string;
  subclass?: string;
  lat: number;
  lng: number;
  layer?: string;
  sourceLayer?: string;
  geometry?: GeoJSON.Geometry;
}

export function poiPlaceNoteRequest(poi: DiscoveredPoi, geometry?: GeoJSON.Geometry): PoiPlaceNoteRequest {
  return {
    kind: 'poi',
    name: poi.name,
    class: poi.class,
    subclass: poi.subclass || undefined,
    lat: poi.lat,
    lng: poi.lng,
    ...(geometry ? { geometry } : {}),
  };
}

export interface PoiPopupOptions {
  poi: DiscoveredPoi;
  icon?: string;
  createNoteText?: string;
  copyTextPrefix?: string;
  closePopup: () => void;
  onCreateNote?: () => void;
  onCopy: (text: string, message: string) => void;
}

export function buildPoiPopupContent(options: PoiPopupOptions): HTMLElement {
  const { poi } = options;
  const coordString = formatDisplayCoordinate({ latitude: poi.lat, longitude: poi.lng });

  return buildPopupContent({
    icon: options.icon ?? DEFAULT_MARKER_ICON,
    name: poi.name,
    isLink: false,
    closePopup: options.closePopup,
    actions: [
      ...(options.onCreateNote
        ? [{ text: options.createNoteText ?? '📝 Create Note', onClick: options.onCreateNote }]
        : []),
      {
        text: `📋 ${coordString}`,
        onClick: () => options.onCopy(coordString, `${options.copyTextPrefix ?? 'Copied'}: ${coordString}`),
      },
    ],
  });
}
