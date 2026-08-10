export type Kilometers = number & {
    __brand: 'km';
};
export type Miles = number & {
    __brand: 'miles';
};
export type Meters = number & {
    __brand: 'm';
};
export type Feet = number & {
    __brand: 'ft';
};
export type Hours = number & {
    __brand: 'hours';
};
export type Minutes = number & {
    __brand: 'minutes';
};
export type Seconds = number & {
    __brand: 'seconds';
};
export type KilometersPerHour = number & {
    __brand: 'km/h';
};
export type MilesPerHour = number & {
    __brand: 'mph';
};
export type MinutesPerKilometer = number & {
    __brand: 'min/km';
};
export type MinutesPerMile = number & {
    __brand: 'min/mile';
};
export type Grade = number & {
    __brand: 'grade%';
};
export type Distance = Kilometers | Miles | Meters | Feet;
export type Speed = KilometersPerHour | MilesPerHour;
export type Pace = MinutesPerKilometer | MinutesPerMile;
export type Time = Hours | Minutes | Seconds;
export type UnitsSystem = "imperial" | "metric";
export declare const km: (value: number) => Kilometers;
export declare const miles: (value: number) => Miles;
export declare const meters: (value: number) => Meters;
export declare const feet: (value: number) => Feet;
export declare const hours: (value: number) => Hours;
export declare const minutes: (value: number) => Minutes;
export declare const seconds: (value: number) => Seconds;
export declare const kph: (value: number) => KilometersPerHour;
export declare const mph: (value: number) => MilesPerHour;
export declare const minPerKm: (value: number) => MinutesPerKilometer;
export declare const minPerMile: (value: number) => MinutesPerMile;
export declare const kmToMeters: (k: Kilometers) => Meters;
export declare const metersToKm: (m: Meters) => Kilometers;
export declare const kmToMiles: (k: Kilometers) => Miles;
export declare const milesToKm: (m: Miles) => Kilometers;
export declare const metersToFeet: (m: Meters) => Feet;
export declare const feetToMeters: (f: Feet) => Meters;
export declare const milesToFeet: (m: Miles) => Feet;
export declare const feetToMiles: (f: Feet) => Miles;
export declare const hoursToMinutes: (h: Hours) => Minutes;
export declare const minutesToHours: (m: Minutes) => Hours;
export declare const hoursToSeconds: (h: Hours) => Seconds;
export declare const secondsToHours: (s: Seconds) => Hours;
export declare const minutesToSeconds: (m: Minutes) => Seconds;
export declare const secondsToMinutes: (s: Seconds) => Minutes;
export declare const kphToMph: (speed: KilometersPerHour) => MilesPerHour;
export declare const mphToKph: (speed: MilesPerHour) => KilometersPerHour;
export declare const minPerKmToMinPerMile: (pace: MinutesPerKilometer) => MinutesPerMile;
export declare const minPerMileToMinPerKm: (pace: MinutesPerMile) => MinutesPerKilometer;
export declare const convertDistance: (value: Kilometers, toSystem: UnitsSystem) => Kilometers | Miles;
export declare const convertSpeed: (value: KilometersPerHour, toSystem: UnitsSystem) => KilometersPerHour | MilesPerHour;
export declare const convertElevation: (value: Meters, toSystem: UnitsSystem) => Meters | Feet;
export declare const convertPace: (value: MinutesPerKilometer, toSystem: UnitsSystem) => MinutesPerKilometer | MinutesPerMile;
export interface UnitInfo {
    name: string;
    abbreviation: string;
    system: UnitsSystem;
}
export declare const getDistanceUnit: (system: UnitsSystem) => UnitInfo;
export declare const getSpeedUnit: (system: UnitsSystem) => UnitInfo;
export declare const getElevationUnit: (system: UnitsSystem) => UnitInfo;
export declare const getPaceUnit: (system: UnitsSystem) => UnitInfo;
export declare const formatKmInSystem: (distance: Kilometers, system: UnitsSystem, decimals?: number) => string;
export declare const formatMetersInSystem: (elevation: Meters, system: UnitsSystem, decimals?: number) => string;
export declare const formatKphInSystem: (speed: KilometersPerHour, system: UnitsSystem, decimals?: number) => string;
export declare const formatMinPerKmInSystem: (pace: MinutesPerKilometer, system: UnitsSystem) => string;
export declare const calculateSpeed: (distance: Kilometers, time: Hours) => KilometersPerHour;
export declare const calculatePace: (time: Minutes, distance: Kilometers) => MinutesPerKilometer;
export declare const calculateDuration: (distance: Kilometers, pace: MinutesPerKilometer) => Minutes;
export declare const getDistanceLabel: (system: UnitsSystem) => string;
export declare const getSpeedLabel: (system: UnitsSystem) => string;
export declare const getElevationLabel: (system: UnitsSystem) => string;
export declare const getPaceLabel: (system: UnitsSystem) => string;
