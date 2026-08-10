import { Coordinate } from './DistanceCalculator';
import { forEachGeoJsonPosition, isGeoJsonGeometry } from './GeoJsonGeometryHelper';

export class PlacesBoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  private minShiftedLng: number;
  private maxShiftedLng: number;

  constructor(minLat?: number, minLng?: number, maxLat?: number, maxLng?: number) {
    if (minLat !== undefined && minLng !== undefined && maxLat !== undefined && maxLng !== undefined) {
      this.minLat = minLat;
      this.minLng = minLng;
      this.maxLat = maxLat;
      this.maxLng = maxLng;
      this.minShiftedLng = Math.min(this.shiftLongitude(minLng), this.shiftLongitude(maxLng));
      this.maxShiftedLng = Math.max(this.shiftLongitude(minLng), this.shiftLongitude(maxLng));
    } else {
      this.minLat = Infinity;
      this.minLng = Infinity;
      this.maxLat = -Infinity;
      this.maxLng = -Infinity;
      this.minShiftedLng = Infinity;
      this.maxShiftedLng = -Infinity;
    }
  }

  update(lat: number, lng: number): void {
    if (lat < this.minLat) this.minLat = lat;
    if (lng < this.minLng) this.minLng = lng;
    if (lat > this.maxLat) this.maxLat = lat;
    if (lng > this.maxLng) this.maxLng = lng;
    const shiftedLng = this.shiftLongitude(lng);
    if (shiftedLng < this.minShiftedLng) this.minShiftedLng = shiftedLng;
    if (shiftedLng > this.maxShiftedLng) this.maxShiftedLng = shiftedLng;
  }

  getLngLatBounds(): [[number, number], [number, number]] {
    const [west, east] = this.getLongitudeBounds();
    return [[west, this.minLat], [east, this.maxLat]];
  }

  getLatLngBounds(): [[number, number], [number, number]] {
    const [west, east] = this.getLongitudeBounds();
    return [[this.minLat, west], [this.maxLat, east]];
  }

  getConventionalLatLngBounds(): [[number, number], [number, number]] {
    return [[this.minLat, this.minLng], [this.maxLat, this.maxLng]];
  }

  getLngLatCenter(): [number, number] {
    const [west, east] = this.getLongitudeBounds();
    return [this.normalizeLongitude((west + east) / 2), (this.minLat + this.maxLat) / 2];
  }

  getLatLngCenter(): [number, number] {
    const [west, east] = this.getLongitudeBounds();
    return [(this.minLat + this.maxLat) / 2, this.normalizeLongitude((west + east) / 2)];
  }

  applyPadding(padding: number = 0.01): void {
    this.minLat -= padding;
    this.maxLat += padding;
    this.minLng -= padding;
    this.maxLng += padding;
    this.minShiftedLng -= padding;
    this.maxShiftedLng += padding;
  }

  contains(lat: number, lng: number): boolean {
    return this.isValid() &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= this.minLat &&
      lat <= this.maxLat &&
      lng >= this.minLng &&
      lng <= this.maxLng;
  }

  containsCoordinate(coordinate: Coordinate): boolean {
    return this.contains(coordinate.latitude, coordinate.longitude);
  }

  static fromCoordinates(points: Coordinate[], padding: number = 0): PlacesBoundingBox {
    const bbox = new PlacesBoundingBox();

    if (points.length === 0) {
      return bbox;
    }

    for (const point of points) {
      bbox.update(point.latitude, point.longitude);
    }

    if (padding > 0) {
      bbox.applyPadding(padding);
    }

    return bbox;
  }

  static fromPlaces(places: Array<{ latitude: number; longitude: number }>, padding: number = 0): PlacesBoundingBox {
    const bbox = new PlacesBoundingBox();

    if (places.length === 0) {
      return bbox;
    }

    for (const place of places) {
      bbox.update(place.latitude, place.longitude);
    }

    if (padding > 0) {
      bbox.applyPadding(padding);
    }

    return bbox;
  }

  static overlaps(box1: PlacesBoundingBox, box2: PlacesBoundingBox): boolean {
    return !(box1.maxLat < box2.minLat ||
             box1.minLat > box2.maxLat ||
             box1.maxLng < box2.minLng ||
             box1.minLng > box2.maxLng);
  }

  extend(other: PlacesBoundingBox): void {
    if (other.minLat < this.minLat) this.minLat = other.minLat;
    if (other.minLng < this.minLng) this.minLng = other.minLng;
    if (other.maxLat > this.maxLat) this.maxLat = other.maxLat;
    if (other.maxLng > this.maxLng) this.maxLng = other.maxLng;
    if (other.minShiftedLng < this.minShiftedLng) this.minShiftedLng = other.minShiftedLng;
    if (other.maxShiftedLng > this.maxShiftedLng) this.maxShiftedLng = other.maxShiftedLng;
  }

  private getLongitudeBounds(): [number, number] {
    const standardSpan = this.maxLng - this.minLng;
    const shiftedSpan = this.maxShiftedLng - this.minShiftedLng;
    return shiftedSpan < standardSpan
      ? [this.minShiftedLng, this.maxShiftedLng]
      : [this.minLng, this.maxLng];
  }

  private shiftLongitude(lng: number): number {
    return lng < 0 ? lng + 360 : lng;
  }

  private normalizeLongitude(lng: number): number {
    return lng > 180 ? lng - 360 : lng;
  }

  isValid(): boolean {
    return this.minLat !== Infinity && this.minLng !== Infinity &&
           this.maxLat !== -Infinity && this.maxLng !== -Infinity;
  }

  static fromGeoJSON(geojson: unknown): PlacesBoundingBox {
    const bbox = new PlacesBoundingBox();
    PlacesBoundingBox.extractGeoJSONCoordinates(geojson, bbox);
    return bbox;
  }

  private static extractGeoJSONCoordinates(obj: unknown, bbox: PlacesBoundingBox): void {
    if (!obj || typeof obj !== 'object') return;

    const geoObj = obj as Record<string, unknown>;

    if (geoObj.type === 'FeatureCollection' && Array.isArray(geoObj.features)) {
      for (const feature of geoObj.features) {
        PlacesBoundingBox.extractGeoJSONCoordinates(feature, bbox);
      }
    } else if (geoObj.type === 'Feature' && geoObj.geometry) {
      PlacesBoundingBox.extractGeoJSONCoordinates(geoObj.geometry, bbox);
    } else if (geoObj.type === 'GeometryCollection' && Array.isArray(geoObj.geometries)) {
      for (const geometry of geoObj.geometries) {
        PlacesBoundingBox.extractGeoJSONCoordinates(geometry, bbox);
      }
    } else if (isGeoJsonGeometry(geoObj)) {
      forEachGeoJsonPosition(geoObj, ([lng, lat]) => {
        if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
          bbox.update(lat, lng);
        }
      });
    }
  }
}
