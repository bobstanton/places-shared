import type * as GeoJSON from 'geojson';
import { getGeoJsonFeatures } from '../overlay/OverlaySystem';

export type RouteOverlayFeatureMatch =
  | { readonly kind: 'directions'; readonly feature: GeoJSON.Feature }
  | { readonly kind: 'isochrone'; readonly collection: GeoJSON.FeatureCollection };

export function isDirectionsRouteLineFeature(feature: GeoJSON.Feature): boolean {
  const geometryType = feature.geometry?.type;

  if (geometryType !== 'LineString' && geometryType !== 'MultiLineString') return false;
  const properties = feature.properties ?? {};

  return Boolean(properties.route_label || properties.duration_text || properties.duration_seconds || properties.provider);
}

export function isIsochroneFeature(feature: GeoJSON.Feature): boolean {
  const geometryType = feature.geometry?.type;

  if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon' && geometryType !== 'LineString' && geometryType !== 'MultiLineString') return false;
  const properties = feature.properties ?? {};

  return Boolean(
    properties.metric
      && properties.contour !== undefined
      && properties.provider
      && (properties.fill !== undefined || properties['fill-opacity'] !== undefined || properties.stroke !== undefined)
  );
}

export function cloneRouteFeature(feature: GeoJSON.Feature): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: JSON.parse(JSON.stringify(feature.geometry)) as GeoJSON.Geometry,
    properties: { ...(feature.properties ?? {}) } };
}

export function classifyRouteOverlayFeature(feature: GeoJSON.Feature, overlayGeoJson?: GeoJSON.GeoJSON): RouteOverlayFeatureMatch | null {
  if (!feature.geometry) return null;

  if (isDirectionsRouteLineFeature(feature)) {
    return { kind: 'directions', feature: cloneRouteFeature(feature) };
  }

  if (isIsochroneFeature(feature)) {
    const siblings = overlayGeoJson ? getGeoJsonFeatures(overlayGeoJson).filter(isIsochroneFeature) : [];
    const features = (siblings.length > 0 ? siblings : [feature]).map(cloneRouteFeature);

    return { kind: 'isochrone', collection: { type: 'FeatureCollection', features } };
  }

  return null;
}
