import { type Meters } from '../Units';
import type { Coordinate } from '../geo/DistanceCalculator';
import { ElevationServiceBase } from './ElevationServiceBase';
export declare abstract class LonLatElevationTupleServiceBase extends ElevationServiceBase {
    protected getElevationForPoints(coordinates: Coordinate[]): Promise<Meters[]>;
    protected abstract fetchLonLatElevationTuples(coordinates: Coordinate[]): Promise<unknown>;
    protected abstract getBatchSize(): number;
}
