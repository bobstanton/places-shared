import type * as GeoJSON from 'geojson';
import type { TrackNoteFrontmatterInput } from '../services/TrackNoteFrontmatter';
import type { Coordinate } from '../geo/DistanceCalculator';
export type PlaceNoteRequest = PoiPlaceNoteRequest | LocationPlaceNoteRequest | GeocodedPlaceNoteRequest | RouteOverlayPlaceNoteRequest | TrackPlaceNoteRequest;
interface PlaceNoteOrigin {
    readonly sourcePath?: string;
}
export interface PoiPlaceNoteRequest extends PlaceNoteOrigin {
    readonly kind: 'poi';
    readonly name: string;
    readonly class: string;
    readonly subclass?: string;
    readonly lat: number;
    readonly lng: number;
    readonly geometry?: GeoJSON.Geometry;
}
export interface LocationPlaceNoteRequest extends PlaceNoteOrigin {
    readonly kind: 'location';
    readonly coordinate: Coordinate;
}
export interface RouteOverlayPlaceNoteRequest extends PlaceNoteOrigin {
    readonly kind: 'route-overlay';
    readonly overlayKind: 'directions' | 'isochrone';
    readonly name: string;
    readonly geojson: GeoJSON.FeatureCollection;
    readonly location?: GeoJSON.Position;
}
export interface GeocodedPlaceNoteRequest extends PlaceNoteOrigin {
    readonly kind: 'place';
    readonly name: string;
    readonly lat: number;
    readonly lng: number;
    readonly city?: string;
    readonly state?: string;
    readonly postalCode?: string;
    readonly country?: string;
    readonly address?: string;
    readonly website?: string;
    readonly body?: string;
    readonly tags?: readonly string[];
}
export interface TrackPlaceNoteRequest extends PlaceNoteOrigin {
    readonly kind: 'track';
    readonly name: string;
    readonly gpx: string;
    readonly metrics: TrackNoteFrontmatterInput;
}
export interface PlaceNoteHost {
    createNote(request: PlaceNoteRequest): Promise<void>;
    resolveIcon(request: PlaceNoteRequest): string;
}
export {};
