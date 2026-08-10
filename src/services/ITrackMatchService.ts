import { Coordinate } from "../geo/DistanceCalculator";
import { type Kilometers } from "../Units";

// Determines which parts of the network the matcher considers (trails and footways need `pedestrian`).
export type TrackMatchCosting = 'pedestrian' | 'bicycle' | 'auto';

// A named way the track travels along, aggregated across every matched edge
// that carries the name.
export interface MatchedWay {
  // Primary name of the way (e.g., "Gorge Trail", "Cades Cove Loop Rd").
  name: string;
  // Total matched length on this way in kilometers.
  lengthKm: Kilometers;
  // Fraction (0-1) of the total matched track length spent on this way.
  coverage: number;
  // Normalized way use of the longest contributing edge (footway, cycleway, path, road, ...).
  use?: string;
  // Surface of the longest contributing edge (paved, gravel, dirt, ...).
  surface?: string;
  // Road class of the longest contributing edge (motorway ... service_other).
  roadClass?: string;
  // Where along the track (0-1) this way is first traversed.
  startFraction?: number;
  // Matched geometry on this way: one coordinate run per contiguous stretch of
  // edges, in traversal order. Present when the provider returned the matched shape.
  segments?: Coordinate[][];
}

export interface TrackMatchResult {
  // Named ways in order of first traversal. Unnamed edges contribute to totalLengthKm only.
  ways: MatchedWay[];
  // Total matched track length in kilometers, named and unnamed edges included.
  totalLengthKm: Kilometers;
  provider: string;
}

export interface TrackMatchOptions {
  // Travel profile (default: pedestrian).
  costing?: TrackMatchCosting;
}

// Map-matches the whole track in a single request.
export interface ITrackMatchService {
  readonly providerId: string;

  readonly displayName: string;

  // @param coordinates Ordered track coordinates (implementations downsample as needed)
  matchTrack(coordinates: Coordinate[], options?: TrackMatchOptions): Promise<TrackMatchResult>;

  isAvailable(): boolean;
}
