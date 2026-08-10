import type * as GeoJSON from 'geojson';
import { coerceScalarString } from '../utils/Utilities';
import type { RouteOverlayPlaceNoteRequest } from '../map/PlaceNoteRequest';
import { addRouteEndpointFeatures, addRouteLabelFeature } from './RouteOverlayGeoJson';

export async function prepareDirectionsOverlayNote(routeFeature: GeoJSON.Feature, sourcePath?: string): Promise<RouteOverlayPlaceNoteRequest> {
  const routeLineFeature = cloneRouteLineFeature(routeFeature);
  const geojson = await createRouteFeatureCollection(routeLineFeature);
  return {
    kind: 'route-overlay',
    overlayKind: 'directions',
    name: getRouteNoteName(routeLineFeature),
    geojson,
    sourcePath,
    location: getFirstCoordinate(routeLineFeature.geometry) ?? undefined,
  };
}

export function prepareIsochroneOverlayNote(geojson: GeoJSON.FeatureCollection, sourcePath?: string): RouteOverlayPlaceNoteRequest {
  const clonedGeoJson = cloneFeatureCollection(geojson);
  return {
    kind: 'route-overlay',
    overlayKind: 'isochrone',
    name: getIsochroneNoteName(clonedGeoJson),
    geojson: clonedGeoJson,
    sourcePath,
    location: getFirstCoordinateFromFeatureCollection(clonedGeoJson) ?? undefined,
  };
}

function cloneRouteLineFeature(routeFeature: GeoJSON.Feature): GeoJSON.Feature {
  if (!routeFeature.geometry) {
    throw new Error('Cannot save directions: route feature has no geometry');
  }

  const properties = { ...(routeFeature.properties ?? {}) };
  delete properties.labelColor;
  delete properties.labelHaloColor;
  delete properties.labelHaloWidth;
  delete properties.labelFontSize;
  delete properties.labelOpacity;
  delete properties.route_label_opacity;

  return {
    type: 'Feature',
    geometry: JSON.parse(JSON.stringify(routeFeature.geometry)) as GeoJSON.Geometry,
    properties,
  };
}

async function createRouteFeatureCollection(routeFeature: GeoJSON.Feature): Promise<GeoJSON.FeatureCollection> {
  const features: GeoJSON.Feature[] = [routeFeature];
  // Exported/saved notes are a static snapshot: no request is in scope, and endpoint labels fall back to
  // the coded default (Start: / Stop N: / End:).
  await addRouteEndpointFeatures(features, routeFeature);
  const label: unknown = routeFeature.properties?.route_label;
  if (typeof label === 'string' && label.trim()) {
    addRouteLabelFeature(features, routeFeature, label);
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function cloneFeatureCollection(geojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  return JSON.parse(JSON.stringify(geojson)) as GeoJSON.FeatureCollection;
}

function getRouteNoteName(routeFeature: GeoJSON.Feature): string {
  const properties: Record<string, unknown> = routeFeature.properties ?? {};
  const waypoints = properties.waypoints;
  if (Array.isArray(waypoints) && waypoints.length >= 2) {
    return `${String(waypoints[0])} to ${String(waypoints[waypoints.length - 1])} Directions`;
  }

  const name = properties.name ?? properties.title;
  if (name) return `${coerceScalarString(name)} Directions`;

  const index = typeof properties.route_index === 'number' ? properties.route_index + 1 : undefined;
  return index ? `Route ${index} Directions` : 'Directions Overlay';
}

function getIsochroneNoteName(geojson: GeoJSON.FeatureCollection): string {
  const names = geojson.features
    .map((feature): unknown => feature.properties?.name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0);

  if (names.length > 0) {
    const firstName = names[0].replace(/\s+\d+(?:\.\d+)?\s*(?:min|m|km|mi|ft)$/i, '').trim();
    return `${firstName || names[0]} Isochrones`;
  }

  return 'Isochrone Overlay';
}


function getFirstCoordinate(geometry: GeoJSON.Geometry | null): GeoJSON.Position | null {
  if (!geometry) return null;
  if (geometry.type === 'LineString') return geometry.coordinates[0] ?? null;
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0]?.[0] ?? null;
  return null;
}

function getFirstCoordinateFromFeatureCollection(geojson: GeoJSON.FeatureCollection): GeoJSON.Position | null {
  for (const feature of geojson.features) {
    const coordinate = getFirstCoordinate(feature.geometry);
    if (coordinate) return coordinate;
  }
  return null;
}
