import { Hours, Kilometers, KilometersPerHour, Meters, MinutesPerKilometer } from '../Units';
import { Waypoint } from '../Place';

export interface TrackPoint {
  latitude: number;
  longitude: number;
  distanceKm: Kilometers;
  elevationMeters?: Meters;
  time?: Date;
  speedKph?: KilometersPerHour;
  paceMinPerKm?: MinutesPerKilometer;
}

export interface TrackMetrics {
  distance: Kilometers;
  elevationGain: Meters;
  elevationLoss: Meters;
  minElevation?: Meters;
  maxElevation?: Meters;
  duration?: Hours;
  averageSpeed?: KilometersPerHour;
  maxSpeed?: KilometersPerHour;
  averagePace?: MinutesPerKilometer;
  bestPace?: MinutesPerKilometer;
  movingTime?: Hours;
  stoppedTime?: Hours;
}

export interface TrackData {
  points: TrackPoint[];
  segments?: TrackPoint[][];
  metrics: TrackMetrics;
  waypoints: Waypoint[];
  metadata: {
    name?: string;
    description?: string;
    source: 'gpx' | 'polyline' | 'manual';
  };
}
