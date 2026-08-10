import { DistanceCalculator, type Coordinate } from '../geo/DistanceCalculator';
import { type Meters, meters } from '../Units';
import { type ElevationPoint, type ElevationProfile, type IElevationService } from './IElevationService';
import type { IPlaceExtensionSettings } from '../settings/PlacesPluginSettings';

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

    let elevationGain = 0;
    let elevationLoss = 0;

    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0) {
        elevationGain += diff;
      } else {
        elevationLoss += Math.abs(diff);
      }
    }

    return {
      points,
      totalDistance: meters(cumulativeDistance),
      elevationGain: meters(elevationGain),
      elevationLoss: meters(elevationLoss),
      minElevation: meters(minElevation),
      maxElevation: meters(maxElevation)
    };
  }
}
