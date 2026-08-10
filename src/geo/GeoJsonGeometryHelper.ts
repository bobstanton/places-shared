import type * as GeoJSON from 'geojson';
import { isRecord } from '../utils/ValueGuards';

export type PointGeometry = GeoJSON.Point;
export type MultiPointGeometry = GeoJSON.MultiPoint;
export type LineStringGeometry = GeoJSON.LineString;
export type MultiLineStringGeometry = GeoJSON.MultiLineString;
export type PolygonGeometry = GeoJSON.Polygon;
export type MultiPolygonGeometry = GeoJSON.MultiPolygon;
export type GeometryCollection = GeoJSON.GeometryCollection;
export type GeoJsonPosition = GeoJSON.Position;

export interface GeoJsonGeometryParts {
  points: GeoJsonPosition[];
  lines: GeoJsonPosition[][];
}

const GEOMETRY_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
] as const;

export function isGeoJsonGeometry(value: unknown): value is GeoJSON.Geometry {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && GEOMETRY_TYPES.some(geometryType => geometryType === type);
}

export function isGeoJsonFeature(value: unknown): value is GeoJSON.Feature {
  if (!isRecord(value) || value.type !== 'Feature') return false;
  if (value.geometry !== null && !isGeoJsonGeometry(value.geometry)) return false;
  return value.properties === null || value.properties === undefined || isRecord(value.properties);
}

export function isGeoJsonFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection {
  return isRecord(value)
    && value.type === 'FeatureCollection'
    && Array.isArray(value.features)
    && value.features.every((feature: unknown) => isGeoJsonFeature(feature));
}

export function isGeoJson(value: unknown): value is GeoJSON.GeoJSON {
  return isGeoJsonFeatureCollection(value) || isGeoJsonFeature(value) || isGeoJsonGeometry(value);
}

export function extractFirstGeoJsonCoordinateFromGeoJson(geojson: GeoJSON.GeoJSON): GeoJsonPosition | null {
  switch (geojson.type) {
    case 'FeatureCollection':
      for (const feature of geojson.features) {
        const position = extractFirstGeoJsonCoordinate(feature.geometry);
        if (position) return position;
      }
      return null;
    case 'Feature':
      return extractFirstGeoJsonCoordinate(geojson.geometry);
    default:
      return extractFirstGeoJsonCoordinate(geojson);
  }
}

export function extractFirstGeoJsonCoordinate(geometry: GeoJSON.Geometry | null | undefined): GeoJsonPosition | null {
  if (!geometry) {
    return null;
  }

  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates;
    case 'LineString':
    case 'MultiPoint':
      return geometry.coordinates[0] ?? null;
    case 'Polygon':
    case 'MultiLineString':
      return geometry.coordinates[0]?.[0] ?? null;
    case 'MultiPolygon':
      return geometry.coordinates[0]?.[0]?.[0] ?? null;
    case 'GeometryCollection':
      for (const child of geometry.geometries) {
        const position = extractFirstGeoJsonCoordinate(child);
        if (position) return position;
      }
      return null;
  }
}

export function collectGeoJsonGeometryParts(geometry: GeoJSON.Geometry | null | undefined): GeoJsonGeometryParts {
  const parts: GeoJsonGeometryParts = { points: [], lines: [] };
  collectGeometryParts(geometry, parts);
  return parts;
}

export function forEachGeoJsonPosition(geometry: GeoJSON.Geometry | null | undefined, visitor: (position: GeoJsonPosition) => void): void {
  const parts = collectGeoJsonGeometryParts(geometry);
  for (const point of parts.points) {
    visitor(point);
  }
  for (const line of parts.lines) {
    for (const point of line) {
      visitor(point);
    }
  }
}

function collectGeometryParts(geometry: GeoJSON.Geometry | null | undefined, parts: GeoJsonGeometryParts): void {
  if (!geometry) {
    return;
  }

  switch (geometry.type) {
    case 'Point':
      parts.points.push(geometry.coordinates);
      break;
    case 'MultiPoint':
      parts.points.push(...geometry.coordinates);
      break;
    case 'LineString':
      parts.lines.push(geometry.coordinates);
      break;
    case 'MultiLineString':
    case 'Polygon':
      for (const line of geometry.coordinates) {
        parts.lines.push(line);
      }
      break;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          parts.lines.push(ring);
        }
      }
      break;
    case 'GeometryCollection':
      for (const child of geometry.geometries) {
        collectGeometryParts(child, parts);
      }
      break;
  }
}
