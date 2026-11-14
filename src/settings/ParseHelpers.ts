import { KM_PER_UNIT } from './MetricWindow';
import { UnitsSystem, Meters, Kilometers, meters, km, feet, miles, feetToMeters, milesToKm } from '../Units';
import { clamp, coerceScalarString } from '../utils/Utilities';
export { parseCoordinate, parseCoordinateList, parseNamedCoordinate, type NamedCoordinate } from '../geo/CoordinateParser';

export function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return defaultValue;
}

export function parseBooleanOptional(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  return undefined;
}

export function parseNumber(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);

    return isNaN(parsed) ? defaultValue : parsed;
  }

  return defaultValue;
}

export function parsePositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseInt(coerceScalarString(value));

  return !isNaN(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export function parsePositiveFloat(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : parseFloat(coerceScalarString(value));

  return !isNaN(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseOpacity(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value >= 0 && value <= 1 ? value : undefined;
  }

  const trimmed = coerceScalarString(value).trim();
  const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  const parsed = percentMatch ? Number(percentMatch[1]) / 100 : Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

export function parseEnum<T extends string>(value: unknown, validValues: readonly T[]): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const firstLine = coerceScalarString(value).split('\n')[0].trim();
  const normalized = firstLine.toLowerCase() as T;

  return validValues.includes(normalized) ? normalized : undefined;
}

export function parseEnumWithDefault<T extends string>(value: unknown, validValues: readonly T[], defaultValue: T): T {
  return parseEnum(value, validValues) ?? defaultValue;
}

export function normalizePercentage(value: number): number {
  if (value > 1) {
    return clamp(value, 0, 100) / 100;
  }

  return clamp(value, 0, 1);
}

export function parseStringOptional(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return coerceScalarString(value);
}

export function parseString(value: unknown, defaultValue: string): string {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return coerceScalarString(value);
}

// A short distance setting: `300` (in the vault's own units), or any explicit
// `300m` / `500ft` / `0.2mi` / `50yd`. An explicit unit wins over the units
// setting.
export function parseShortDistanceAsMeters(value: unknown, units: UnitsSystem): Meters | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number') {
    // An unrecognized unit is unset, not a bare number: parseFloat("0.2mi") is 0.2, a 20cm radius.
    const written = coerceScalarString(value).trim().toLowerCase().match(/^([\d.]+)\s*([a-z]+)$/);

    if (written) return convertWrittenDistance(Number(written[1]), written[2]);
  }

  const parsed = typeof value === 'number' ? value : parseFloat(coerceScalarString(value));

  if (isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return units === 'imperial' ? feetToMeters(feet(parsed)) : meters(parsed);
}

function convertWrittenDistance(amount: number, unit: string): Meters | undefined {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;

  for (const [pattern, kmPerUnit] of KM_PER_UNIT) {
    if (pattern.test(unit)) return meters(Number((amount * kmPerUnit * 1000).toFixed(6)));
  }

  return undefined;
}

export function parseLongDistanceAsKilometers(value: unknown, units: UnitsSystem): Kilometers | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'number') {
    const written = coerceScalarString(value).trim().toLowerCase().match(/^([\d.]+)\s*([a-z]+)$/);

    if (written) {
      const meters = convertWrittenDistance(Number(written[1]), written[2]);

      return meters === undefined ? undefined : km(Number(meters) / 1000);
    }
  }

  const parsed = typeof value === 'number' ? value : parseFloat(coerceScalarString(value));

  if (isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return units === 'imperial' ? milesToKm(miles(parsed)) : km(parsed);
}

export function parseDistanceStringAsKilometers(value: unknown): Kilometers | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const str = coerceScalarString(value).trim();
  const match = str.match(/^([\d.]+)\s*(km|mi|miles?)$/i);

  if (!match) {
    return undefined;
  }

  const numValue = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (isNaN(numValue) || numValue <= 0) {
    return undefined;
  }

  if (unit === 'mi' || unit === 'miles' || unit === 'mile') {
    return milesToKm(miles(numValue));
  }

  return km(numValue);
}

export function parseIntWithBounds(value: unknown, defaultValue: number, min?: number, max?: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  let parsed = typeof value === 'number' ? Math.floor(value) : parseInt(coerceScalarString(value), 10);

  if (isNaN(parsed)) {
    return defaultValue;
  }

  if (min !== undefined && parsed < min) parsed = min;
  if (max !== undefined && parsed > max) parsed = max;

  return parsed;
}

export function parseList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(item => coerceScalarString(item).trim()).filter(Boolean);
  }

  return coerceScalarString(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export interface ParsedTime {
  hour: number;
  offset?: number;
  isRelative: boolean;
}

export function parseTime(value: unknown): ParsedTime | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const str = coerceScalarString(value).trim().toLowerCase();

  const relativeMatch = str.match(/^(now)?([+-]\d+)h?$/);

  if (str === 'now' || relativeMatch) {
    const currentHour = new Date().getHours();

    if (str === 'now') {
      return { hour: currentHour, offset: 0, isRelative: true };
    }

    const offset = parseInt(relativeMatch![2], 10);
    let hour = (currentHour + offset) % 24;

    if (hour < 0) hour += 24;

    return { hour, offset, isRelative: true };
  }

  const isPM = str.includes('pm');
  const isAM = str.includes('am');
  const cleanStr = str.replace(/[ap]m/g, '').trim();

  let hour: number;

  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':');

    hour = parseInt(parts[0], 10);
  } else {
    hour = parseInt(cleanStr, 10);
  }

  if (isNaN(hour) || hour < 0 || hour > 23) {
    return undefined;
  }

  if (isPM && hour < 12) {
    hour += 12;
  } else if (isAM && hour === 12) {
    hour = 0;
  }

  return { hour, isRelative: false };
}

type ConditionalTuple = [condition: unknown, value: unknown];

function isConditionalTuple(entry: unknown): entry is ConditionalTuple {
  return Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'boolean';
}

export function conditionalProps<T extends Record<string, unknown>>(entries: Record<string, unknown>): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(entries)) {
    if (isConditionalTuple(entry)) {
      const [condition, value] = entry;

      if (condition) {
        result[key] = value;
      }
    } else {
      if (entry !== undefined && entry !== null) {
        result[key] = entry;
      }
    }
  }

  return result as Partial<T>;
}
