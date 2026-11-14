import { type Meters, meters } from '../units/index';
import type { Coordinate } from '../geo/index';
import { ElevationServiceBase } from './ElevationServiceBase';

// Base class for elevation APIs that return coordinates as `[lon, lat, elevation]` tuples.
export abstract class LonLatElevationTupleServiceBase extends ElevationServiceBase {
  protected async getElevationForPoints(coordinates: Coordinate[]): Promise<Meters[]> {
    if (coordinates.length === 0) {
      return [];
    }

    const elevations: Meters[] = [];

    for (let i = 0; i < coordinates.length; i += this.getBatchSize()) {
      const batch = coordinates.slice(i, i + this.getBatchSize());
      const points = await this.fetchLonLatElevationTuples(batch);

      if (!Array.isArray(points)) {
        throw new Error(`Unexpected response format from ${this.getProviderDisplayName()} elevation API`);
      }

      for (const point of points) {
        if (!Array.isArray(point) || point.length < 3) {
          throw new Error(`Unexpected response format from ${this.getProviderDisplayName()} elevation API`);
        }

        elevations.push(meters(Number(point[2])));
      }
    }

    return elevations;
  }

  protected abstract fetchLonLatElevationTuples(coordinates: Coordinate[]): Promise<unknown>;

  protected abstract getBatchSize(): number;
}
