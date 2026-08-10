import type * as GeoJSON from 'geojson';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
import { hashString36 } from '../utils/Utilities';
import type { ZoomRange } from '../ZoomVisibility';

export type { MapPlace } from '../Place';
export { parseMapPlaceProperty } from '../Place';

export interface ImageOverlayBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface ImageOverlayCorners {
  nwLat: number;
  nwLng: number;
  neLat: number;
  neLng: number;
  seLat: number;
  seLng: number;
  swLat: number;
  swLng: number;
}

export interface GeoJSONOverlay {
  type: 'geojson';
  geojson: GeoJSON.GeoJSON;
  source: string;
  zoom?: ZoomRange;
  labelTemplate?: string;
  waypointLabelTemplate?: string;
  style?: OverlayRenderStyle;
  hoverStyle?: OverlayRenderStyle;
}

export interface ImageOverlayStyle {
  opacity?: number;
}

export interface ImageOverlay {
  type: 'image';
  url: string;
  bounds?: ImageOverlayBounds;
  corners?: ImageOverlayCorners;
  style?: ImageOverlayStyle;
  source: string;
  zoom?: ZoomRange;
}

export type VectorTileLayerType = 'line' | 'fill' | 'circle' | 'symbol';

export interface ZoomValueStop {
  readonly zoom: number;
  readonly value: number;
}

// A numeric style value: a constant, or piecewise-linear `@z` zoom stops.
export type ZoomScaledNumber = number | readonly ZoomValueStop[];

export interface OverlayRenderStyle {
  color?: string;
  opacity?: ZoomScaledNumber;
  width?: ZoomScaledNumber;
  dashArray?: string;
  fillColor?: string;
  fillOpacity?: number;
  circleRadius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  textSize?: ZoomScaledNumber;
  textColor?: string;
  textHaloColor?: string;
  textHaloWidth?: number;
  iconSize?: number;
}

// Parse a numeric style value that also accepts the `@z` zoom-stop syntax
// (`1 @z10, 2.5 @z14`). Stops are sorted by zoom; a single stop collapses to a
// constant. Returns undefined for empty input or any malformed part, leaving
// callers to raise their own parse error.
export function parseZoomScaledNumber(value: unknown): ZoomScaledNumber | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const raw = value.trim();
  if (!raw.includes('@')) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const stops: ZoomValueStop[] = [];
  for (const part of raw.split(',')) {
    const match = part.trim().match(/^(\d*\.?\d+)\s*@\s*z?\s*(\d*\.?\d+)$/i);
    if (!match) return undefined;
    stops.push({ value: parseFloat(match[1]), zoom: parseFloat(match[2]) });
  }
  if (stops.length === 0) return undefined;
  stops.sort((a, b) => a.zoom - b.zoom);
  return stops.length === 1 ? stops[0].value : stops;
}

// Stops become a linear zoom `interpolate` expression, supported by both MapLibre GL and mapbox-gl for the affected properties.
export function zoomScaledNumberToExpression(value: ZoomScaledNumber | undefined): number | unknown[] | undefined {
  if (value === undefined || typeof value === 'number') return value;
  const expression: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const stop of value) {
    expression.push(stop.zoom, stop.value);
  }
  return expression;
}

// Validate a comma-separated dash/gap list for line entries (`2,2`, `5,10`).
// Returns the trimmed normalized string, or undefined for empty input. Throws
// on non-numeric parts.
export function parseVectorTileDashArray(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parts = value.split(',').map(part => part.trim());
  if (parts.some(part => part === '' || !Number.isFinite(Number(part)))) {
    throw new Error(`Invalid dashArray "${value}". Expected comma-separated dash and gap lengths, e.g. 2,2.`);
  }
  return parts.join(',');
}

// MapLibre filter expression, e.g. `['==', ['get', 'index'], 1]`.
export type VectorTileFilter = unknown[];

export interface VectorTileOverlay {
  type: 'vector-tile';
  source: string;
  // TileJSON document, not a tile template.
  url?: string;
  // Tile URL templates, e.g. https://host/{z}/{x}/{y}.pbf.
  tiles?: string[];
  sourceLayer: string;
  layerType: VectorTileLayerType;
  zoom?: ZoomRange;
  bounds?: [number, number, number, number];
  attribution?: string;
  // MapLibre filter expression restricting which features render (compiled from the filter DSL).
  filter?: VectorTileFilter;
  // Symbol layers: feature property to label with (rendered via ["get", textField]).
  textField?: string;
  // Defaults to line (contour-style labels).
  symbolPlacement?: 'point' | 'line' | 'line-center';
  // Symbol layers: external sprite sheet URL (base URL without .json/.png suffix).
  sprite?: string;
  // Symbol layers: sprite image name rendered at each feature.
  icon?: string;
  style?: OverlayRenderStyle;
  // Partial style applied to the individual feature under the pointer.
  hoverStyle?: OverlayRenderStyle;
}

// The fields of a vector tile overlay that reach the GL SOURCE spec (not its layers).
export interface VectorTileSourceDefinition {
  url?: string;
  tiles?: readonly string[];
  bounds?: readonly [number, number, number, number];
  attribution?: string;
}

// Entries with equal signatures share one GL source. Entry visibility zoom is
// deliberately absent: it applies to the layer only.
export function getVectorTileOverlaySourceSignature(overlay: VectorTileSourceDefinition): string {
  return JSON.stringify([overlay.url ?? null, overlay.tiles ?? null, overlay.bounds ?? null, overlay.attribution ?? null]);
}

// Deterministic GL source id shared by all entries with an identical source definition.
export function createVectorTileOverlaySourceId(overlay: VectorTileSourceDefinition): string {
  return `vector-tile-overlay-src-${hashString36(getVectorTileOverlaySourceSignature(overlay))}`;
}

const FILTER_OPERATORS = ['==', '!=', '>=', '<=', '>', '<'] as const;

function parseVectorFilterValue(raw: string): string | number | boolean {
  const value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return value !== '' && Number.isFinite(numeric) ? numeric : value;
}

function parseVectorFilterClause(clause: string): VectorTileFilter | undefined {
  for (const op of FILTER_OPERATORS) {
    const index = clause.indexOf(op);
    if (index <= 0) continue;
    const property = clause.slice(0, index).trim();
    const rawValue = clause.slice(index + op.length).trim();
    if (!/^[\w:.-]+$/.test(property) || rawValue === '') continue;
    return [op, ['get', property], parseVectorFilterValue(rawValue)];
  }
  const bare = clause.trim();
  return /^[\w:.-]+$/.test(bare) ? ['has', bare] : undefined;
}

// Compile a filter DSL into a MapLibre filter expression. Supports
// comparisons (`==`, `!=`, `>`, `<`, `>=`, `<=`) between a feature property and a
// literal (number, quoted string, or true/false), joined with `AND`; a bare
// property name matches features that have it. Returns undefined if any clause is
// malformed.
//   `index == 1`                  -> `['==', ['get','index'], 1]`
//   `ele >= 1000 AND ele <= 3000` -> `['all', [...], [...]]`
export function parseVectorTileFilter(input: string): VectorTileFilter | undefined {
  const clauses = input.split(/\s+AND\s+/i).map(part => part.trim()).filter(Boolean);
  if (clauses.length === 0) return undefined;
  const compiled: VectorTileFilter[] = [];
  for (const clause of clauses) {
    const expression = parseVectorFilterClause(clause);
    if (!expression) return undefined;
    compiled.push(expression);
  }
  return compiled.length === 1 ? compiled[0] : ['all', ...compiled];
}

export type Overlay = GeoJSONOverlay | ImageOverlay | VectorTileOverlay;

export interface OverlayResult {
  overlays: Overlay[];
  errors: Array<{ path: string; error: string }>;
}

export function isGeoJSONOverlay(overlay: Overlay): overlay is GeoJSONOverlay {
  return overlay.type === 'geojson';
}

export function isImageOverlay(overlay: Overlay): overlay is ImageOverlay {
  return overlay.type === 'image';
}

export function isVectorTileOverlay(overlay: Overlay): overlay is VectorTileOverlay {
  return overlay.type === 'vector-tile';
}

export interface OverlayBoundsExtensionResult {
  overlays: readonly Overlay[];
}

export function extendBoundingBoxWithOverlays(boundingBox: PlacesBoundingBox, overlays: readonly Overlay[]): OverlayBoundsExtensionResult {
  for (const overlay of overlays) {
      if (isGeoJSONOverlay(overlay) && overlay.geojson) {
        const overlayBounds = PlacesBoundingBox.fromGeoJSON(overlay.geojson);
        if (overlayBounds.isValid()) {
          boundingBox.extend(overlayBounds);
        }
      } else if (isImageOverlay(overlay)) {
        if (overlay.bounds) {
          boundingBox.update(overlay.bounds.swLat, overlay.bounds.swLng);
          boundingBox.update(overlay.bounds.neLat, overlay.bounds.neLng);
        } else if (overlay.corners) {
          boundingBox.update(overlay.corners.nwLat, overlay.corners.nwLng);
          boundingBox.update(overlay.corners.neLat, overlay.corners.neLng);
          boundingBox.update(overlay.corners.seLat, overlay.corners.seLng);
          boundingBox.update(overlay.corners.swLat, overlay.corners.swLng);
        }
      } else if (isVectorTileOverlay(overlay) && overlay.bounds) {
        const [west, south, east, north] = overlay.bounds;
        boundingBox.update(south, west);
        boundingBox.update(north, east);
      }
  }
  return { overlays };
}

export function extractOverlayPointFeatures(overlays: readonly Overlay[]): GeoJSON.Feature[] {
  const overlayFeatures: GeoJSON.Feature[] = [];

  for (const overlay of overlays) {
    if (!isGeoJSONOverlay(overlay) || !overlay.geojson) continue;

    overlayFeatures.push(...extractPointFeatures(overlay.geojson, overlay.source));
  }

  return overlayFeatures;
}

function extractPointFeatures(geojson: GeoJSON.GeoJSON, source: string): GeoJSON.Feature[] {
  const points: GeoJSON.Feature[] = [];
  for (const feature of getGeoJsonFeatures(geojson)) {
    const properties = {
      ...feature.properties,
      _isOverlayPoint: true,
      _overlaySource: source,
    };
    if (feature.geometry?.type === 'Point') {
      points.push({ ...feature, properties });
    } else if (feature.geometry?.type === 'MultiPoint') {
      feature.geometry.coordinates.forEach((coordinates, index) => {
        points.push({
          ...feature,
          id: feature.id === undefined ? undefined : `${String(feature.id)}:${index}`,
          properties,
          geometry: { type: 'Point', coordinates },
        });
      });
    }
  }
  return points;
}

export function extractGeoJsonLineLatLngCoordinates(geojson: GeoJSON.GeoJSON): Array<[number, number]> {
  const coords: Array<[number, number]> = [];

  for (const feature of getGeoJsonFeatures(geojson)) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'LineString') {
      for (const coord of geometry.coordinates) {
        coords.push([coord[1], coord[0]]);
      }
    } else if (geometry.type === 'MultiLineString') {
      for (const line of geometry.coordinates) {
        for (const coord of line) {
          coords.push([coord[1], coord[0]]);
        }
      }
    }
  }

  return coords;
}

export function getGeoJsonFeatures(geojson: GeoJSON.GeoJSON): GeoJSON.Feature[] {
  if (geojson.type === 'FeatureCollection') {
    return [...geojson.features];
  }
  if (geojson.type === 'Feature') {
    return [geojson];
  }
  return [{
    type: 'Feature',
    properties: {},
    geometry: geojson
  }];
}

// Styling for note-backed tracks. Code-block overlays use OverlayRenderStyle.
export interface TrackOverlayStyle {
  color?: string;
  fillColor?: string;
  weight?: number;
  opacity?: number; //0-1
  fillOpacity?: number; //0-1
  style?: 'solid' | 'dashed';
  dashArray?: string;
  outline?: boolean;
  outlineColor?: string;
  outlineWeight?: number;
  outlineOpacity?: number;
  colorBy?: string;
  [key: string]: unknown;
}
