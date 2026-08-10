import { UnitsSystem, Meters, Kilometers } from '../Units';
export { parseCoordinate, parseCoordinateList, parseNamedCoordinate, type NamedCoordinate } from '../geo/CoordinateParser';
export declare function parseBoolean(value: unknown, defaultValue: boolean): boolean;
export declare function parseBooleanOptional(value: unknown): boolean | undefined;
export declare function parseNumber(value: unknown, defaultValue: number): number;
export declare function parsePositiveInt(value: unknown): number | undefined;
export declare function parsePositiveFloat(value: unknown): number | undefined;
export declare function parseOpacity(value: unknown): number | undefined;
export declare function parseEnum<T extends string>(value: unknown, validValues: readonly T[]): T | undefined;
export declare function parseEnumWithDefault<T extends string>(value: unknown, validValues: readonly T[], defaultValue: T): T;
export declare function normalizePercentage(value: number): number;
export declare function parseStringOptional(value: unknown): string | undefined;
export declare function parseString(value: unknown, defaultValue: string): string;
export declare function parseShortDistanceAsMeters(value: unknown, units: UnitsSystem): Meters | undefined;
export declare function parseLongDistanceAsKilometers(value: unknown, units: UnitsSystem): Kilometers | undefined;
export declare function parseDistanceStringAsKilometers(value: unknown): Kilometers | undefined;
export declare function parseIntWithBounds(value: unknown, defaultValue: number, min?: number, max?: number): number;
export declare function parseList(value: unknown): string[];
export interface ParsedTime {
    hour: number;
    offset?: number;
    isRelative: boolean;
}
export declare function parseTime(value: unknown): ParsedTime | undefined;
export declare function conditionalProps<T extends Record<string, unknown>>(entries: Record<string, unknown>): Partial<T>;
