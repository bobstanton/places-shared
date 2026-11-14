import { finishWork } from '../utils/CooperativeWork';
import type * as GeoJSON from 'geojson';
import type { MapPlaceOverlay, OverlayTrackData, Waypoint } from '../Place';
import { meters, type Meters } from '../Units';
import { sharedRegistryValue } from '../utils/CrossBundleRegistry';
import { readGeoJsonCoordTimesWork } from './GeoJsonTrackTimes';

const derivedByGeometry = sharedRegistryValue(
  Symbol.for('places.overlay-derived-track-data'),
  () => new WeakMap<GeoJSON.FeatureCollection, OverlayTrackData | undefined>(),
);

export function resolveOverlayTrackData(overlay: MapPlaceOverlay): OverlayTrackData | undefined {
  return finishWork(resolveOverlayTrackDataWork(overlay));
}

export function* resolveOverlayTrackDataWork(overlay: MapPlaceOverlay): Generator<void, OverlayTrackData | undefined> {
  if (overlay.track !== null) return overlay.track;

  if (!derivedByGeometry.has(overlay.geojson)) {
    derivedByGeometry.set(overlay.geojson, yield* extractTrackDataFromGeoJsonWork(overlay.geojson));
  }

  return derivedByGeometry.get(overlay.geojson);
}

export function extractTrackDataFromGeoJson(geojson: GeoJSON.FeatureCollection): OverlayTrackData | undefined {
  return finishWork(extractTrackDataFromGeoJsonWork(geojson));
}

export function* extractTrackDataFromGeoJsonWork(geojson: GeoJSON.FeatureCollection): Generator<void, OverlayTrackData | undefined> {
  const elevations: Meters[] = [];
  const waypoints: Waypoint[] = [];
  let times: number[] | undefined;
  let pointCount = 0;

  const appendLine = function* (line: GeoJSON.Position[], rawTimes: unknown): Generator<void> {
    let index = 0;

    for (const coord of line) {
      if (++index % 128 === 0) yield;
      if (coord.length > 2 && typeof coord[2] === 'number') elevations.push(meters(coord[2]));
    }

    const segmentTimes = yield* readGeoJsonCoordTimesWork(rawTimes, line.length);

    if (segmentTimes) {
      times ??= new Array<number>(pointCount).fill(Number.NaN);
      for (let i = 0; i < segmentTimes.length; i++) { times.push(segmentTimes[i]); if (i % 128 === 0) yield; }
    } else if (times) {
      for (let i = 0; i < line.length; i++) { times.push(Number.NaN); if (i % 128 === 0) yield; }
    }

    pointCount += line.length;
  };

  for (const feature of geojson.features) {
    const geometry = feature.geometry;

    if (!geometry) continue;

    if (geometry.type === 'Point') {
      const coords = geometry.coordinates;
      const rawTime: unknown = feature.properties?.time;
      const time = typeof rawTime === 'string' || typeof rawTime === 'number' ? new Date(rawTime) : undefined;

      waypoints.push({
        name: (feature.properties?.name as string) || '', lat: coords[1], lon: coords[0],
        elevation: coords[2] !== undefined ? meters(coords[2]) : undefined,
        description: feature.properties?.description as string | undefined,
        ...(time && Number.isFinite(time.getTime()) ? { time } : {}),
      });
    } else if (geometry.type === 'LineString') {
      yield* appendLine(geometry.coordinates, feature.properties?.coordTimes);
    } else if (geometry.type === 'MultiLineString') {
      const rawTimes: unknown = feature.properties?.coordTimes;
      const segmentTimes: unknown[] = Array.isArray(rawTimes) ? rawTimes : [];

      for (const [index, line] of geometry.coordinates.entries()) yield* appendLine(line, segmentTimes[index]);
    }
  }

  if (!elevations.length && !times && !waypoints.length) return undefined;

  return {
    ...(elevations.length ? { elevation: elevations } : {}),
    ...(times ? { time: times } : {}),
    ...(waypoints.length ? { waypoints } : {}),
  };
}
