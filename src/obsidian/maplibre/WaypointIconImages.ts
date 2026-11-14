import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { ensureMarkerIconImage, WAYPOINT_ICON_PROPERTY } from "../../map/index";
import { getGeoJsonFeatures } from "../../overlay/index";

export function ensureWaypointIconImages(map: maplibregl.Map, geojson: GeoJSON.GeoJSON): number {
  const icons = new Set<string>();

  for (const feature of getGeoJsonFeatures(geojson)) {
    const icon: unknown = feature.properties?.[WAYPOINT_ICON_PROPERTY];

    if (typeof icon === 'string' && icon) icons.add(icon);
  }

  if (icons.size === 0) return 0;

  const hostWindow = map.getCanvas().ownerDocument.win as typeof window;
  const host = {
    createCanvas: () => hostWindow.createEl('canvas'),
    pixelRatio: hostWindow.devicePixelRatio || 1,
  };

  for (const icon of icons) ensureMarkerIconImage(map, icon, undefined, host);

  return icons.size;
}
