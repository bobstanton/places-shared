import type { Place } from "../Place";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";

export interface PeliasFeature {
  geometry?: { coordinates?: number[] };
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

export function peliasFeatureBounds(feature: PeliasFeature, fallbackRadiusKm = 2): PlacesBoundingBox | null {
  if (Array.isArray(feature.bbox) && feature.bbox.length >= 4) {
    const [minLng, minLat, maxLng, maxLat] = feature.bbox;
    if ([minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
      return new PlacesBoundingBox(minLat, minLng, maxLat, maxLng);
    }
  }

  const coordinates = peliasFeatureCoordinates(feature);
  return coordinates
    ? PlacesBoundingBox.fromCoordinates([coordinates], fallbackRadiusKm)
    : null;
}

export function peliasFeatureToPlace(feature: PeliasFeature, options: PeliasPlaceOptions): Place | null {
  const coordinates = peliasFeatureCoordinates(feature);
  const properties = feature.properties;
  if (!coordinates || !properties) return null;

  return {
    name: properties.name ?? "",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    address: formatPeliasAddress(properties),
    city: properties.locality || properties.county || "",
    state: properties.region || "",
    postalCode: properties.postalcode || "",
    country: properties.country || "",
    website: "",
    tags: properties.layer ? [properties.layer] : [],
    source: options.source,
    attribution: options.attribution,
  };
}

function peliasFeatureCoordinates(feature: PeliasFeature): { longitude: number; latitude: number } | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? { longitude, latitude } : null;
}

function formatPeliasAddress(properties: NonNullable<PeliasFeature["properties"]>): string {
  if (properties.housenumber && properties.street) {
    return [
      `${properties.housenumber} ${properties.street}`,
      properties.locality,
      properties.region,
      properties.postalcode,
      properties.country,
    ].filter(Boolean).join(", ");
  }
  return properties.label ?? "";
}
