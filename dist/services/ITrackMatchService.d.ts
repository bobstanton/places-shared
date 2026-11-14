import { Coordinate } from "../geo/DistanceCalculator";
import { type Kilometers } from "../Units";
export type TrackMatchCosting = 'pedestrian' | 'bicycle' | 'auto';
export interface MatchedWay {
    name: string;
    lengthKm: Kilometers;
    coverage: number;
    use?: string;
    surface?: string;
    roadClass?: string;
    startFraction?: number;
    segments?: Coordinate[][];
}
export interface TrackMatchResult {
    ways: MatchedWay[];
    totalLengthKm: Kilometers;
    provider: string;
}
export interface TrackMatchOptions {
    costing?: TrackMatchCosting;
}
export interface ITrackMatchService {
    readonly providerId: string;
    readonly displayName: string;
    matchTrack(coordinates: Coordinate[], options?: TrackMatchOptions): Promise<TrackMatchResult>;
    isAvailable(): boolean;
}
