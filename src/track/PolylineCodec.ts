import { encode as polylineEncode, decode as polylineDecode } from '@googlemaps/polyline-codec';
import type { Coordinate } from '../geo/DistanceCalculator';

export class PolylineCodec {
  static encode(coordinates: Coordinate[]): string {
    const latLngPairs = new Array<[number, number]>(coordinates.length);

    for (let i = 0; i < coordinates.length; i++) {
      latLngPairs[i] = [coordinates[i].latitude, coordinates[i].longitude];
    }

    return polylineEncode(latLngPairs);
  }

  static *quantizeWork(coordinates: Coordinate[]): Generator<void, Coordinate[]> {
    const result: Coordinate[] = [];

    for (let offset = 0; offset < coordinates.length; offset += 512) {
      const rounded = this.decode(this.encode(coordinates.slice(offset, offset + 512)));

      for (const coordinate of rounded) result.push(coordinate);
      yield;
    }

    return result;
  }

  // `precision` 6 is what Valhalla emits; 5 is the Google/Mapbox default.
  static decode(encoded: string, precision = 5): Coordinate[] {
    const latLngPairs = polylineDecode(encoded, precision);
    const result = new Array<Coordinate>(latLngPairs.length);

    for (let i = 0; i < latLngPairs.length; i++) {
      result[i] = { latitude: latLngPairs[i][0], longitude: latLngPairs[i][1] };
    }

    return result;
  }
}