import { DEFAULT_DENSITY_COLOR_SCHEME } from "../../track/index";
import type { App } from 'obsidian';
import type * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { PlacesBoundingBox } from "../../geo/index";
import type { MapPlace } from "../../overlay/index";
import { createHeatmapLayerPaint, createHeatmapSourceOptions } from "../../map/index";
import { findClosestPointFeature } from "../map/index";
import { MapConstants, parseContributingFiles, readNormalizedProperty } from "../../utils/index";
import { MapLibreHelper } from './MapLibreHelper';

export interface MapLibreHeatmapData {
  type: 'geojson';
  data: GeoJSON.FeatureCollection;
  isHeatmapLayer: true;
  colorScheme: string;
  minWeight: number;
  maxWeight: number;
}

export function createHeatmapGeoJson(places: MapPlace[], colorScheme = DEFAULT_DENSITY_COLOR_SCHEME): [MapLibreHeatmapData, PlacesBoundingBox] {
  const weights = places.map(place => {
    const value = Number(readNormalizedProperty(place.metadata, 'heatmapWeight'));

    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  let minWeight = weights.length ? Infinity : 1;
  let maxWeight = weights.length ? 0 : 1;

  for (const weight of weights) {
    minWeight = Math.min(minWeight, weight);
    maxWeight = Math.max(maxWeight, weight);
  }

  const features: GeoJSON.Feature[] = places.map((place, index) => ({
    type: 'Feature',
    properties: {
      weight: weights[index],
      frequency: place.metadata?.frequency || weights[index],
      contributingFiles: readNormalizedProperty(place.metadata, 'contributingFiles') || [],
      minWeight,
      maxWeight,
    },
    geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
  }));
  const boundingBox = new PlacesBoundingBox();

  for (const place of places) boundingBox.update(place.latitude, place.longitude);

  return [{
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
    isHeatmapLayer: true,
    colorScheme,
    minWeight,
    maxWeight,
  }, boundingBox];
}

export function renderHeatmap(options: {
  app: App;
  map: maplibregl.Map;
  data: MapLibreHeatmapData;
}): void {
  const { app, map, data } = options;

  map.addSource('heatmap', { type: 'geojson', data: data.data, ...createHeatmapSourceOptions(true) });
  map.addLayer({
    id: 'heatmap-layer',
    type: 'heatmap',
    source: 'heatmap',
    paint: createHeatmapLayerPaint(
      data.colorScheme,
    ) as never,
  });

  map.on('click', 'heatmap-layer', (event: maplibregl.MapLayerMouseEvent) => {
    const features = data.data.features;
    const closest = findClosestPointFeature({ map, features, clickPoint: event.point, thresholdPx: MapConstants.CLICK_PROXIMITY_THRESHOLD_PX });

    if (!closest) return;
    event.preventDefault();
    const frequencyProperty: unknown = closest.properties?.frequency;
    const weightProperty: unknown = closest.properties?.weight;

    MapLibreHelper.createFrequencyPopup(
      map,
      event.lngLat,
      (typeof frequencyProperty === 'number' ? frequencyProperty : 0) || (typeof weightProperty === 'number' ? weightProperty : 0),
      parseContributingFiles(closest.properties?.contributingFiles),
      app,
    );
  });
  MapLibreHelper.addPointerCursor(map, 'heatmap-layer');
}
