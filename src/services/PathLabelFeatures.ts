import type * as GeoJSON from 'geojson';
import { DEG_TO_RAD } from '../geo/DistanceCalculator';

export interface PathLabelStrings {
  start?: string;
  mid?: string;
  end?: string;
}

export const ROUTE_LABEL_ROLE_PROPERTY = 'route_label_role';

function collectLineCoordinatesFromGeometry(geometry: GeoJSON.Geometry | null | undefined, lines: GeoJSON.Position[][]): void {
  if (!geometry) return;

  if (geometry.type === 'LineString') {
    if (geometry.coordinates.length > 0) lines.push(geometry.coordinates);

    return;
  }

  if (geometry.type === 'MultiLineString') {
    for (const line of geometry.coordinates) {
      if (line.length > 0) lines.push(line);
    }

    return;
  }

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      collectLineCoordinatesFromGeometry(child, lines);
    }
  }
}

function getOverlayLineCoordinates(geojson: GeoJSON.FeatureCollection): GeoJSON.Position[][] {
  const lines: GeoJSON.Position[][] = [];

  for (const feature of geojson.features ?? []) {
    collectLineCoordinatesFromGeometry(feature.geometry, lines);
  }

  return lines;
}

function getPathLabelEndpointCoordinates(lines: GeoJSON.Position[][]): { start: GeoJSON.Position; end: GeoJSON.Position } | null {
  const firstLine = lines.find((line) => line.length > 0);
  const lastLine = [...lines].reverse().find((line) => line.length > 0);
  const start = firstLine?.[0];
  const end = lastLine?.[lastLine.length - 1];

  return start && end ? { start, end } : null;
}

function getPathLabelMidCoordinate(lines: GeoJSON.Position[][]): GeoJSON.Position | null {
  const nonEmptyLines = lines.filter((line) => line.length > 0);

  if (nonEmptyLines.length === 0) return null;
  if (nonEmptyLines.length === 1) return getMidCoordinate(nonEmptyLines[0]);

  const lineDistances = nonEmptyLines.map(getLineDistance);
  const totalDistance = lineDistances.reduce((sum, distance) => sum + distance, 0);

  if (totalDistance <= 0) {
    const middleLine = nonEmptyLines[Math.floor((nonEmptyLines.length - 1) / 2)];

    return middleLine?.[Math.floor((middleLine.length - 1) / 2)] ?? null;
  }

  const target = totalDistance / 2;
  let traveled = 0;

  for (let index = 0; index < nonEmptyLines.length; index++) {
    const line = nonEmptyLines[index];
    const distance = lineDistances[index] ?? 0;

    if (traveled + distance >= target) {
      return getCoordinateAtDistance(line, target - traveled);
    }

    traveled += distance;
  }

  const lastLine = nonEmptyLines[nonEmptyLines.length - 1];

  return lastLine?.[lastLine.length - 1] ?? null;
}

export function buildPathLabelFeatures(geojson: GeoJSON.FeatureCollection, labels: PathLabelStrings): GeoJSON.Feature[] {
  const lines = getOverlayLineCoordinates(geojson);

  if (lines.length === 0) return [];
  const endpoints = getPathLabelEndpointCoordinates(lines);
  const features: GeoJSON.Feature[] = [];

  addPathLabelFeature(features, endpoints?.start, labels.start, 'start');
  if (labels.mid) addPathLabelFeature(features, getPathLabelMidCoordinate(lines), labels.mid, 'mid');
  addPathLabelFeature(features, endpoints?.end, labels.end, 'end');

  return features;
}

export function getPathLabelSegments(geojson: GeoJSON.FeatureCollection): GeoJSON.Position[][] {
  return getOverlayLineCoordinates(geojson).filter(line => line.length > 0);
}

export function buildSegmentedPathLabelFeatures(segments: readonly GeoJSON.Position[][], labelsPerSegment: readonly PathLabelStrings[]): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];

  segments.forEach((line, index) => {
    const labels = labelsPerSegment[index];

    if (!labels || line.length === 0) return;
    addPathLabelFeature(features, line[0], labels.start, 'start', index);
    if (labels.mid) addPathLabelFeature(features, getMidCoordinate(line), labels.mid, 'mid', index);
    addPathLabelFeature(features, line[line.length - 1], labels.end, 'end', index);
  });

  return features;
}

function addPathLabelFeature(features: GeoJSON.Feature[], coordinate: GeoJSON.Position | null | undefined, text: string | undefined, role: 'start' | 'mid' | 'end', segmentIndex?: number): void {
  const label = (text ?? '').trim();

  if (!coordinate || !label) return;
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coordinate },
    properties: {
      name: label,
      route_label: label,
      route_label_point: true,
      [ROUTE_LABEL_ROLE_PROPERTY]: role,
      ...(segmentIndex === undefined ? {} : { route_label_segment: segmentIndex + 1 }),
    },
  });
}

export function getMidCoordinate(coordinates: GeoJSON.Position[]): GeoJSON.Position | null {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0] ?? null;

  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const length = approximateCoordinateDistance(coordinates[index - 1], coordinates[index]);

    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength <= 0) {
    return coordinates[Math.floor((coordinates.length - 1) / 2)] ?? null;
  }

  const target = totalLength / 2;
  let traveled = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const segmentLength = segmentLengths[index - 1] ?? 0;

    if (traveled + segmentLength >= target) {
      const start = coordinates[index - 1];
      const end = coordinates[index];
      const ratio = segmentLength > 0 ? (target - traveled) / segmentLength : 0;

      return interpolateCoordinate(start, end, ratio);
    }

    traveled += segmentLength;
  }

  return coordinates[coordinates.length - 1] ?? null;
}

export function getLineDistance(coordinates: GeoJSON.Position[]): number {
  let total = 0;

  for (let index = 1; index < coordinates.length; index++) {
    total += approximateCoordinateDistance(coordinates[index - 1], coordinates[index]);
  }

  return total;
}

export function getCoordinateAtDistance(coordinates: GeoJSON.Position[], targetDistance: number): GeoJSON.Position | null {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1 || targetDistance <= 0) return coordinates[0] ?? null;

  let traveled = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const segmentLength = approximateCoordinateDistance(previous, current);

    if (segmentLength <= 0) continue;

    if (traveled + segmentLength >= targetDistance) {
      const ratio = (targetDistance - traveled) / segmentLength;

      return [
        previous[0] + (current[0] - previous[0]) * ratio,
        previous[1] + (current[1] - previous[1]) * ratio,
      ];
    }

    traveled += segmentLength;
  }

  return coordinates[coordinates.length - 1] ?? null;
}

export function approximateCoordinateDistance(start: GeoJSON.Position, end: GeoJSON.Position): number {
  const averageLatitude = ((start[1] ?? 0) + (end[1] ?? 0)) / 2;
  const latitudeScale = Math.cos(averageLatitude * DEG_TO_RAD);
  const dx = ((end[0] ?? 0) - (start[0] ?? 0)) * latitudeScale;
  const dy = (end[1] ?? 0) - (start[1] ?? 0);

  return Math.sqrt(dx * dx + dy * dy);
}

export function interpolateCoordinate(start: GeoJSON.Position, end: GeoJSON.Position, ratio: number): GeoJSON.Position {
  const interpolated: GeoJSON.Position = [
    (start[0] ?? 0) + ((end[0] ?? 0) - (start[0] ?? 0)) * ratio,
    (start[1] ?? 0) + ((end[1] ?? 0) - (start[1] ?? 0)) * ratio,
  ];

  if (start.length > 2 || end.length > 2) {
    interpolated[2] = (start[2] ?? 0) + ((end[2] ?? 0) - (start[2] ?? 0)) * ratio;
  }

  return interpolated;
}
