export type Kilometers = number & { __brand: 'km' };
export type Miles = number & { __brand: 'miles' };
export type Meters = number & { __brand: 'm' };
export type Feet = number & { __brand: 'ft' };

export type Hours = number & { __brand: 'hours' };
export type Minutes = number & { __brand: 'minutes' };
export type Seconds = number & { __brand: 'seconds' };

export type KilometersPerHour = number & { __brand: 'km/h' };
export type MilesPerHour = number & { __brand: 'mph' };
export type MinutesPerKilometer = number & { __brand: 'min/km' };
export type MinutesPerMile = number & { __brand: 'min/mile' };

export type Grade = number & { __brand: 'grade%' };

export type Distance = Kilometers | Miles | Meters | Feet;
export type Speed = KilometersPerHour | MilesPerHour;
export type Pace = MinutesPerKilometer | MinutesPerMile;
export type Time = Hours | Minutes | Seconds;

export type UnitsSystem = "imperial" | "metric";

export const km = (value: number): Kilometers => value as Kilometers;
export const miles = (value: number): Miles => value as Miles;
export const meters = (value: number): Meters => value as Meters;
export const feet = (value: number): Feet => value as Feet;
export const hours = (value: number): Hours => value as Hours;
export const minutes = (value: number): Minutes => value as Minutes;
export const seconds = (value: number): Seconds => value as Seconds;
export const kph = (value: number): KilometersPerHour => value as KilometersPerHour;
export const mph = (value: number): MilesPerHour => value as MilesPerHour;
export const minPerKm = (value: number): MinutesPerKilometer => value as MinutesPerKilometer;
export const minPerMile = (value: number): MinutesPerMile => value as MinutesPerMile;

const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.60934;
const METERS_TO_FEET = 3.28084;
const FEET_TO_METERS = 1 / 3.28084;

export const kmToMeters = (k: Kilometers): Meters => meters(k * 1000);
export const metersToKm = (m: Meters): Kilometers => km(m / 1000);
export const kmToMiles = (k: Kilometers): Miles => miles(k * KM_TO_MILES);
export const milesToKm = (m: Miles): Kilometers => km(m * MILES_TO_KM);
export const metersToFeet = (m: Meters): Feet => feet(m * METERS_TO_FEET);
export const feetToMeters = (f: Feet): Meters => meters(f * FEET_TO_METERS);
export const milesToFeet = (m: Miles): Feet => feet(m * 5280);
export const feetToMiles = (f: Feet): Miles => miles(f / 5280);

export const hoursToMinutes = (h: Hours): Minutes => minutes(h * 60);
export const minutesToHours = (m: Minutes): Hours => hours(m / 60);
export const hoursToSeconds = (h: Hours): Seconds => seconds(h * 3600);
export const secondsToHours = (s: Seconds): Hours => hours(s / 3600);
export const minutesToSeconds = (m: Minutes): Seconds => seconds(m * 60);
export const secondsToMinutes = (s: Seconds): Minutes => minutes(s / 60);

export const kphToMph = (speed: KilometersPerHour): MilesPerHour => mph(speed * KM_TO_MILES);
export const mphToKph = (speed: MilesPerHour): KilometersPerHour => kph(speed * MILES_TO_KM);

export const minPerKmToMinPerMile = (pace: MinutesPerKilometer): MinutesPerMile => minPerMile(pace * MILES_TO_KM);
export const minPerMileToMinPerKm = (pace: MinutesPerMile): MinutesPerKilometer => minPerKm(pace * KM_TO_MILES);

export const convertDistance = (value: Kilometers, toSystem: UnitsSystem): Kilometers | Miles => {
  return toSystem === "imperial" ? kmToMiles(value) : value;
};

export const convertSpeed = (value: KilometersPerHour, toSystem: UnitsSystem): KilometersPerHour | MilesPerHour => {
  return toSystem === "imperial" ? kphToMph(value) : value;
};

export const convertElevation = (value: Meters, toSystem: UnitsSystem): Meters | Feet => {
  return toSystem === "imperial" ? metersToFeet(value) : value;
};

export const convertPace = (value: MinutesPerKilometer, toSystem: UnitsSystem): MinutesPerKilometer | MinutesPerMile => {
  return toSystem === "imperial" ? minPerKmToMinPerMile(value) : value;
};

export interface UnitInfo {
  name: string;
  abbreviation: string;
  system: UnitsSystem;
}

export const getDistanceUnit = (system: UnitsSystem): UnitInfo => ({
  name: system === "imperial" ? "miles" : "kilometers",
  abbreviation: system === "imperial" ? "mi" : "km",
  system
});

export const getSpeedUnit = (system: UnitsSystem): UnitInfo => ({
  name: system === "imperial" ? "miles per hour" : "kilometers per hour", 
  abbreviation: system === "imperial" ? "mph" : "kph",
  system
});

export const getElevationUnit = (system: UnitsSystem): UnitInfo => ({
  name: system === "imperial" ? "feet" : "meters",
  abbreviation: system === "imperial" ? "ft" : "m", 
  system
});

export const getPaceUnit = (system: UnitsSystem): UnitInfo => ({
  name: system === "imperial" ? "minutes per mile" : "minutes per kilometer",
  abbreviation: system === "imperial" ? "min/mi" : "min/km",
  system
});

export const formatKmInSystem = (distance: Kilometers, system: UnitsSystem, decimals: number = 2): string => {
  if (system === "imperial") return `${((distance as number) * KM_TO_MILES).toFixed(decimals)} mi`;
  return `${(distance as number).toFixed(decimals)} km`;
};

export const formatMetersInSystem = (elevation: Meters, system: UnitsSystem, decimals: number = 0): string => {
  if (system === "imperial") return `${((elevation as number) * METERS_TO_FEET).toFixed(decimals)} ft`;
  return `${(elevation as number).toFixed(decimals)} m`;
};

export const formatKphInSystem = (speed: KilometersPerHour, system: UnitsSystem, decimals: number = 1): string => {
  if (system === "imperial") return `${((speed as number) * KM_TO_MILES).toFixed(decimals)} mph`;
  return `${(speed as number).toFixed(decimals)} kph`;
};

export const formatMinPerKmInSystem = (pace: MinutesPerKilometer, system: UnitsSystem): string => {
  const value = system === "imperial" ? (pace as number) * MILES_TO_KM : (pace as number);
  if (value === 0 || !isFinite(value)) return "N/A";
  const mins = Math.floor(value);
  const secs = Math.round((value - mins) * 60);
  const unit = system === "imperial" ? "/mi" : "/km";
  return `${mins}:${secs.toString().padStart(2, '0')}${unit}`;
};

export const calculateSpeed = (distance: Kilometers, time: Hours): KilometersPerHour => {
  return kph(distance / time);
};

export const calculatePace = (time: Minutes, distance: Kilometers): MinutesPerKilometer => {
  return minPerKm(time / distance);
};

export const calculateDuration = (distance: Kilometers, pace: MinutesPerKilometer): Minutes => {
  return minutes(distance * pace);
};

export const getDistanceLabel = (system: UnitsSystem): string => {
  const unit = getDistanceUnit(system);
  return `Distance (${unit.abbreviation})`;
};

export const getSpeedLabel = (system: UnitsSystem): string => {
  const unit = getSpeedUnit(system);
  return `Speed (${unit.abbreviation})`;
};

export const getElevationLabel = (system: UnitsSystem): string => {
  const unit = getElevationUnit(system);
  return `Elevation (${unit.abbreviation})`;
};

export const getPaceLabel = (system: UnitsSystem): string => {
  const unit = getPaceUnit(system);
  return `Pace (${unit.abbreviation})`;
};