import { finishWork } from '../utils/CooperativeWork';

export function readGeoJsonCoordTimes(raw: unknown, coordinateCount: number): number[] | undefined {
  return finishWork(readGeoJsonCoordTimesWork(raw, coordinateCount));
}

export function* readGeoJsonCoordTimesWork(raw: unknown, coordinateCount: number): Generator<void, number[] | undefined> {
  if (!Array.isArray(raw)) return undefined;
  let times: number[] | undefined;

  for (let index = 0; index < Math.min(raw.length, coordinateCount); index++) {
    if (index % 128 === 0) yield;
    const value: unknown = raw[index];
    const time = typeof value === 'number' || typeof value === 'string' ? new Date(value).getTime() : Number.NaN;

    if (!Number.isFinite(time)) continue;
    times ??= new Array<number>(coordinateCount).fill(Number.NaN);
    times[index] = time;
  }

  return times;
}
