import { Kilometers, Meters, km, meters } from '../Units';

export const DEG_TO_RAD = Math.PI / 180;

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface CoordinateWithElevation extends Coordinate {
  elevation?: number;
}

export class DistanceCalculator {
  private static readonly EARTH_RADIUS_KM = 6371.0088;

  static calculatePolylineDistanceKm(coordinates: Coordinate[]): Kilometers {
    if (coordinates.length < 2) return km(0);

    let totalDistance = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = this.calculateDistanceBetween(coordinates[i - 1], coordinates[i]);

      totalDistance += segmentDistance as number;
    }

    return km(totalDistance);
  }

  static calculateDistanceBetween(coord1: Coordinate, coord2: Coordinate): Kilometers {
    return this.haversineDistance(
      coord1.latitude, coord1.longitude,
      coord2.latitude, coord2.longitude
    );
  }

  static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): Kilometers {
    const sinHalfDLat = Math.sin((lat2 - lat1) * DEG_TO_RAD * 0.5);
    const sinHalfDLng = Math.sin((lng2 - lng1) * DEG_TO_RAD * 0.5);

    const a = sinHalfDLat * sinHalfDLat +
      Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
      sinHalfDLng * sinHalfDLng;

    return km(DistanceCalculator.EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  static haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): Meters {
    return meters((this.haversineDistance(lat1, lng1, lat2, lng2) as number) * 1000);
  }

  private static fastDistanceDegrees(point1: Coordinate, point2: Coordinate): number {
    const dLat = point1.latitude - point2.latitude;
    const dLng = point1.longitude - point2.longitude;

    const avgLat = (point1.latitude + point2.latitude) * 0.5 * DEG_TO_RAD;
    const correctedDLng = dLng * Math.cos(avgLat);

    return Math.sqrt(dLat * dLat + correctedDLng * correctedDLng);
  }

  static perpendicularDistanceDegrees(point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
    const A = point.latitude - lineStart.latitude;
    const B = point.longitude - lineStart.longitude;
    const C = lineEnd.latitude - lineStart.latitude;
    const D = lineEnd.longitude - lineStart.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }

    const param = dot / lenSq;
    let xx: number, yy: number;

    if (param < 0) {
      xx = lineStart.latitude;
      yy = lineStart.longitude;
    } else if (param > 1) {
      xx = lineEnd.latitude;
      yy = lineEnd.longitude;
    } else {
      xx = lineStart.latitude + param * C;
      yy = lineStart.longitude + param * D;
    }

    const dx = point.latitude - xx;
    const dy = point.longitude - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  static pointToSegmentDistanceMeters(point: Coordinate, segStart: Coordinate, segEnd: Coordinate): Meters {
    const metersPerDegLat = this.EARTH_RADIUS_KM * 1000 * DEG_TO_RAD;
    const metersPerDegLng = metersPerDegLat * Math.cos(point.latitude * DEG_TO_RAD);

    const ax = (segStart.longitude - point.longitude) * metersPerDegLng;
    const ay = (segStart.latitude - point.latitude) * metersPerDegLat;
    const bx = (segEnd.longitude - point.longitude) * metersPerDegLng;
    const by = (segEnd.latitude - point.latitude) * metersPerDegLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      return meters(Math.sqrt(ax * ax + ay * ay));
    }

    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;

    return meters(Math.sqrt(cx * cx + cy * cy));
  }

  private static discreteFrechetDistance(track1: Coordinate[], track2: Coordinate[]): number {
    const n = track1.length;
    const m = track2.length;

    let prevRow = new Array<number>(m).fill(Infinity);
    let currRow = new Array<number>(m).fill(Infinity);

    prevRow[0] = this.fastDistanceDegrees(track1[0], track2[0]);

    for (let j = 1; j < m; j++) {
      prevRow[j] = Math.max(prevRow[j-1], this.fastDistanceDegrees(track1[0], track2[j]));
    }

    for (let i = 1; i < n; i++) {
      currRow[0] = Math.max(prevRow[0], this.fastDistanceDegrees(track1[i], track2[0]));

      for (let j = 1; j < m; j++) {
        const distance = this.fastDistanceDegrees(track1[i], track2[j]);

        currRow[j] = Math.max(
          Math.min(prevRow[j], prevRow[j-1], currRow[j-1]),
          distance
        );
      }

      [prevRow, currRow] = [currRow, prevRow];
      currRow.fill(Infinity);
    }

    return prevRow[m-1];
  }

  static discreteFrechetSimilarity(track1: Coordinate[], track2: Coordinate[], threshold: number = 0.01): number {
    const maxDistance = this.discreteFrechetDistance(track1, track2);

    return Math.max(0, 1 - (maxDistance / threshold));
  }
}
