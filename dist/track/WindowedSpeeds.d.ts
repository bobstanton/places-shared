import { type Coordinate } from '../geo/DistanceCalculator';
import type { MetricWindow } from '../settings/MetricWindow';
export declare function calculateWindowedSpeeds(coordinates: Coordinate[], times: number[], window: MetricWindow, segmentDistances?: readonly number[]): Array<number | undefined>;
export declare function calculateWindowedSpeedsWork(coordinates: Coordinate[], times: number[], window: MetricWindow, segmentDistances?: readonly number[]): Generator<void, Array<number | undefined>>;
