import type * as GeoJSON from 'geojson';
import { getGeoJsonFeatures } from "../overlay/index";

const paintProperties = ['stroke', 'stroke-width', 'stroke-opacity', 'outline-color', 'outline-width', 'outline-opacity'];

export function* gradientTrackFeaturesWork(gradient: GeoJSON.GeoJSON): Generator<void, GeoJSON.Feature[]> {
  const features: GeoJSON.Feature[] = [];
  let previous: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString> | undefined;
  let count = 0;

  for (const feature of getGeoJsonFeatures(gradient)) {
    if (++count % 128 === 0) yield;

    if (feature.geometry?.type !== 'LineString') {
      previous = undefined;
      features.push(feature);
      continue;
    }

    const properties: Record<string, unknown> = {};

    for (const key of paintProperties) {
      if (feature.properties?.[key] !== undefined) properties[key] = feature.properties[key];
    }

    if (previous && paintProperties.every(key => previous!.properties?.[key] === properties[key])) {
      if (previous.geometry.type === 'LineString') {
        previous.geometry = { type: 'MultiLineString', coordinates: [previous.geometry.coordinates, feature.geometry.coordinates] };
      } else previous.geometry.coordinates.push(feature.geometry.coordinates);
    } else {
      previous = { type: 'Feature', geometry: feature.geometry, properties };
      features.push(previous);
    }
  }

  return features;
}
