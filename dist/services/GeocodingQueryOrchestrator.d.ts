import { Place } from '../Place';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
export interface GeocodingProximity {
    latitude: number;
    longitude: number;
}
export interface ResolvedGeocodingLocation {
    bounds?: PlacesBoundingBox;
    proximity?: GeocodingProximity;
}
export interface GeocodingQueryOrchestratorOptions {
    search: (query: string, proximity?: GeocodingProximity) => Promise<Place[]>;
    geocodeLocation: (location: string, mode: 'near' | 'in') => Promise<ResolvedGeocodingLocation | null>;
    searchInBounds?: (query: string, bounds: PlacesBoundingBox) => Promise<Place[]>;
    combineFallbackQuery?: (poi: string, location: string) => string;
    supportsStrictIn?: boolean;
    filterBoundedResults?: boolean;
}
export declare function lookupPlaceWithNearOrInQuery(query: string, options: GeocodingQueryOrchestratorOptions): Promise<Place[]>;
