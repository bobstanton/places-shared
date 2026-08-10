import { Place } from '../Place';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
import { parseNearQuery } from './IPlacesService';

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

function getBoundsProximity(bounds: PlacesBoundingBox): GeocodingProximity {
  const [longitude, latitude] = bounds.getLngLatCenter();
  return { latitude, longitude };
}

export async function lookupPlaceWithNearOrInQuery(query: string, options: GeocodingQueryOrchestratorOptions): Promise<Place[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const parsedQuery = parseNearQuery(trimmedQuery);
  if (!parsedQuery) {
    return options.search(trimmedQuery);
  }

  const { poi, location, mode } = parsedQuery;
  const supportsStrictIn = options.supportsStrictIn ?? true;

  if (mode === 'in' && !supportsStrictIn) {
    return [];
  }

  const fallbackQuery = options.combineFallbackQuery?.(poi, location) ?? `${poi} ${location}`;
  const resolvedLocation = await options.geocodeLocation(location, mode);

  if (!resolvedLocation) {
    return mode === 'in' ? [] : options.search(fallbackQuery);
  }

  const proximity = resolvedLocation.proximity
    ?? (resolvedLocation.bounds ? getBoundsProximity(resolvedLocation.bounds) : undefined);

  if (resolvedLocation.bounds && options.searchInBounds) {
    const boundedResults = await options.searchInBounds(poi, resolvedLocation.bounds);
    const results = options.filterBoundedResults
      ? boundedResults.filter(place => resolvedLocation.bounds!.contains(place.latitude, place.longitude))
      : boundedResults;

    if (mode === 'in' || results.length > 0) {
      return results;
    }

    // The combined query keeps providers whose search ignores proximity scoped to the location.
    return options.search(fallbackQuery, proximity);
  }

  if (mode === 'in') {
    return [];
  }

  if (proximity) {
    return options.search(poi, proximity);
  }

  return options.search(fallbackQuery);
}
