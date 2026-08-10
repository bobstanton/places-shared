import type * as GeoJSON from 'geojson';
import type { MetricWindow } from '../settings/MetricWindow';
import type { App } from 'obsidian';
import type { MapPlace } from '../Place';
import type { Coordinate } from '../geo/DistanceCalculator';
import { getGeoJsonFeatures, isGeoJSONOverlay, type Overlay } from '../overlay/OverlaySystem';
import { TrackColorBy, TrackRenderer } from '../track/TrackRenderer';
import { extractTrackGeometry, TRACK_STYLE_DEFAULTS } from '../track/TrackVisibilityResolver';
import { prepareDirectionsOverlayNote, prepareIsochroneOverlayNote } from '../services/RouteOverlayNotePreparer';
import type { MapRenderRequest } from '../settings/MapConfiguration';
import { parseContributingFiles } from '../utils/Utilities';
import { MapContextMenu } from './MapContextMenu';
import { runMarkerZoomTest } from './MarkerZoomTest';

interface QueryRenderedFeaturesMap {
  queryRenderedFeatures(pointOrOptions?: unknown): unknown[];
}

interface MapPointerEvent {
  lngLat: { lat: number; lng: number };
  point: { x: number; y: number };
  originalEvent: MouseEvent;
  preventDefault(): void;
}

interface ContextMenuMap extends QueryRenderedFeaturesMap {
  unproject(point: [number, number]): { lat: number; lng: number };
  jumpTo(options: { center: [number, number]; zoom: number }): void;
  getBounds(): { contains(coordinates: [number, number]): boolean } | null | undefined;
  on(event: 'contextmenu', handler: (event: MapPointerEvent) => void): void;
  on(event: 'remove', handler: () => void): void;
}

interface HeatmapInteractionMap {
  querySourceFeatures(sourceId: string, options?: unknown): FeatureLike[];
  project(coordinates: [number, number]): { x: number; y: number };
  on(event: string, layerId: string, handler: (event: HeatmapClickEvent) => void): void;
  getLayer?(layerId: string): unknown;
  getCanvas(): HTMLCanvasElement;
  fitBounds(bounds: [[number, number], [number, number]], options: { padding: number; animate: boolean }): void;
}

interface HeatmapClickEvent {
  point: { x: number; y: number };
  lngLat: unknown;
  originalEvent?: Event & { _heatmapClicked?: boolean };
  preventDefault(): void;
}

interface RenderedFeatureLike extends GeoJSON.Feature {
  source?: string;
  layer?: { id?: string };
}

interface FeatureLike {
  properties?: GeoJSON.GeoJsonProperties;
  geometry?: GeoJSON.Geometry | null;
  layer?: { id?: string };
}

export interface DirectionsRouteLookupOptions {
  map: QueryRenderedFeaturesMap;
  container: HTMLElement;
  event: MouseEvent;
  overlays: Overlay[];
  // Native device-pixel query point (MapLibre's `event.point`); rect math is the touch-path fallback.
  point?: [number, number];
}

export interface PoiGeometryQuery {
  map: QueryRenderedFeaturesMap;
  name: string;
  layer?: string;
  nameProperties?: string[];
  queryLayerDirectly?: boolean;
}

export interface VectorContextMenuOptions<TMap extends ContextMenuMap> {
  app: App;
  map: TMap;
  container: HTMLElement;
  request: MapRenderRequest;
  places: MapPlace[];
  developerMode: boolean;
  providerName: string;
  getCurrentPlaces: () => MapPlace[] | undefined;
  includeDirectionsRouteActions?: boolean;
}

export interface HeatmapInteractionOptions<TMap extends HeatmapInteractionMap> {
  map: TMap;
  bounds: [[number, number], [number, number]];
  createFrequencyPopup: (frequency: number, contributingFiles: string[]) => Node;
  openPopup: (event: HeatmapClickEvent, content: Node) => void;
  markOriginalEvent?: boolean;
}

export interface ClosestPointFeatureOptions<TMap extends Pick<HeatmapInteractionMap, 'project'>> {
  map: TMap;
  features: FeatureLike[];
  clickPoint: { x: number; y: number };
  thresholdPx?: number;
}

export function createGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): GeoJSON.FeatureCollection | null {
  const trackGeometry = extractTrackGeometry(place);
  if (!trackGeometry) return null;

  // Each mode needs its own per-point data: elevations for elevation and grade,
  // timestamps for speed and pace. Missing data leaves the caller drawing a
  // plain line.
  const isSpeedMode = colorBy === 'speed' || colorBy === 'pace';
  const times = place.overlay?.track?.time;
  if (isSpeedMode ? !times?.length : !trackGeometry.elevations?.length) return null;

  const renderData = TrackRenderer.createTrackRenderData(trackGeometry.encodedPolyline, {
    coloringType: colorBy,
    elevations: trackGeometry.elevations,
    times,
    gradeWindow,
    speedWindow,
    outlineOverride: true });

  if (renderData.type !== 'colored' || renderData.segments.length === 0) return null;

  const features: GeoJSON.Feature[] = renderData.segments.map(segment => ({
    type: 'Feature',
    properties: {
      stroke: segment.color,
      'stroke-width': TRACK_STYLE_DEFAULTS.weight,
      'stroke-opacity': TRACK_STYLE_DEFAULTS.opacity,
      grade: segment.grade,
      ...(segment.speedKph !== undefined ? { speedKph: segment.speedKph } : {}) },
    geometry: {
      type: 'LineString',
      coordinates: segment.coordinates.map(coord => [coord.longitude, coord.latitude]) } }));

  if (place.overlay?.geojson?.type === 'FeatureCollection') {
    features.push(...place.overlay.geojson.features.filter(feature => feature.geometry.type === 'Point'));
  }

  return {
    type: 'FeatureCollection',
    features };
}

function eventQueryPoint(options: DirectionsRouteLookupOptions): [number, number] {
  if (options.point) return options.point;
  const rect = options.container.getBoundingClientRect();
  return [options.event.clientX - rect.left, options.event.clientY - rect.top];
}

export function getDirectionsRouteFeatureAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.Feature | null {
  const renderedFeature = options.map.queryRenderedFeatures(eventQueryPoint(options))
    .find((feature) => isDirectionsRouteLineFeature(feature as GeoJSON.Feature)) as RenderedFeatureLike | undefined;
  if (!renderedFeature) return null;

  return findFullDirectionsRouteFeature(options.overlays, renderedFeature) ?? cloneRenderedRouteFeature(renderedFeature);
}

export function getIsochroneOverlayAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.FeatureCollection | null {
  const renderedFeature = options.map.queryRenderedFeatures(eventQueryPoint(options))
    .find((feature) => isIsochroneFeature(feature as GeoJSON.Feature)) as RenderedFeatureLike | undefined;
  if (!renderedFeature) return null;

  return findFullIsochroneOverlay(options.overlays, renderedFeature) ?? createSingleFeatureCollection(renderedFeature);
}

export function queryPoiGeometry(options: PoiGeometryQuery): GeoJSON.Geometry | undefined {
  const features = queryPoiFeatures(options);
  const matchingFeatures = features.filter(feature => featureMatchesPoi(feature, options));

  if (matchingFeatures.length === 0) {
    const byNameOnly = features.filter(feature => featureNameMatches(feature, options.name, options.nameProperties));
    return byNameOnly.find(feature => feature.geometry)?.geometry ?? undefined;
  }

  if (matchingFeatures.length === 1) {
    return matchingFeatures[0].geometry ?? undefined;
  }

  const lineStrings: [number, number][][] = [];
  for (const feature of matchingFeatures) {
    if (feature.geometry?.type === 'LineString') {
      lineStrings.push(feature.geometry.coordinates as [number, number][]);
    } else if (feature.geometry?.type === 'MultiLineString') {
      lineStrings.push(...feature.geometry.coordinates as [number, number][][]);
    }
  }

  if (lineStrings.length > 1) {
    return {
      type: 'MultiLineString',
      coordinates: lineStrings };
  }

  return matchingFeatures.find(feature => feature.geometry)?.geometry ?? undefined;
}

export function setupVectorContextMenu<TMap extends ContextMenuMap>(options: VectorContextMenuOptions<TMap>): void {
  const unprojectAt = (clientX: number, clientY: number): Coordinate | null => {
    const rect = options.container.getBoundingClientRect();
    try {
      const lngLat = options.map.unproject([clientX - rect.left, clientY - rect.top]);
      return { latitude: lngLat.lat, longitude: lngLat.lng };
    } catch {
      return null;
    }
  };

  const placeNoteHost = options.request.runtime.placeNoteHost;
  const contextMenu = new MapContextMenu({
    placeNoteHost,
    reverseGeocodeHost: options.request.runtime.reverseGeocodeHost,
    customMenuItems: (coordinate, event, point) => {
      const items = [];

      for (const action of options.request.runtime.contextMenuActions) {
        items.push({ text: action.text, icon: action.icon, onClick: () => action.onClick(coordinate) });
      }
      const routeFeature = options.includeDirectionsRouteActions === false
        ? null
        : getDirectionsRouteFeatureAtEvent({
          map: options.map,
          container: options.container,
          event,
          point,
          overlays: [...options.request.runtime.overlays] });

      // Host-gated like every other note-creating affordance.
      if (routeFeature && placeNoteHost) {
        items.push({
          text: 'Export directions to new note',
          icon: '↗',
          onClick: async () => {
            await placeNoteHost.createNote(await prepareDirectionsOverlayNote(routeFeature, options.request.runtime.source.path));
          } });
      }

      const isochroneOverlay = getIsochroneOverlayAtEvent({
        map: options.map,
        container: options.container,
        event,
        point,
        overlays: [...options.request.runtime.overlays] });

      if (isochroneOverlay && placeNoteHost) {
        items.push({
          text: 'Export isochrone to new note',
          icon: '↗',
          onClick: async () => {
            await placeNoteHost.createNote(prepareIsochroneOverlayNote(isochroneOverlay, options.request.runtime.source.path));
          } });
      }

      if (options.developerMode) {
        items.push({
          text: 'Run marker zoom test',
          icon: '🔎',
          onClick: async () => {
            await runMarkerZoomTest(
              options.container,
              options.getCurrentPlaces() ?? options.places,
              (place, zoom) => {
                options.map.jumpTo({ center: [place.longitude, place.latitude], zoom });
              },
              (markerPlaces) => {
                const bounds = options.map.getBounds();
                if (!bounds) return [];
                return markerPlaces.filter((place) => bounds.contains([place.longitude, place.latitude]));
              },
              { providerName: options.providerName },
            );
          } });
      }

      return items;
    } });

  // MapLibre's native contextmenu fires on a plain right-click but is suppressed during a right-drag
  // rotate (the pointer moved), and hands over the map coordinate directly. preventDefault on the
  // originating event stops the browser menu.
  options.map.on('contextmenu', (event) => {
    event.originalEvent.preventDefault();
    const coordinate: Coordinate = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
    contextMenu.open(coordinate, event.originalEvent.clientX, event.originalEvent.clientY, event.originalEvent, [event.point.x, event.point.y]);
  });

  // MapLibre sets touch-action:none on its canvas, and the browser never raises contextmenu on a touch
  // long-press; wire that path explicitly (Leaflet fires contextmenu on long-press and skips this).
  contextMenu.attachTouchLongPress(options.container, unprojectAt);

  // Both engines fire 'remove' from map.remove(): close an open menu and detach the long-press listeners.
  options.map.on('remove', () => contextMenu.cleanup());
}

export function setupHeatmapInteractions<TMap extends HeatmapInteractionMap>(options: HeatmapInteractionOptions<TMap>): void {
  const handleHeatmapClick = (event: HeatmapClickEvent) => {
    const features = options.map.querySourceFeatures('heatmap', { sourceLayer: undefined });
    if (!features?.length) return;

    const closestFeature = findClosestPointFeature({
      map: options.map,
      features,
      clickPoint: event.point,
      thresholdPx: 50 });

    if (!closestFeature?.properties) return;

    const frequency = Number(closestFeature.properties.frequency || closestFeature.properties.weight || 0);
    const contributingFiles = parseContributingFiles(closestFeature.properties.contributingFiles);

    event.preventDefault();
    if (options.markOriginalEvent && event.originalEvent) {
      event.originalEvent._heatmapClicked = true;
    }

    options.openPopup(event, options.createFrequencyPopup(frequency, contributingFiles));
  };

  for (const layerId of ['heatmap-point', 'heatmap-layer']) {
    if (options.map.getLayer && !options.map.getLayer(layerId)) {
      continue;
    }

    options.map.on('click', layerId, handleHeatmapClick);

    options.map.on('mouseenter', layerId, () => {
      options.map.getCanvas().setCssProps({
        cursor: 'pointer'
      });
    });

    options.map.on('mouseleave', layerId, () => {
      options.map.getCanvas().setCssProps({
        cursor: ''
      });
    });
  }

  const [[minLng, minLat], [maxLng, maxLat]] = options.bounds;
  const isValidBounds = isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat);

  if (isValidBounds) {
    options.map.fitBounds(options.bounds, {
      padding: 50,
      animate: false });
  }
}

export function findClosestPointFeature<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike | null {
  const threshold = options.thresholdPx ?? 50;
  let closestFeature: FeatureLike | null = null;
  let minDistance = Infinity;

  for (const feature of options.features) {
    if (feature.geometry?.type !== 'Point') continue;

    const pointGeometry = feature.geometry;
    const featurePoint = options.map.project([
      pointGeometry.coordinates[0],
      pointGeometry.coordinates[1],
    ]);

    const distance = Math.sqrt(
      Math.pow(options.clickPoint.x - featurePoint.x, 2) +
      Math.pow(options.clickPoint.y - featurePoint.y, 2),
    );

    if (distance < threshold && distance < minDistance) {
      minDistance = distance;
      closestFeature = feature;
    }
  }

  return closestFeature;
}

function queryPoiFeatures(options: PoiGeometryQuery): FeatureLike[] {
  if (options.queryLayerDirectly && options.layer) {
    return options.map.queryRenderedFeatures({ layers: [options.layer] }) as FeatureLike[];
  }

  return options.map.queryRenderedFeatures() as FeatureLike[];
}

function featureMatchesPoi(feature: FeatureLike, options: PoiGeometryQuery): boolean {
  if (options.layer && feature.layer?.id !== options.layer && !options.queryLayerDirectly) return false;
  return featureNameMatches(feature, options.name, options.nameProperties);
}

function featureNameMatches(feature: FeatureLike, name: string, nameProperties = ['name']): boolean {
  const properties = feature.properties ?? {};
  return nameProperties.some(property => properties[property] === name);
}

function findFullDirectionsRouteFeature(overlays: Overlay[], renderedFeature: RenderedFeatureLike): GeoJSON.Feature | null {
  const sourceId = renderedFeature.source ?? extractGeoJsonOverlaySourceId(renderedFeature.layer?.id);
  const overlayIndex = sourceId?.match(/^geojson-overlay-(\d+)$/)?.[1];
  if (overlayIndex === undefined) return null;

  const overlay = overlays[Number(overlayIndex)];
  if (!overlay || !isGeoJSONOverlay(overlay)) return null;

  const candidates = getGeoJsonFeatures(overlay.geojson).filter(isDirectionsRouteLineFeature);
  if (candidates.length <= 1) return candidates[0] ?? null;

  return candidates.find((feature) => routeFeaturePropertiesMatch(renderedFeature.properties ?? {}, feature.properties ?? {})) ?? candidates[0] ?? null;
}

function findFullIsochroneOverlay(overlays: Overlay[], renderedFeature: RenderedFeatureLike): GeoJSON.FeatureCollection | null {
  const sourceId = renderedFeature.source ?? extractGeoJsonOverlaySourceId(renderedFeature.layer?.id);
  const overlayIndex = sourceId?.match(/^geojson-overlay-(\d+)$/)?.[1];
  if (overlayIndex === undefined) return null;

  const overlay = overlays[Number(overlayIndex)];
  if (!overlay || !isGeoJSONOverlay(overlay)) return null;

  const features = getGeoJsonFeatures(overlay.geojson).filter(isIsochroneFeature);
  if (features.length === 0) return null;

  return {
    type: 'FeatureCollection',
    features: features.map(cloneFeature) };
}

function extractGeoJsonOverlaySourceId(layerId: string | undefined): string | null {
  return layerId?.match(/^(geojson-overlay-\d+)-/)?.[1] ?? null;
}

function routeFeaturePropertiesMatch(rendered: GeoJSON.GeoJsonProperties, candidate: GeoJSON.GeoJsonProperties): boolean {
  for (const key of ['route_index', 'provider', 'name', 'distance_text', 'duration_text']) {
    if (rendered?.[key] !== undefined && candidate?.[key] !== undefined && String(rendered[key]) !== String(candidate[key])) {
      return false;
    }
  }
  return true;
}

// Handed to a route-overlay note preparer.
export type RouteOverlayFeatureMatch =
  | { readonly kind: 'directions'; readonly feature: GeoJSON.Feature }
  | { readonly kind: 'isochrone'; readonly collection: GeoJSON.FeatureCollection };

// The engine-independent half of "can this be exported to a note": each engine
// finds the feature under the pointer its own way, then asks this. An isochrone
// exports as the whole contour set from its overlay, not the one ring clicked.
export function classifyRouteOverlayFeature(feature: GeoJSON.Feature, overlayGeoJson?: GeoJSON.GeoJSON): RouteOverlayFeatureMatch | null {
  if (!feature.geometry) return null;

  if (isDirectionsRouteLineFeature(feature)) {
    return { kind: 'directions', feature: cloneFeature(feature) };
  }

  if (isIsochroneFeature(feature)) {
    const siblings = overlayGeoJson ? getGeoJsonFeatures(overlayGeoJson).filter(isIsochroneFeature) : [];
    const features = (siblings.length > 0 ? siblings : [feature]).map(cloneFeature);
    return { kind: 'isochrone', collection: { type: 'FeatureCollection', features } };
  }

  return null;
}

function isDirectionsRouteLineFeature(feature: GeoJSON.Feature): boolean {
  const geometryType = feature.geometry?.type;
  if (geometryType !== 'LineString' && geometryType !== 'MultiLineString') return false;
  const properties = feature.properties ?? {};
  return Boolean(properties.route_label || properties.duration_text || properties.duration_seconds || properties.provider);
}

function isIsochroneFeature(feature: GeoJSON.Feature): boolean {
  const geometryType = feature.geometry?.type;
  if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon' && geometryType !== 'LineString' && geometryType !== 'MultiLineString') return false;
  const properties = feature.properties ?? {};
  return Boolean(
    properties.metric
      && properties.contour !== undefined
      && properties.provider
      && (properties.fill !== undefined || properties['fill-opacity'] !== undefined || properties.stroke !== undefined)
  );
}

function cloneRenderedRouteFeature(feature: GeoJSON.Feature): GeoJSON.Feature | null {
  if (!feature.geometry) return null;

  return cloneFeature(feature);
}

function createSingleFeatureCollection(feature: GeoJSON.Feature): GeoJSON.FeatureCollection | null {
  if (!feature.geometry) return null;
  return {
    type: 'FeatureCollection',
    features: [cloneFeature(feature)] };
}

function cloneFeature(feature: GeoJSON.Feature): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: JSON.parse(JSON.stringify(feature.geometry)) as GeoJSON.Geometry,
    properties: { ...(feature.properties ?? {}) } };
}
