import { Coordinate } from '../geo/DistanceCalculator';
import type { RouteTravelMode } from './IRouteOverlayService';
import type { UnitsSystem } from '../Units';

// A point to snap. `time` is the fix's own timestamp, when the track recorded one.
export interface SnapPoint extends Coordinate {
  time?: Date;
}

// Valhalla's matching strategies. `map_snap` searches for the best candidate
// way near each point; `edge_walk` assumes the trace already follows the graph
// and is both faster and more faithful for a route that came out of a routing
// engine; `walk_or_snap` tries the walk first and falls back.
export type SnapShapeMatch = 'map_snap' | 'edge_walk' | 'walk_or_snap';

// Way classes a match can be kept off. Mapbox names these; Valhalla expresses the same intent through costing options.
export type SnapExclusion = 'motorway' | 'toll' | 'ferry';

export interface SnapRequest {
  points: SnapPoint[];
  // Portable travel mode. Each provider maps it to its own profile.
  mode: RouteTravelMode;
  // Valhalla costing name, overriding the one `mode` resolves to. Reaches
  // costings `mode` cannot express (truck, bus, motor_scooter). Valhalla-based
  // providers only. Named as Valhalla names it: `costing` is the model, never
  // its options.
  costing?: string;
  // Options for the effective costing, passed through verbatim. Named for
  // Valhalla's own `costing_options`, the only snap API that has them: they
  // bias which candidate way wins without restricting the graph.
  costingOptions?: Record<string, unknown>;
  // Search radius in meters around each point; providers use their own default when absent.
  radiusMeters?: number;
  // Send each point's recorded timestamp. Matching engines use elapsed time to
  // rule out candidates the trace could not physically have reached. Defaults
  // to on whenever the points carry times.
  timestamps?: boolean;
  // Mapbox: collapse near-duplicate and stationary points before matching.
  tidy?: boolean;
  // Way classes to keep the match off.
  exclude?: SnapExclusion[];
  // Valhalla matching strategy. Defaults to `map_snap`.
  shapeMatch?: SnapShapeMatch;
  // Valhalla `trace_options`, passed through verbatim: `search_radius`,
  // `gps_accuracy`, `breakage_distance`, `turn_penalty_factor`. These tune the
  // matcher itself rather than the cost model.
  traceOptions?: Record<string, unknown>;
  // The vault's unit system: a bare distance in `traceOptions` means what it
  // means everywhere else in the block. Default metric.
  units?: UnitsSystem;
  // Valhalla edge attributes to return, as its own `filters.attributes` keys
  // (`edge.names`, `edge.surface`, `edge.road_class`, `edge.use`). Requesting
  // any of them turns the filter on; the keys Places needs to align points
  // with edges are always added.
  attributes?: string[];
}

export interface SnappedPoint {
  latitude: number;
  longitude: number;
  // False when the provider found no road within the radius; the original point is kept.
  snapped: boolean;
  // Index into `SnapResult.edges` for the way this point matched, when edge attributes were requested.
  edgeIndex?: number;
}

// One way the match ran along, as far as the requested attributes describe it.
export interface SnapMatchedEdge {
  // Every name the way carries. Empty for an unnamed way, which is common on trails.
  names?: string[];
  // OSM surface as Valhalla classifies it: paved, gravel, dirt, and the rest.
  surface?: string;
  roadClass?: string;
  // Valhalla's edge use: road, track, footway, cycleway, steps.
  use?: string;
}

export interface SnapResult {
  // One per input point, in input order: elevation and timestamps carry over by index.
  points: SnappedPoint[];
  // The matched path as the provider drew it, following the way geometry
  // rather than the input points. NOT positionally related to `points`: it has
  // its own vertex count, and per-point elevation and time cannot ride along.
  // Absent when the provider returns no geometry.
  geometry?: Coordinate[];
  // The ways the match ran along, in path order. Present only when edge attributes were requested.
  edges?: SnapMatchedEdge[];
}

// Implementations must return one point per input point, in input order.
export interface ISnapService {
  getProviderName(): string;
  // Maximum points accepted by one logical snap request, when provider-limited.
  getMaxPointCount?(): number;
  snapPoints(request: SnapRequest): Promise<SnapResult>;
  // Why parts of this request cannot be honored, for the caller to surface.
  // Empty means everything asked for is supported. Implemented by providers
  // whose API has no counterpart for an option the block accepts.
  describeUnsupportedRequest?(request: SnapRequest): string[];
}

export function shouldSendTimestamps(request: SnapRequest): boolean {
  return request.timestamps !== false && request.points.some(point => point.time instanceof Date);
}

// Anything absent is reported to the caller as ignored.
export interface SnapOptionSupport {
  costing?: boolean;
  costingOptions?: boolean;
  timestamps?: boolean;
  tidy?: boolean;
  exclude?: boolean;
  shapeMatch?: boolean;
  traceOptions?: boolean;
  attributes?: boolean;
}

export function describeUnsupportedSnapOptions(providerDisplayName: string, request: SnapRequest, supported: SnapOptionSupport): string[] {
  const note = (option: string, alternative: string): string =>
    `${providerDisplayName} has no ${option} in its snapping API, so it was ignored. ${alternative}`;
  const unsupported: string[] = [];

  if (request.costing && !supported.costing) unsupported.push(note('costing name', 'Use mode instead; costing names are Valhalla-only.'));
  if (request.costingOptions && Object.keys(request.costingOptions).length > 0 && !supported.costingOptions) {
    unsupported.push(note('costing options', 'Only Valhalla-based providers accept them.'));
  }
  if (request.timestamps === true && !supported.timestamps) unsupported.push(note('timestamp input', 'Matching here uses geometry alone.'));
  if (request.tidy && !supported.tidy) unsupported.push(note('tidy option', 'Only Mapbox collapses near-duplicate points before matching.'));
  if (request.exclude?.length && !supported.exclude) {
    unsupported.push(note('exclude list', 'Valhalla-based providers express the same intent through costingOptions (use_ferry, use_tolls).'));
  }
  if (request.shapeMatch && !supported.shapeMatch) unsupported.push(note('shape match strategy', 'Only Valhalla-based providers choose a matching strategy.'));
  if (request.traceOptions && Object.keys(request.traceOptions).length > 0 && !supported.traceOptions) {
    unsupported.push(note('trace options', 'Self-hosted Valhalla and FreeRoute accept them; the Stadia trace-attributes API does not.'));
  }
  if (request.attributes?.length && !supported.attributes) unsupported.push(note('edge attributes', 'Only Valhalla-based providers return per-way details.'));
  return unsupported;
}
