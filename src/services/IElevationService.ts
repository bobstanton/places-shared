import { Meters } from '../Units';
import { Coordinate } from '../geo/DistanceCalculator';

export interface ElevationPoint {
  latitude: number;
  longitude: number;
  elevation: Meters;
  distance: Meters;
}

export interface ElevationProfile {
  points: ElevationPoint[];
  totalDistance: Meters;
  elevationGain: Meters;
  elevationLoss: Meters;
  minElevation: Meters;
  maxElevation: Meters;
}

export interface IElevationService {
  getElevationProfile(coordinates: Coordinate[]): Promise<ElevationProfile>;
  getProviderName(): string;
}