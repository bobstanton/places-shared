import type { Place } from "../Place";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";
export interface PeliasFeature {
    geometry?: {
        coordinates?: number[];
    };
    bbox?: number[];
    properties?: {
        name?: string;
        label?: string;
        layer?: string;
        housenumber?: string;
        street?: string;
        locality?: string;
        county?: string;
        region?: string;
        country?: string;
        postalcode?: string;
    };
}
export interface PeliasPlaceOptions {
    source: string;
    attribution: string;
}
export declare function peliasFeatureBounds(feature: PeliasFeature, fallbackRadiusKm?: number): PlacesBoundingBox | null;
export declare function peliasFeatureToPlace(feature: PeliasFeature, options: PeliasPlaceOptions): Place | null;
