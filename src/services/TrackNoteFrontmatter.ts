import type { Coordinate } from '../geo/DistanceCalculator';
import { formatDisplayCoordinate, Utilities } from '../utils/Utilities';
import { formatKmInSystem, formatKphInSystem, formatMetersInSystem, formatMinPerKmInSystem, type Kilometers, type KilometersPerHour, type Meters, type MinutesPerKilometer, type UnitsSystem } from '../Units';

// Everything a track note records about its track, in storage units. Every
// writer, whichever bundle it runs in, builds track frontmatter through this
// one type.
export interface TrackNoteFrontmatterInput {
  readonly distanceKm?: Kilometers;
  // First point of the track; omitted only when the track has no points.
  readonly startCoordinate?: Coordinate;
  readonly totalPoints?: number;
  readonly name?: string;
  readonly description?: string;
  // How many source tracks were merged into this note. Above one, the
  // per-track name and description describe only one of them, and both are
  // suppressed in favor of the count.
  readonly featureCount?: number;
  readonly durationSeconds?: number;
  readonly movingTimeSeconds?: number;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly averageSpeedKph?: KilometersPerHour;
  readonly maxSpeedKph?: KilometersPerHour;
  readonly averagePaceMinPerKm?: MinutesPerKilometer;
  readonly bestPaceMinPerKm?: MinutesPerKilometer;
  readonly elevationGainMeters?: Meters;
  readonly elevationLossMeters?: Meters;
  readonly minElevationMeters?: Meters;
  readonly maxElevationMeters?: Meters;
}

// The frontmatter fields a track note carries, formatted for display in the
// given unit system.
//
// `Max Speed` and `Best Pace` are emitted as `null` when absent rather than
// omitted: these notes are rewritten in place by the recalculation commands,
// and a field that is merely skipped keeps whatever stale value the previous
// run left behind.
//
// Overlay payload fields (`Overlay Source`, `Overlay Cache`) are NOT built
// here - they need compression and cache precompute, which are the caller's.
export function buildTrackNoteFrontmatter(input: TrackNoteFrontmatterInput, units: UnitsSystem): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};

  if (input.distanceKm !== undefined) frontmatter['Distance'] = formatKmInSystem(input.distanceKm, units);
  if (input.startCoordinate) frontmatter['Location'] = formatDisplayCoordinate(input.startCoordinate);
  if (input.totalPoints !== undefined) frontmatter['Total Points'] = input.totalPoints;

  const multiTrack = (input.featureCount ?? 0) > 1;

  if (multiTrack) {
    frontmatter['Feature Count'] = input.featureCount;
  } else {
    if (input.name) frontmatter['Track Name'] = input.name;
    if (input.description) frontmatter['Description'] = input.description;
  }

  if (input.durationSeconds) frontmatter['Duration'] = Utilities.formatDuration(input.durationSeconds);
  if (input.startTime) frontmatter['Start Time'] = input.startTime.toISOString();
  if (input.endTime) frontmatter['End Time'] = input.endTime.toISOString();
  if (input.averageSpeedKph) frontmatter['Average Speed'] = formatKphInSystem(input.averageSpeedKph, units);
  if (input.averagePaceMinPerKm) frontmatter['Average Pace'] = formatMinPerKmInSystem(input.averagePaceMinPerKm, units);
  if (input.movingTimeSeconds) frontmatter['Moving Time'] = Utilities.formatDuration(input.movingTimeSeconds, false);

  frontmatter['Max Speed'] = input.maxSpeedKph ? formatKphInSystem(input.maxSpeedKph, units) : null;
  frontmatter['Best Pace'] = input.bestPaceMinPerKm ? formatMinPerKmInSystem(input.bestPaceMinPerKm, units) : null;

  // Gain and loss are magnitudes: zero means "flat", which is not worth a field.
  // Min and max are readings: zero is a real elevation.
  if (input.elevationGainMeters !== undefined && Number(input.elevationGainMeters) > 0) {
    frontmatter['Elevation Gain'] = formatMetersInSystem(input.elevationGainMeters, units);
  }

  if (input.elevationLossMeters !== undefined && Number(input.elevationLossMeters) > 0) {
    frontmatter['Elevation Loss'] = formatMetersInSystem(input.elevationLossMeters, units);
  }

  if (input.minElevationMeters !== undefined) {
    frontmatter['Min Elevation'] = formatMetersInSystem(input.minElevationMeters, units);
  }

  if (input.maxElevationMeters !== undefined) {
    frontmatter['Max Elevation'] = formatMetersInSystem(input.maxElevationMeters, units);
  }

  return frontmatter;
}

export function assignFrontmatter(target: Record<string, unknown>, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}
