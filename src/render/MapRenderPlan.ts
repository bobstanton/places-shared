import type { MapPlace, MapPlaceOverlay } from '../Place';
import type * as GeoJSON from 'geojson';
import { hasTrackData } from '../Place';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
import type { Overlay } from '../overlay/OverlaySystem';
import { createVectorTileOverlaySourceId, isGeoJSONOverlay, isImageOverlay, isVectorTileOverlay } from '../overlay/OverlaySystem';
import { MapStateManager } from '../map/MapStateManager';
import { TRACK_STYLE_DEFAULTS, resolveTrackVisibility, getPlaceId, getPlaceMarkerRenderSignature, getTrackStateRenderSignature } from '../track/TrackVisibilityResolver';
import type { MapContextAction, MapRuntimeContext, MapSourceContext, ResolvedMapConfig } from '../settings/MapConfiguration';
import type { TrackVisibilityResult } from '../track/TrackVisibilityResolver';
import { getErrorMessage } from '../utils/Utilities';
import { stableSignature, stableSignatureCached } from '../utils/StableSignature';
import { logger as rootLogger } from '../utils/logger';
import { mergeZoomRanges, readZoomRangeFromRecord, type ZoomRange } from '../ZoomVisibility';

const logger = rootLogger.scope('MapRenderPlan');

export type MapSurfaceKind = 'places-block' | 'bases-view' | 'track-preview' | 'other';

// 'fit-data' fits the plan's data bounds; 'explicit' is a fixed center/zoom ([lng, lat]); 'preserve' never moves an already-live camera programmatically.
export type MapCameraIntent =
  | { kind: 'fit-data'; padding?: number; maxZoom?: number }
  | { kind: 'explicit'; center?: [number, number]; zoom?: number }
  | { kind: 'preserve' };

export type RenderableKind =
  | 'marker'
  | 'label'
  | 'note-track'
  | 'geojson-overlay'
  | 'image-overlay'
  | 'vector-tile-overlay';

export interface VisibilityPolicy {
  data: boolean;
  cluster?: 'hide-when-clustered' | 'always';
  userToggle?: 'open' | 'closed' | 'none';
  zoom?: ZoomRange;
}

export interface MapRenderable {
  id: string;
  kind: RenderableKind;
  owner: 'place' | 'block' | 'generated' | 'embedded';
  sourcePath?: string;
  sourceId?: string;
  layerIds: string[];
  signature: string;
  visibility: VisibilityPolicy;
}

export interface OverlayPreparationResult {
  places: MapPlace[];
  overlays: Overlay[];
  errors: Array<{ path: string; error: string }>;
}

export interface MapRenderPlan {
  surfaceKind: MapSurfaceKind;
  places: MapPlace[];
  overlays: Overlay[];
  config: ResolvedMapConfig;
  runtime: MapRuntimeContext;
  clusteringEnabled: boolean;
  renderables: MapRenderable[];
  boundsSignature: string;
  signature: string;
  camera: MapCameraIntent;
  markerVisibilityHiddenIds?: readonly string[];
  errors: Array<{ path: string; error: string }>;
}

export interface MapRenderPlanDiff {
  added: MapRenderable[];
  removed: MapRenderable[];
  updated: Array<{ previous: MapRenderable; next: MapRenderable }>;
  unchanged: MapRenderable[];
}

export type MapIncrementalChangeKind = 'places' | 'overlays' | 'styles' | 'tools' | 'clustering' | 'terrain';

export interface CreateMapRenderPlanOptions {
  surfaceKind: MapSurfaceKind;
  places: MapPlace[];
  config: ResolvedMapConfig;
  clusteringEnabled: boolean;
  overlays?: Overlay[];
  generatedOverlays?: Overlay[];
  camera: MapCameraIntent;
  source: MapSourceContext;
  contextMenuActions?: readonly MapContextAction[];
  onPlaceAction?: MapRuntimeContext['onPlaceAction'];
  placeNoteHost?: MapRuntimeContext['placeNoteHost'];
  reverseGeocodeHost?: MapRuntimeContext['reverseGeocodeHost'];
  inspectTrack?: MapRuntimeContext['inspectTrack'];
  trackLoader?: MapRuntimeContext['trackLoader'];
  mapTools?: MapRuntimeContext['mapTools'];
  terrainDem?: MapRuntimeContext['terrainDem'];
  reliefDem?: MapRuntimeContext['reliefDem'];
  markerVisibilityHiddenIds?: readonly string[];
  popupDebug?: MapRuntimeContext['popupDebug'];
  prepareTimings?: MapRuntimeContext['prepareTimings'];
}

export function resolveCameraIntent(config: ResolvedMapConfig, source: MapSourceContext = {}): MapCameraIntent {
  const saved = MapStateManager.getSavedState(source);
  if (saved) {
    return { kind: 'explicit', center: [saved.center.lng, saved.center.lat], zoom: saved.zoom };
  }
  if (config.initialCenter || config.initialZoom !== undefined) {
    return { kind: 'explicit', center: config.initialCenter ? [...config.initialCenter] : undefined, zoom: config.initialZoom };
  }
  return { kind: 'fit-data' };
}

export function prepareMapOverlays(places: MapPlace[], overlays: Overlay[] = [], generatedOverlays: Overlay[] = []): OverlayPreparationResult {
  const planPlaces = clonePlacesForPlan(places);
  const embedded = extractEmbeddedOverlays(planPlaces);
  const allOverlays = [...overlays, ...generatedOverlays, ...embedded.overlays];
  return {
    places: resolveRenderedPlaces(planPlaces, allOverlays),
    overlays: allOverlays,
    errors: embedded.errors,
  };
}

export function createMapRenderPlan(options: CreateMapRenderPlanOptions): MapRenderPlan {
  const prepared = prepareMapOverlays(options.places, options.overlays ?? [], options.generatedOverlays ?? []);
  const source = options.source;
  const camera = options.camera;
  const trackVisibility: TrackVisibilityResult = resolveTrackVisibility({
    places: prepared.places,
    settings: options.config,
    clusteringEnabled: options.clusteringEnabled,
    overlays: prepared.overlays,
  });
  const runtime: MapRuntimeContext = {
    source,
    camera,
    overlays: prepared.overlays,
    trackVisibility,
    unifiedClusteringActive: options.clusteringEnabled && options.config.clusterGeoJsonOverlays,
    contextMenuActions: options.contextMenuActions ?? [],
    onPlaceAction: options.onPlaceAction,
    placeNoteHost: options.placeNoteHost,
    reverseGeocodeHost: options.reverseGeocodeHost,
    inspectTrack: options.inspectTrack,
    trackLoader: options.trackLoader,
    mapTools: options.mapTools ?? [],
    terrainDem: options.terrainDem,
    reliefDem: options.reliefDem,
    markerVisibilityHiddenIds: options.markerVisibilityHiddenIds,
    popupDebug: options.popupDebug,
    prepareTimings: options.prepareTimings,
  };

  const renderables = buildRenderables(prepared.places, prepared.overlays, options.config, trackVisibility);
  const boundsSignature = createBoundsSignature(prepared.places, prepared.overlays);
  const signature = renderSignature({
    surfaceKind: options.surfaceKind,
    renderables: renderables.map(renderable => [renderable.id, renderable.signature]),
    boundsSignature,
    clusteringEnabled: options.clusteringEnabled,
    settings: pickPlanSettings(options.config),
  });

  return {
    surfaceKind: options.surfaceKind,
    places: prepared.places,
    overlays: prepared.overlays,
    config: options.config,
    runtime,
    clusteringEnabled: options.clusteringEnabled,
    renderables,
    boundsSignature,
    signature,
    camera,
    markerVisibilityHiddenIds: options.markerVisibilityHiddenIds,
    errors: prepared.errors,
  };
}

export function getRenderPlanRenderableSignatures(plan: MapRenderPlan): Map<string, string> {
  return new Map(plan.renderables.map(renderable => [renderable.id, renderable.signature]));
}

export function hasRenderableSignatureChanges(previous: MapRenderPlan | null | undefined, next: MapRenderPlan): boolean {
  const diff = diffMapRenderPlans(previous, next);
  return diff.added.length > 0 || diff.removed.length > 0 || diff.updated.length > 0;
}

export function diffMapRenderPlans(previous: MapRenderPlan | null | undefined, next: MapRenderPlan): MapRenderPlanDiff {
  if (!previous) {
    return {
      added: [...next.renderables],
      removed: [],
      updated: [],
      unchanged: [],
    };
  }

  const previousById = new Map(previous.renderables.map(renderable => [renderable.id, renderable]));
  const added: MapRenderable[] = [];
  const updated: Array<{ previous: MapRenderable; next: MapRenderable }> = [];
  const unchanged: MapRenderable[] = [];

  for (const nextRenderable of next.renderables) {
    const previousRenderable = previousById.get(nextRenderable.id);
    if (!previousRenderable) {
      added.push(nextRenderable);
      continue;
    }
    previousById.delete(nextRenderable.id);

    if (previousRenderable.signature !== nextRenderable.signature) {
      updated.push({ previous: previousRenderable, next: nextRenderable });
    } else {
      unchanged.push(nextRenderable);
    }
  }

  return {
    added,
    removed: [...previousById.values()],
    updated,
    unchanged,
  };
}

export function summarizeMapRenderPlanDiff(diff: MapRenderPlanDiff): Record<string, number> {
  const summary: Record<string, number> = {};
  const bump = (key: string, count = 1) => {
    summary[key] = (summary[key] ?? 0) + count;
  };

  for (const renderable of diff.added) bump(`added:${renderable.kind}`);
  for (const renderable of diff.removed) bump(`removed:${renderable.kind}`);
  for (const entry of diff.updated) bump(`updated:${entry.next.kind}`);
  if (diff.unchanged.length > 0) bump('unchanged', diff.unchanged.length);
  return summary;
}

export function classifyMapRenderPlanChanges(previous: MapRenderPlan, next: MapRenderPlan, diff = diffMapRenderPlans(previous, next)): Set<MapIncrementalChangeKind> {
  const changes = new Set<MapIncrementalChangeKind>();
  const overlayKind = (kind: RenderableKind) => kind === 'geojson-overlay' || kind === 'image-overlay' || kind === 'vector-tile-overlay';
  const changedRenderables = [
    ...diff.added,
    ...diff.removed,
    ...diff.updated.flatMap(entry => [entry.previous, entry.next]),
  ];

  if (changedRenderables.some(renderable => overlayKind(renderable.kind))) changes.add('overlays');
  if (changedRenderables.some(renderable => !overlayKind(renderable.kind))) changes.add('places');

  if (
    previous.clusteringEnabled !== next.clusteringEnabled
    || previous.runtime.unifiedClusteringActive !== next.runtime.unifiedClusteringActive
    || previous.config.clusteringEnabled !== next.config.clusteringEnabled
    || previous.config.clusterThreshold !== next.config.clusterThreshold
    || previous.config.clusterGeoJsonOverlays !== next.config.clusterGeoJsonOverlays
  ) {
    changes.add('clustering');
  }

  const terrainSettings = (plan: MapRenderPlan) => ({
    terrainProvider: plan.config.terrainProvider,
    terrainExaggeration: plan.config.terrainExaggeration,
    hillshadeIntensity: plan.config.hillshadeIntensity,
    hillshadeMethod: plan.config.hillshadeMethod,
    hillshadeDirection: plan.config.hillshadeDirection,
    hillshadeShadowColor: plan.config.hillshadeShadowColor,
    hillshadeHighlightColor: plan.config.hillshadeHighlightColor,
    hillshadeAccentColor: plan.config.hillshadeAccentColor,
    colorReliefOpacity: plan.config.colorReliefOpacity,
    colorReliefColors: plan.config.colorReliefColors,
    terrainDem: plan.runtime.terrainDem,
    reliefDem: plan.runtime.reliefDem,
  });
  if (stableSignature(terrainSettings(previous)) !== stableSignature(terrainSettings(next))) {
    changes.add('terrain');
  }

  const presentationSettings = (plan: MapRenderPlan) => ({
    mapProvider: plan.config.mapProvider,
    showLabels: plan.config.showLabels,
    markerRenderer: plan.config.markerRenderer,
    trackColorBy: plan.config.trackColorBy,
    trackOutline: plan.config.trackOutline,
    trackDefaultVisibility: plan.config.trackDefaultVisibility,
    minZoom: plan.config.minZoom,
    style: plan.config.style,
    iconStyles: plan.config.iconStyles,
    labelStyles: plan.config.labelStyles,
    poiDiscovery: plan.config.poiDiscovery,
    poiFilterPatterns: plan.config.poiFilterPatterns,
    pitch: plan.config.pitch,
    heatmapLayer: plan.config.heatmapLayer,
    heatmapColorScheme: plan.config.heatmapColorScheme,
    trackBuilder: plan.config.trackBuilder,
  });
  if (stableSignature(presentationSettings(previous)) !== stableSignature(presentationSettings(next))) {
    changes.add('styles');
  }
  if (stableSignature(previous.config.tools ?? {}) !== stableSignature(next.config.tools ?? {})) {
    changes.add('tools');
  }

  return changes;
}

export function hasRenderableChanges(diff: MapRenderPlanDiff | null | undefined, predicate: (renderable: MapRenderable) => boolean): boolean {
  if (!diff) return true;
  return diff.added.some(predicate)
    || diff.removed.some(predicate)
    || diff.updated.some(entry => predicate(entry.next) || predicate(entry.previous));
}

export function hasOverlayRenderableChanges(diff: MapRenderPlanDiff | null | undefined): boolean {
  return hasRenderableChanges(diff, renderable => renderable.kind === 'geojson-overlay' || renderable.kind === 'image-overlay' || renderable.kind === 'vector-tile-overlay');
}

export function hasTrackRenderableChanges(diff: MapRenderPlanDiff | null | undefined): boolean {
  return hasRenderableChanges(diff, renderable => renderable.kind === 'note-track');
}

export function resolveRenderedPlaces(places: MapPlace[], overlays: Overlay[]): MapPlace[] {
  if (places.length > 0 || overlays.length === 0) {
    return places;
  }

  const centerCoordinate = extractCenterCoordinateFromOverlays(overlays);
  return centerCoordinate ? [createHiddenCenterMarker(centerCoordinate.latitude, centerCoordinate.longitude)] : places;
}

export function extractEmbeddedOverlays(places: MapPlace[]): { overlays: Overlay[]; errors: Array<{ path: string; error: string }> } {
  const overlays: Overlay[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  const processedPaths = new Set<string>();

  for (const place of places) {
    if (!place.filePath || processedPaths.has(place.filePath)) {
      continue;
    }

    processedPaths.add(place.filePath);

    if (place.overlay?.geojson && isRouteOverlayGeoJson(place.overlay.geojson)) {
      place.trackDefaultVisibility = 'hidden';
      place.metadata = {
        ...(place.metadata ?? {}),
        boundsAnchor: true,
      };
      overlays.push({
        type: 'geojson',
        source: place.filePath,
        geojson: place.overlay.geojson,
        zoom: readZoomRangeFromRecord(place.metadata, 'overlay'),
      });
      continue;
    }

    if (hasTrackData(place) || place.trackDefaultVisibility === 'hidden') {
      continue;
    }

    try {
      const overlay = clonePlaceOverlayForMutation(place);
      const geojson = overlay?.geojson;
      if (!geojson) continue;

      if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
        for (const feature of geojson.features) {
          if (!feature.properties) feature.properties = {};
          if (!feature.properties.stroke) {
            feature.properties.stroke = place.trackColor || TRACK_STYLE_DEFAULTS.color;
          }
          if (!feature.properties['stroke-width']) {
            feature.properties['stroke-width'] = place.trackWeight ?? TRACK_STYLE_DEFAULTS.weight;
          }
          if (!feature.properties['stroke-opacity']) {
            feature.properties['stroke-opacity'] = place.trackOpacity ?? TRACK_STYLE_DEFAULTS.opacity;
          }
        }
      }

      overlays.push({
        type: 'geojson',
        source: place.filePath,
        geojson,
        zoom: readZoomRangeFromRecord(place.metadata, 'overlay'),
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.warn(`Failed to extract embedded overlay data from ${place.filePath}:`, error);
      errors.push({ path: place.filePath, error: errorMessage });
    }
  }

  return { overlays, errors };
}

function clonePlacesForPlan(places: MapPlace[]): MapPlace[] {
  return places.map(place => ({ ...place }));
}

function clonePlaceOverlayForMutation(place: MapPlace): MapPlaceOverlay | undefined {
  place.overlay = clonePlaceOverlay(place.overlay);
  return place.overlay;
}

function clonePlaceOverlay(overlay: MapPlaceOverlay | undefined): MapPlaceOverlay | undefined {
  if (!overlay) return undefined;
  return {
    ...overlay,
    geojson: cloneJsonCompatibleValue(overlay.geojson),
    track: overlay.track ? {
      ...overlay.track,
      elevation: overlay.track.elevation ? [...overlay.track.elevation] : undefined,
      waypoints: overlay.track.waypoints ? overlay.track.waypoints.map(waypoint => ({ ...waypoint })) : undefined,
    } : undefined,
    style: overlay.style ? { ...overlay.style } : undefined,
    pathLabels: overlay.pathLabels ? cloneJsonCompatibleValue(overlay.pathLabels) : undefined,
  };
}

function cloneJsonCompatibleValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildRenderables(places: MapPlace[], overlays: Overlay[], config: ResolvedMapConfig, trackVisibility: TrackVisibilityResult): MapRenderable[] {
  const renderables: MapRenderable[] = [];

  for (const place of places) {
    const placeId = getPlaceId(place);
    renderables.push({
      id: `marker:${placeId}`,
      kind: 'marker',
      owner: 'place',
      sourcePath: place.filePath,
      layerIds: [],
      signature: getPlaceMarkerRenderSignature(place),
      visibility: { data: true, cluster: 'hide-when-clustered', zoom: place.iconStyle?.zoom ?? place.markerZoom },
    });

    if (config.showLabels) {
      renderables.push({
        id: `label:${placeId}`,
        kind: 'label',
        owner: 'place',
        sourcePath: place.filePath,
        layerIds: [],
        signature: renderSignature({ placeId, labelStyle: place.labelStyle, name: place.name, zoom: place.labelStyle?.zoom ?? place.labelZoom }),
        visibility: { data: true, cluster: 'hide-when-clustered', zoom: place.labelStyle?.zoom ?? place.labelZoom },
      });
    }
  }

  for (const state of trackVisibility.placeStates) {
    const placeId = state.placeId;
    renderables.push({
      id: `note-track:${placeId}`,
      kind: 'note-track',
      owner: 'place',
      sourcePath: state.place.filePath,
      sourceId: `dynamic-overlay-${placeId}`,
      layerIds: [`dynamic-overlay-${placeId}-line`, `dynamic-overlay-${placeId}-hitarea`],
      signature: getTrackStateRenderSignature(state),
      visibility: {
        data: true,
        cluster: 'hide-when-clustered',
        userToggle: state.showOnLoad ? 'open' : 'closed',
        zoom: state.place.trackZoom,
      },
    });
  }

  overlays.forEach((overlay, index) => {
    const isEmbedded = overlay.source.endsWith('.md');
    if (isGeoJSONOverlay(overlay)) {
      const sourceId = `geojson-overlay-${index}`;
      renderables.push({
        id: `geojson-overlay:${index}:${overlay.source}`,
        kind: 'geojson-overlay',
        owner: isEmbedded ? 'embedded' : 'block',
        sourcePath: overlay.source,
        sourceId,
        layerIds: [
          `${sourceId}-fill`,
          `${sourceId}-fill-outline`,
          `${sourceId}-line`,
          `${sourceId}-line-hitarea`,
          `${sourceId}-circle`,
          `${sourceId}-route-label`,
          `${sourceId}-route-endpoint-label`,
        ],
        signature: renderSignature({ source: overlay.source, geojson: overlay.geojson ? stableSignatureCached(overlay.geojson) : '', zoom: overlay.zoom, labelTemplate: overlay.labelTemplate, waypointLabelTemplate: overlay.waypointLabelTemplate, style: overlay.style, hoverStyle: overlay.hoverStyle }),
        visibility: {
          data: true,
          cluster: isEmbedded ? 'hide-when-clustered' : 'always',
          zoom: mergeZoomRanges(overlay.zoom),
        },
      });
    } else if (isImageOverlay(overlay)) {
      renderables.push({
        id: `image-overlay:${index}:${overlay.source}`,
        kind: 'image-overlay',
        owner: 'block',
        sourcePath: overlay.source,
        sourceId: `image-overlay-${index}`,
        layerIds: [`image-overlay-layer-${index}`],
        signature: renderSignature(overlay),
        visibility: { data: true, cluster: 'always', zoom: mergeZoomRanges(overlay.zoom) },
      });
    } else if (isVectorTileOverlay(overlay)) {
      renderables.push({
        id: `vector-tile-overlay:${index}:${overlay.source}`,
        kind: 'vector-tile-overlay',
        owner: 'block',
        sourcePath: overlay.source,
        // Entries with an identical source definition share one sourceId (one GL source); layer ids stay per-index.
        sourceId: createVectorTileOverlaySourceId(overlay),
        layerIds: [`vector-tile-overlay-layer-${index}`],
        signature: renderSignature(overlay),
        visibility: { data: true, cluster: 'always', zoom: mergeZoomRanges(overlay.zoom) },
      });
    }
  });

  return renderables;
}

function pickPlanSettings(settings: ResolvedMapConfig): Record<string, unknown> {
  return {
    height: settings.height,
    width: settings.width,
    style: settings.style,
    showLabels: settings.showLabels,
    trackColorBy: settings.trackColorBy,
    trackOutline: settings.trackOutline,
    trackDefaultVisibility: settings.trackDefaultVisibility,
    trackGradeWindow: settings.trackGradeWindow,
    trackSpeedWindow: settings.trackSpeedWindow,
    clusteringEnabled: settings.clusteringEnabled,
    clusterThreshold: settings.clusterThreshold,
    clusterGeoJsonOverlays: settings.clusterGeoJsonOverlays,
    trackBuilder: settings.trackBuilder,
    tools: settings.tools,
    pitch: settings.pitch,
  };
}

function createHiddenCenterMarker(lat: number, lng: number): MapPlace {
  return {
    latitude: lat,
    longitude: lng,
    name: '',
    icon: '',
    iconStyle: { inlineCss: 'display: none', classes: [], opacity: 0 },
  };
}

function extractCenterCoordinateFromOverlays(overlays: Overlay[]): { latitude: number; longitude: number } | null {
  const imageOverlay = overlays.find(isImageOverlay);
  if (imageOverlay) {
    const bounds = new PlacesBoundingBox();
    if (imageOverlay.bounds) {
      bounds.update(imageOverlay.bounds.swLat, imageOverlay.bounds.swLng);
      bounds.update(imageOverlay.bounds.neLat, imageOverlay.bounds.neLng);
    } else if (imageOverlay.corners) {
      bounds.update(imageOverlay.corners.nwLat, imageOverlay.corners.nwLng);
      bounds.update(imageOverlay.corners.neLat, imageOverlay.corners.neLng);
      bounds.update(imageOverlay.corners.seLat, imageOverlay.corners.seLng);
      bounds.update(imageOverlay.corners.swLat, imageOverlay.corners.swLng);
    }
    if (bounds.isValid()) {
      const [lat, lng] = bounds.getLatLngCenter();
      return { latitude: lat, longitude: lng };
    }
  }

  for (const overlay of overlays.filter(isGeoJSONOverlay)) {
    const bounds = PlacesBoundingBox.fromGeoJSON(overlay.geojson);
    if (bounds.isValid()) {
      const [lng, lat] = bounds.getLngLatCenter();
      return { latitude: lat, longitude: lng };
    }
  }

  const vectorTileOverlay = overlays.find(isVectorTileOverlay);
  if (vectorTileOverlay?.bounds) {
    const [west, south, east, north] = vectorTileOverlay.bounds;
    return {
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
    };
  }

  return null;
}

const geoJsonBoundsCache = new WeakMap<object, PlacesBoundingBox>();
function getGeoJsonBoundsCached(geojson: GeoJSON.GeoJSON | undefined): PlacesBoundingBox {
  if (!geojson) return new PlacesBoundingBox();
  let bounds = geoJsonBoundsCache.get(geojson);
  if (bounds === undefined) {
    bounds = PlacesBoundingBox.fromGeoJSON(geojson);
    geoJsonBoundsCache.set(geojson, bounds);
  }
  return bounds;
}

function createBoundsSignature(places: MapPlace[], overlays: Overlay[]): string {
  const bounds = new PlacesBoundingBox();
  for (const place of places) {
    bounds.update(place.latitude, place.longitude);
  }
  for (const overlay of overlays) {
    if (isGeoJSONOverlay(overlay)) {
      const overlayBounds = getGeoJsonBoundsCached(overlay.geojson);
      if (overlayBounds.isValid()) {
        const [[minLng, minLat], [maxLng, maxLat]] = overlayBounds.getLngLatBounds();
        bounds.update(minLat, minLng);
        bounds.update(maxLat, maxLng);
      }
    } else if (isImageOverlay(overlay)) {
      if (overlay.bounds) {
        bounds.update(overlay.bounds.swLat, overlay.bounds.swLng);
        bounds.update(overlay.bounds.neLat, overlay.bounds.neLng);
      } else if (overlay.corners) {
        bounds.update(overlay.corners.nwLat, overlay.corners.nwLng);
        bounds.update(overlay.corners.neLat, overlay.corners.neLng);
        bounds.update(overlay.corners.seLat, overlay.corners.seLng);
        bounds.update(overlay.corners.swLat, overlay.corners.swLng);
      }
    } else if (isVectorTileOverlay(overlay) && overlay.bounds) {
      const [west, south, east, north] = overlay.bounds;
      bounds.update(south, west);
      bounds.update(north, east);
    }
  }

  return bounds.isValid() ? renderSignature(bounds.getLngLatBounds()) : 'empty';
}

function isRouteOverlayGeoJson(geojson: GeoJSON.FeatureCollection): boolean {
  return geojson.features.some((feature) => {
    const properties = feature.properties ?? {};
    return Boolean(
      properties.route_label ||
      properties.route_label_point ||
      properties.route_endpoint ||
      properties.route_endpoint_label ||
      properties.duration_text ||
      properties.duration_seconds ||
      properties.provider
    );
  });
}

function renderSignature(value: unknown): string {
  return stableSignature(value);
}
