import type * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { convertPlacesToGeoJSONData } from "../../geo/index";
import { extractOverlayPointFeatures as extractOverlayPointFeaturesFromOverlays, type MapPlace } from "../../overlay/index";
import { getPlaceId, getPlaceMarkerRenderSignature } from "../../track/index";
import type { MapRenderRequest } from "../../settings/index";
import type { CommonMapSettings } from "../services/index";
import { logger } from "../../utils/index";
import type { ViewportClusteringManager } from "../../map/index";
import { hasPlaceMarker } from "../../map/index";
import type { MapState } from '../../maplibre/MapState';
import { updateTextLabelSource } from '../../maplibre/MapLibreMarkerRenderer';
import { ensureWaypointIconImages } from './WaypointIconImages';

export function updateClusteredMarkers(
  map: maplibregl.Map,
  clusteringManager: ViewportClusteringManager<maplibregl.Marker>,
  mapState: MapState,
  places: MapPlace[],
  settings: CommonMapSettings | null,
  request: MapRenderRequest,
): void {
  const blockSettings = request.config;
  const [geoJsonData] = convertPlacesToGeoJSONData(places, { includeMapPlace: false });
  const features = (geoJsonData as { data: GeoJSON.FeatureCollection }).data.features;
  const overlayFeatures = blockSettings.clusterGeoJsonOverlays
    ? [...extractOverlayPointFeaturesFromOverlays(request.runtime.overlays)]
    : [];
  const interactivePlaces: MapPlace[] = [];
  const interactiveFeatures: GeoJSON.Feature[] = [];

  ensureWaypointIconImages(map, { type: 'FeatureCollection', features: overlayFeatures });

  places.forEach((place, index) => {
    if (!hasPlaceMarker(place)) return;
    interactivePlaces.push(place);
    interactiveFeatures.push(features[index]);
  });

  void map.getSource<maplibregl.GeoJSONSource>('places-clustered')?.setData({
    type: 'FeatureCollection',
    features: [...interactiveFeatures, ...overlayFeatures],
  });
  void map.getSource<maplibregl.GeoJSONSource>('overlay-points-unclustered')?.setData({
    type: 'FeatureCollection',
    features: overlayFeatures,
  });
  if (settings?.showLabels) updateTextLabelSource(map, places);

  clusteringManager.updatePlaces(interactivePlaces, overlayFeatures.map(feature => {
    const [longitude, latitude] = (feature.geometry as GeoJSON.Point).coordinates;

    return { longitude, latitude };
  }));
  mapState.setCurrentPlaces(places);

  for (const place of interactivePlaces) {
    mapState.setPlaceMarkerSignature(getPlaceId(place), getPlaceMarkerRenderSignature(place));
  }

  logger.scope('Places').debug(`[Places Incremental] Updated clustered source: ${interactivePlaces.length} places`);
}
