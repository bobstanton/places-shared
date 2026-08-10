import type { Coordinate } from '../geo/DistanceCalculator';
import { PolylineCodec } from '../track/PolylineCodec';
import { formatProviderResponseShapeError } from './ProviderApiError';
import { type SnapMatchedEdge, type SnapRequest, type SnapResult, type SnappedPoint, shouldSendTimestamps } from './ISnapService';
import { parseShortDistanceAsMeters } from '../settings/ParseHelpers';
import type { UnitsSystem } from '../Units';
import { mapTravelMode } from './ProviderServiceHelpers';
import type { ValhallaTraceEdge } from './ValhallaTraceMatch';

const REQUIRED_TRACE_ATTRIBUTES = ['matched.point', 'matched.type', 'matched.edge_index', 'shape'] as const;
const TRACE_OPTION_DISTANCE_KEYS = new Set(['search_radius', 'gps_accuracy', 'breakage_distance', 'interpolation_distance']);

export function normalizeTraceOptions(traceOptions: Record<string, unknown> | undefined, units: UnitsSystem): Record<string, unknown> | undefined {
  if (!traceOptions || Object.keys(traceOptions).length === 0) return undefined;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(traceOptions)) {
    if (!TRACE_OPTION_DISTANCE_KEYS.has(key)) {
      normalized[key] = value;
      continue;
    }
    const metres = parseShortDistanceAsMeters(value, units);
    normalized[key] = metres === undefined ? value : Number(Number(metres).toFixed(3));
  }
  return normalized;
}

// Valhalla takes epoch seconds, not milliseconds.
function toEpochSeconds(time: Date): number {
  return Math.round(time.getTime() / 1000);
}

export function buildValhallaTraceBody(request: SnapRequest, costings: { walk: string; bike: string; drive: string }, units: UnitsSystem = 'metric'): Record<string, unknown> {
  const costing: string = request.costing ?? mapTravelMode(request.mode, costings);
  const sendTimes = shouldSendTimestamps(request);

  return {
    shape: request.points.map((point) => ({
      lat: point.latitude,
      lon: point.longitude,
      ...(request.radiusMeters !== undefined ? { radius: request.radiusMeters } : {}),
      ...(sendTimes && point.time ? { time: toEpochSeconds(point.time) } : {}),
    })),
    costing,
    shape_match: request.shapeMatch ?? 'map_snap',
    ...(request.costingOptions && Object.keys(request.costingOptions).length > 0
      ? { costing_options: { [costing]: request.costingOptions } }
      : {}),
    ...(() => {
      const traceOptions = normalizeTraceOptions(request.traceOptions, units);
      return traceOptions ? { trace_options: traceOptions } : {};
    })(),
    ...buildAttributeFilter(request.attributes),
  };
}

// Valhalla's own `filters` block, with the internally required keys folded in.
export function buildAttributeFilter(attributes: string[] | undefined): Record<string, unknown> {
  if (!attributes?.length) return {};
  const requested = new Set<string>([...REQUIRED_TRACE_ATTRIBUTES, ...attributes]);
  return { filters: { attributes: [...requested], action: 'include' } };
}

export interface ValhallaMatchedPoint {
  lat?: number;
  lon?: number;
  type?: string;
  edge_index?: number;
}

export interface SnapResultInput {
  provider: string;
  request: SnapRequest;
  matched: ValhallaMatchedPoint[] | undefined;
  // Polyline6 of the matched path, when the provider returned one.
  encodedShape?: string;
  edges?: ValhallaTraceEdge[];
}

// Turns a Valhalla trace response into the shared result: one point per input
// point, plus the matched way geometry when the provider sent it.
export function toSnapResult(input: SnapResultInput): SnapResult {
  const { provider, request, matched } = input;
  if (!Array.isArray(matched) || matched.length !== request.points.length) {
    throw new Error(formatProviderResponseShapeError({
      provider,
      operation: 'snap',
      expected: 'matched points',
      expectedCount: request.points.length,
      receivedCount: Array.isArray(matched) ? matched.length : 0,
      requestSummary: `${request.mode}, ${request.points.length} points`,
    }));
  }

  return {
    points: matched.map((point, index) => toSnappedOrOriginal(point, request.points[index])),
    geometry: decodeMatchedShape(input.encodedShape),
    edges: toMatchedEdges(input.edges),
  };
}

// Only the attributes Places surfaces; the rest of a trace edge is left where it is.
function toMatchedEdges(edges: ValhallaTraceEdge[] | undefined): SnapMatchedEdge[] | undefined {
  if (!Array.isArray(edges) || edges.length === 0) return undefined;
  return edges.map(edge => ({
    names: Array.isArray(edge.names) && edge.names.length > 0 ? edge.names : undefined,
    surface: edge.surface,
    roadClass: edge.road_class,
    use: edge.use,
  }));
}

// The ways a match ran along, deduplicated in path order.
export function summarizeMatchedWayNames(edges: SnapMatchedEdge[] | undefined): string[] {
  const names: string[] = [];
  for (const edge of edges ?? []) {
    for (const name of edge.names ?? []) {
      if (name && name !== names[names.length - 1] && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

// Distinct surfaces the match crossed, in path order.
export function summarizeMatchedSurfaces(edges: SnapMatchedEdge[] | undefined): string[] {
  const surfaces: string[] = [];
  for (const edge of edges ?? []) {
    if (edge.surface && !surfaces.includes(edge.surface)) surfaces.push(edge.surface);
  }
  return surfaces;
}

function toSnappedOrOriginal(matched: ValhallaMatchedPoint, original: Coordinate): SnappedPoint {
  if (matched.type === 'unmatched' || !Number.isFinite(matched.lat) || !Number.isFinite(matched.lon)) {
    return { latitude: original.latitude, longitude: original.longitude, snapped: false };
  }
  return {
    latitude: matched.lat as number,
    longitude: matched.lon as number,
    snapped: true,
    ...(matched.edge_index !== undefined ? { edgeIndex: matched.edge_index } : {}),
  };
}

// Valhalla encodes trace shapes at precision 6, not the Google default of 5.
function decodeMatchedShape(encoded: string | undefined): Coordinate[] | undefined {
  if (!encoded) return undefined;
  const decoded = PolylineCodec.decode(encoded, 6);
  return decoded.length > 0 ? decoded : undefined;
}

// A matched path returned as GeoJSON positions ([lng, lat]) rather than an
// encoded polyline. Providers differ on LineString versus MultiLineString, and
// both are flattened; anything unrecognized yields no geometry rather than a
// throw.
export function toMatchedGeometry(coordinates: unknown): Coordinate[] | undefined {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return undefined;
  const entries = coordinates as unknown[];
  // A MultiLineString nests one level deeper than a LineString.
  const nested = Array.isArray(entries[0]) && Array.isArray((entries[0] as unknown[])[0]);
  const positions = nested ? (entries as unknown[][]).flat() : entries;
  const points = positions
    .filter((position): position is [number, number] => Array.isArray(position) && Number.isFinite(position[0]) && Number.isFinite(position[1]))
    .map(([longitude, latitude]) => ({ latitude, longitude }));
  return points.length > 0 ? points : undefined;
}
