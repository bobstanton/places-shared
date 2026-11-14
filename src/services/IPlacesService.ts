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

// Parentheses syntax ("POI (location)") behaves like a "near" query.
export function parseNearQuery(query: string): ParsedPlaceLocationQuery | null {
  const trimmed = query.trim();

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);

  if (parenMatch) {
    const poi = parenMatch[1].trim();
    const location = parenMatch[2].trim();

    if (poi && location) {
      return { poi, location, mode: 'near' };
    }
  }

  const keywordMatch = trimmed.match(/\b(near|in)\b/i);

  if (!keywordMatch) {
    return null;
  }

  const keywordIndex = keywordMatch.index!;
  const keyword = keywordMatch[1];
  const mode = keyword.toLowerCase() as PlaceLocationQueryMode;

  const poi = trimmed.substring(0, keywordIndex).trim();
  const location = trimmed.substring(keywordIndex + keyword.length).trim();

  if (poi && location) {
    return { poi, location, mode };
  }

  return null;
}
