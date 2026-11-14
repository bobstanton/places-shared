import { Coordinate } from "../geo/DistanceCalculator";
import { km } from "../Units";
import { MatchedWay, TrackMatchResult } from "./ITrackMatchService";

// Valhalla trace endpoints reject very large shapes; GPS tracks are downsampled evenly to this cap.
export const VALHALLA_MAX_SHAPE_POINTS = 1500;

// A matched edge in Valhalla's wire format (snake_case as returned by trace_attributes).
export interface ValhallaTraceEdge {
  names?: string[];
  // Edge length in request units (providers request km).
  length?: number;
  use?: string;
  surface?: string;
  road_class?: string;
  // Indices into the matched shape where this edge begins and ends.
  begin_shape_index?: number;
  end_shape_index?: number;
}

// Attribute whitelist keeping trace_attributes responses small. `shape` is the
// matched-path polyline the edge shape indices refer to; it carries the per-way
// geometry shown on the classify map.
export const VALHALLA_TRACE_EDGE_ATTRIBUTES = ["edge.names", "edge.length", "edge.use", "edge.surface", "edge.road_class", "edge.begin_shape_index", "edge.end_shape_index", "shape"];

// Valhalla map-match failure codes: the trace runs too far from any mapped path to snap.
export const VALHALLA_MATCH_FAILURE_CODES = new Set([442, 443, 444]);

// Evenly sample down to maxPoints, always keeping first and last.
export function downsampleTrackForTrace(coordinates: Coordinate[], maxPoints = VALHALLA_MAX_SHAPE_POINTS): Coordinate[] {
  if (coordinates.length <= maxPoints) return coordinates;

  const sampled: Coordinate[] = [];
  const step = (coordinates.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    sampled.push(coordinates[Math.round(i * step)]);
  }

  return sampled;
}

// Aggregate matched edges into named ways ordered by first traversal.
// @param shapePointCount Size of the request shape; enables startFraction (position along track).
// @param shapeCoords Decoded matched-path shape the edge indices refer to; enables per-way segments and exact startFraction.
export function aggregateTraceEdges(edges: ValhallaTraceEdge[], provider: string, shapePointCount?: number, shapeCoords?: Coordinate[]): TrackMatchResult {
  interface WayAccumulator {
    name: string;
    lengthKm: number;
    longestEdgeKm: number;
    use?: string;
    surface?: string;
    roadClass?: string;
    firstShapeIndex?: number;
    segments: Coordinate[][];
    // End index of the last accepted edge; the next edge starting there extends
    // the open segment instead of opening a parallel one.
    lastEndIndex?: number;
  }

  const byName = new Map<string, WayAccumulator>();
  const order: string[] = [];
  let totalKm = 0;

  for (const edge of edges) {
    const lengthKm = edge.length ?? 0;

    totalKm += lengthKm;

    const name = edge.names?.[0]?.trim();

    if (!name) continue;

    const key = name.toLowerCase();
    let acc = byName.get(key);

    if (!acc) {
      acc = { name, lengthKm: 0, longestEdgeKm: -1, segments: [] };
      byName.set(key, acc);
      order.push(key);
    }

    acc.lengthKm += lengthKm;

    if (edge.begin_shape_index !== undefined && (acc.firstShapeIndex === undefined || edge.begin_shape_index < acc.firstShapeIndex)) {
      acc.firstShapeIndex = edge.begin_shape_index;
    }

    if (lengthKm > acc.longestEdgeKm) {
      acc.longestEdgeKm = lengthKm;
      acc.use = edge.use;
      acc.surface = edge.surface;
      acc.roadClass = edge.road_class;
    }

    const begin = edge.begin_shape_index;
    const end = edge.end_shape_index;

    if (shapeCoords && begin !== undefined && end !== undefined && begin >= 0 && end > begin && end < shapeCoords.length) {
      if (acc.lastEndIndex === begin && acc.segments.length > 0) {
        acc.segments[acc.segments.length - 1].push(...shapeCoords.slice(begin + 1, end + 1));
      } else {
        acc.segments.push(shapeCoords.slice(begin, end + 1));
      }

      acc.lastEndIndex = end;
    }
  }

  // Edge shape indices refer to the matched shape when one was provided; the
  // request-shape size stands in when only the count is known.
  const fractionDenominator = shapeCoords && shapeCoords.length > 1 ? shapeCoords.length - 1 : shapePointCount && shapePointCount > 1 ? shapePointCount - 1 : undefined;
  const ways: MatchedWay[] = order.map(key => {
    const acc = byName.get(key)!;

    return {
      name: acc.name,
      lengthKm: km(acc.lengthKm),
      coverage: totalKm > 0 ? acc.lengthKm / totalKm : 0,
      use: acc.use,
      surface: acc.surface,
      roadClass: acc.roadClass,
      startFraction: fractionDenominator !== undefined && acc.firstShapeIndex !== undefined ? acc.firstShapeIndex / fractionDenominator : undefined,
      ...(acc.segments.length > 0 ? { segments: acc.segments } : {}),
    };
  });

  return { ways, totalLengthKm: km(totalKm), provider };
}

// Translate a Valhalla error response body into a user-facing Error. Match
// failures (off-network trace sections) get a terse message; everything else
// surfaces the server's own error text.
export function valhallaErrorFromBody(providerLabel: string, status: number, body: string): Error {
  let detail = body;

  try {
    // Valhalla errors are JSON: {"error_code":444,"error":"...","status_code":400,...}
    const parsed = JSON.parse(body) as { error?: string; error_code?: number };

    if (parsed.error_code !== undefined && VALHALLA_MATCH_FAILURE_CODES.has(parsed.error_code)) {
      return new Error("Track has sections away from mapped paths and could not be matched; way names are unavailable.");
    }

    detail = parsed.error ?? body;
  } catch {
    // Not JSON - keep the raw body
  }

  return new Error(`${providerLabel} trace_attributes failed (${status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
}
