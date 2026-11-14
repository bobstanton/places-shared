import { DistanceCalculator, type Coordinate } from '../geo/index';
import { ElevationAccumulator } from '../geo/index';
import { type Meters, meters } from '../units/index';
import { type ElevationPoint, type ElevationProfile, type IElevationService } from './index';
import type { IPlaceExtensionSettings } from '../settings/index';

export abstract class ElevationServiceBase implements IElevationService {
  protected constructor(protected extensionSettings: IPlaceExtensionSettings) {}

  abstract getProviderName(): string;

  async getElevationProfile(coordinates: Coordinate[]): Promise<ElevationProfile> {
    this.assertApiKeyConfigured();

    if (coordinates.length === 0) {
      throw new Error("Empty polyline provided");
    }

    const elevations = await this.getElevationForPoints(coordinates);

    this.validateElevationResults(coordinates, elevations);

    return ElevationServiceBase.buildElevationProfile(coordinates, elevations);
  }

  protected abstract getElevationForPoints(coordinates: Coordinate[]): Promise<Meters[]>;

  private validateElevationResults(coordinates: Coordinate[], elevations: Meters[]): void {
    if (elevations.length !== coordinates.length) {
      throw new Error(`Elevation provider returned ${elevations.length} elevations for ${coordinates.length} coordinates`);
    }

    const invalidIndex = elevations.findIndex((elevation) => !Number.isFinite(elevation));

    if (invalidIndex !== -1) {
      throw new Error(`Elevation provider returned an invalid elevation at point ${invalidIndex + 1}`);
    }
  }

  protected assertApiKeyConfigured(): void {
    if (!this.extensionSettings.apiKey || !this.extensionSettings.apiKey.trim()) {
      throw new Error(`${this.getProviderDisplayName()} API key not configured`);
    }
  }

  protected getProviderDisplayName(): string {
    return this.getProviderName();
  }

  static buildElevationProfile(coordinates: Coordinate[], elevations: Meters[]): ElevationProfile {
    const points: ElevationPoint[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < coordinates.length; i++) {
      if (i > 0) {
        const prevCoord = coordinates[i - 1];
        const currCoord = coordinates[i];

        cumulativeDistance += DistanceCalculator.haversineDistanceMeters(
          prevCoord.latitude, prevCoord.longitude,
          currCoord.latitude, currCoord.longitude
        );
      }

      points.push({
        latitude: coordinates[i].latitude,
        longitude: coordinates[i].longitude,
        elevation: elevations[i],
        distance: meters(cumulativeDistance)
      });
    }

    const elevationValues = elevations.filter(e => !isNaN(e));
    const minElevation = elevationValues.length > 0 ? Math.min(...elevationValues) : 0;
    const maxElevation = elevationValues.length > 0 ? Math.max(...elevationValues) : 0;

    const elevation = new ElevationAccumulator();

    for (const value of elevations) elevation.add(value);

    return {
      points,
      totalDistance: meters(cumulativeDistance),
      elevationGain: meters(elevation.gainM),
      elevationLoss: meters(elevation.lossM),
      minElevation: meters(minElevation),
      maxElevation: meters(maxElevation)
    };
  }
}
