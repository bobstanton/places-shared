import { Place } from "../Place";
import { Coordinate } from "../geo/DistanceCalculator";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";
export type PartialPlacesResultsCallback = (results: Place[]) => void;
export interface IPlacesService {
    lookupPlace(query: string, onPartialResults?: PartialPlacesResultsCallback): Promise<Place[]>;
    lookupPlaceByCoordinates(coordinate: Coordinate): Promise<Place[]>;
    lookupPlaceInBounds?(query: string, bounds: PlacesBoundingBox, onPartialResults?: PartialPlacesResultsCallback): Promise<Place[]>;
}
export type PlaceLocationQueryMode = 'near' | 'in';
export interface ParsedPlaceLocationQuery {
    poi: string;
    location: string;
    mode: PlaceLocationQueryMode;
}
export declare function parseNearQuery(query: string): ParsedPlaceLocationQuery | null;
