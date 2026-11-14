import type { Coordinate } from './DistanceCalculator';
import { coerceScalarString } from '../utils/Utilities';

export interface NamedCoordinate extends Coordinate {
  name?: string;
}

// Parse a latitude/longitude pair with an optional display name.
// - `41.408, -75.662`
// - `Home: 41.408, -75.662`
export function parseNamedCoordinate(value: unknown): NamedCoordinate | null {
  if (value === undefined || value === null || value === '') return null;

  const locationString = coerceScalarString(value).trim();
  const match = locationString.match(/^(?:(.+?):\s*)?(-?(?:\d+(?:\.\d*)?|\.\d+)),\s*(-?(?:\d+(?:\.\d*)?|\.\d+))$/);

  if (!match) return null;

  const latitude = Number(match[2]);
  const longitude = Number(match[3]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const name = match[1]?.trim();

  return name ? { latitude, longitude, name } : { latitude, longitude };
}

// GeoJSON's order is [longitude, latitude], Place's order is [latitude, longitude]
export function coordinateFromPosition(position: readonly number[]): Coordinate {
  return { latitude: position[1], longitude: position[0] };
}

// Parse coordinate and discard display name.
export function parseCoordinate(value: unknown): Coordinate | null {
  const coordinate = parseNamedCoordinate(value);

  return coordinate
    ? { latitude: coordinate.latitude, longitude: coordinate.longitude }
    : null;
}

// Parse semicolon-separated named coordinates, omitting invalid entries.
export function parseCoordinateList(value: unknown): NamedCoordinate[] {
  if (value === undefined || value === null || value === '') return [];

  const coordinates: NamedCoordinate[] = [];

  for (const part of coerceScalarString(value).split(';')) {
    const coordinate = parseNamedCoordinate(part.trim());

    if (coordinate) coordinates.push(coordinate);
  }

  return coordinates;
}
