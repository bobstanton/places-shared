import type * as GeoJSON from 'geojson';
import { DEFAULT_SPEED_WINDOW, type MetricWindow } from '../../settings/index';
import type { App } from 'obsidian';
import type { MapPlace } from '../../place/index';
import type { Coordinate } from '../../geo/index';
import { getGeoJsonFeatures, isGeoJSONOverlay, type Overlay } from '../../overlay/index';
import { TrackColorBy, TrackRenderer, trackGradientWork } from '../../track/index';
import { extractCoordinatesFromOverlayWork, resolveOverlayTrackDataWork } from '../../track/index';
import { prepareDirectionsOverlayNote, prepareIsochroneOverlayNote } from '../../services/index';
import type { MapRenderRequest } from '../../settings/index';
import { parseContributingFiles, sharedRegistryValue, finishWork } from '../../utils/index';
import { MapContextMenu } from './MapContextMenu';
import { cloneRouteFeature as cloneFeature, isDirectionsRouteLineFeature, isIsochroneFeature } from '../../map/index';
export { classifyRouteOverlayFeature, isDirectionsRouteLineFeature, isIsochroneFeature, type RouteOverlayFeatureMatch } from '../../map/index';
import { runMarkerZoomTest } from '../../map/MarkerZoomTest';

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
  getRuntime: () => MapRenderRequest['runtime'];
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

interface CachedGradient {
  features: GeoJSON.Feature<GeoJSON.LineString>[] | null | undefined;
  bytes: number;
}

const gradientCache = sharedRegistryValue(Symbol.for('places.gradient-geojson-cache.v1'), () => ({
  byGeometry: new WeakMap<GeoJSON.FeatureCollection, {
    key: string;
    samples: number[] | null | undefined;
    value: CachedGradient;
  }>(),
  recent: new Set<CachedGradient>(),
  bytes: 0,
}));
const MAX_GRADIENT_BYTES = 64 * 1024 * 1024;
const MAX_GRADIENT_ENTRIES = 512;

function forgetGradient(value: CachedGradient): void {
  if (gradientCache.recent.delete(value)) gradientCache.bytes -= value.bytes;
  value.features = undefined;
}

export function createGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): GeoJSON.FeatureCollection | null {
  return finishWork(createGradientColoredGeoJsonWork(place, colorBy, gradeWindow, speedWindow));
}

export function prepareGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow: MetricWindow | undefined, signal: AbortSignal): Promise<GeoJSON.FeatureCollection | null> {
  return trackGradientWork.run(() => createGradientColoredGeoJsonWork(place, colorBy, gradeWindow, speedWindow), signal);
}

function* createGradientColoredGeoJsonWork(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): Generator<void, GeoJSON.FeatureCollection | null> {
  const overlay = place.overlay;

  if (!overlay || colorBy === 'none') return null;
  const isSpeedMode = colorBy === 'speed' || colorBy === 'pace';
  const window = isSpeedMode ? speedWindow ?? DEFAULT_SPEED_WINDOW : gradeWindow;
  const samples = overlay.track === null ? null : isSpeedMode ? overlay.track?.time : overlay.track?.elevation;
  const key = `${colorBy}:${window.kind}:${window.kind === 'time' ? window.ms : window.km}`;
  const cached = gradientCache.byGeometry.get(overlay.geojson);
  let lines: GeoJSON.Feature<GeoJSON.LineString>[] | null;

  if (cached?.key === key && cached.samples === samples && cached.value.features !== undefined) {
    gradientCache.recent.delete(cached.value);
    gradientCache.recent.add(cached.value);
    lines = cached.value.features;
  } else {
    lines = yield* createGradientLines(place, colorBy, gradeWindow, speedWindow);
    let bytes = 128;
    let measured = 0;

    for (const feature of lines ?? []) {
      bytes += 512 + feature.geometry.coordinates.length * 64;
      if (++measured % 128 === 0) yield;
    }

    const previous = gradientCache.byGeometry.get(overlay.geojson);

    if (previous) forgetGradient(previous.value);

    if (bytes <= MAX_GRADIENT_BYTES) {
      while (gradientCache.bytes + bytes > MAX_GRADIENT_BYTES || gradientCache.recent.size >= MAX_GRADIENT_ENTRIES) {
        const oldest = gradientCache.recent.values().next().value;

        if (!oldest) break;
        forgetGradient(oldest);
      }

      const value = { features: lines, bytes };

      gradientCache.byGeometry.set(overlay.geojson, { key, samples, value });
      gradientCache.recent.add(value);
      gradientCache.bytes += bytes;
    }
  }

  if (!lines) return null;
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < lines.length; i++) {
    features.push(lines[i]);
    if (i % 128 === 0) yield;
  }

  for (const feature of overlay.geojson.features) {
    if (feature.geometry?.type === 'Point') features.push(feature);
  }

  return { type: 'FeatureCollection', features };
}

function* createGradientLines(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): Generator<void, GeoJSON.Feature<GeoJSON.LineString>[] | null> {
  if (!place.overlay) return null;
  const coordinates = yield* extractCoordinatesFromOverlayWork(place.overlay);

  if (!coordinates.length) return null;
  const derived = yield* resolveOverlayTrackDataWork(place.overlay);

  const isSpeedMode = colorBy === 'speed' || colorBy === 'pace';
  const times = derived?.time;

  if (isSpeedMode ? !times?.length : !derived?.elevation?.length) return null;

  const renderData = yield* TrackRenderer.createTrackRenderDataWork(coordinates, {
    coloringType: colorBy,
    elevations: derived?.elevation,
    times,
    gradeWindow,
    speedWindow,
    outlineOverride: true });

  if (renderData.type !== 'colored' || renderData.segments.length === 0) return null;

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  let pointCount = 0;

  for (const segment of renderData.segments) {
    const [start, end] = segment.coordinates;

    if (segment.coordinates.length === 2 && start.longitude === end.longitude && start.latitude === end.latitude) {
      if (++pointCount % 128 === 0) yield;
      continue;
    }

    const coordinates: GeoJSON.Position[] = [];

    for (const coord of segment.coordinates) {
      coordinates.push([coord.longitude, coord.latitude]);
      if (++pointCount % 128 === 0) yield;
    }

    features.push({
      type: 'Feature',
      properties: {
        stroke: segment.color,
        grade: segment.grade,
        ...(segment.speedKph !== undefined ? { speedKph: segment.speedKph } : {}),
      },
      geometry: { type: 'LineString', coordinates },
    });
  }

  return features;
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

export interface MapContextMenuItemsOptions {
  container: HTMLElement;
  getRuntime: () => MapRenderRequest['runtime'];
  places: MapPlace[];
  developerMode: boolean;
  providerName: string;
  getCurrentPlaces: () => MapPlace[] | undefined;
  findDirectionsRoute?: (event: MouseEvent, point?: [number, number]) => GeoJSON.Feature | null;
  findIsochrone?: (event: MouseEvent, point?: [number, number]) => GeoJSON.FeatureCollection | null;
  zoomTo: (place: MapPlace, zoom: number) => void;
  placesInView: (places: MapPlace[]) => MapPlace[];
}

export function createMapContextMenu(options: MapContextMenuItemsOptions): MapContextMenu {
  return new MapContextMenu(() => {
    const runtime = options.getRuntime();
    const placeNoteHost = runtime.placeNoteHost;

    return {
      placeNoteHost,
      sourcePath: runtime.source.path,
      reverseGeocodeHost: runtime.reverseGeocodeHost,
      customMenuItems: (coordinate, event, point) => {
        const items = [];

        for (const action of runtime.contextMenuActions) {
          items.push({ text: action.text, icon: action.icon, onClick: () => action.onClick(coordinate) });
        }

        const routeFeature = options.findDirectionsRoute?.(event, point) ?? null;

        if (routeFeature && placeNoteHost) {
          items.push({
            text: 'Export directions to new note',
            icon: '↗',
            onClick: async () => {
              await placeNoteHost.createNote(await prepareDirectionsOverlayNote(routeFeature, runtime.source.path));
            } });
        }

        const isochroneOverlay = options.findIsochrone?.(event, point) ?? null;

        if (isochroneOverlay && placeNoteHost) {
          items.push({
            text: 'Export isochrone to new note',
            icon: '↗',
            onClick: async () => {
              await placeNoteHost.createNote(prepareIsochroneOverlayNote(isochroneOverlay, runtime.source.path));
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
                options.zoomTo,
                options.placesInView,
                { providerName: options.providerName },
              );
            } });
        }

        return items;
      },
    };
  });
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

  const overlays = () => [...options.getRuntime().overlays];
  const contextMenu = createMapContextMenu({
    container: options.container,
    getRuntime: options.getRuntime,
    places: options.places,
    developerMode: options.developerMode,
    providerName: options.providerName,
    getCurrentPlaces: options.getCurrentPlaces,
    findDirectionsRoute: options.includeDirectionsRouteActions === false
      ? undefined
      : (event, point) => getDirectionsRouteFeatureAtEvent({ map: options.map, container: options.container, event, point, overlays: overlays() }),
    findIsochrone: (event, point) => getIsochroneOverlayAtEvent({ map: options.map, container: options.container, event, point, overlays: overlays() }),
    zoomTo: (place, zoom) => options.map.jumpTo({ center: [place.longitude, place.latitude], zoom }),
    placesInView: markerPlaces => {
      const bounds = options.map.getBounds();

      if (!bounds) return [];

      return markerPlaces.filter((place) => bounds.contains([place.longitude, place.latitude]));
    },
  });

  options.map.on('contextmenu', (event) => {
    event.originalEvent.preventDefault();
    const coordinate: Coordinate = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };

    contextMenu.open(coordinate, event.originalEvent.clientX, event.originalEvent.clientY, event.originalEvent, [event.point.x, event.point.y]);
  });

  contextMenu.attachTouchLongPress(options.container, unprojectAt);

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

export function findPointFeaturesWithin<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike[] {
  const threshold = options.thresholdPx ?? 50;
  const withinRange: Array<{ feature: FeatureLike; distance: number }> = [];

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

    if (distance < threshold) withinRange.push({ feature, distance });
  }

  return withinRange.sort((left, right) => left.distance - right.distance).map(entry => entry.feature);
}

export function findClosestPointFeature<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike | null {
  return findPointFeaturesWithin(options)[0] ?? null;
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
