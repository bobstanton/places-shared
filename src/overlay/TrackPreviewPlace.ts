import { MapPlace } from '../Place';

export interface PreviewTrack {
  name: string;
  icon: string;
  // [lng, lat] pairs
  coordinates: number[][];
  color: string;
  lineStyle: 'solid' | 'dashed';
  filePath?: string;
}

export function buildTrackPreviewPlace(track: PreviewTrack): MapPlace {
  return {
    latitude: track.coordinates[0][1],
    longitude: track.coordinates[0][0],
    name: track.name,
    icon: track.icon,
    ...(track.filePath ? { filePath: track.filePath } : {}),
    trackDefaultVisibility: 'visible',
    overlay: {
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            stroke: track.color,
            'stroke-width': 4,
            'stroke-opacity': 0.85,
            'stroke-dasharray': track.lineStyle === 'dashed' ? '6 6' : ''
          },
          geometry: { type: 'LineString', coordinates: track.coordinates }
        }]
      },
      style: { color: track.color, weight: 4, opacity: 0.85, style: track.lineStyle }
    }
  };
}
