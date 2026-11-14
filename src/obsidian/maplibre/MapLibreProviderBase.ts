import { attachMapTileRecovery } from './MapTileRecovery';
import { createGeoJsonPolygonLayers } from '../../maplibre/OverlayRendering';
import { finishWork, runCooperativeWork } from "../../utils/index";
import { openLocalFile } from "../utils/index";
import { appendTrackInspectionSection } from "../../map/index";
import { popupContentSignal } from "../map/index";
import { resolveOverlayTrackData, TrackResidencyBudget } from "../../track/index";
import { geoJsonFootprint, type GeoJsonFootprint } from "../../geo/index";
import { sharedRegistryValue } from "../../utils/index";
import { isStyleHidden } from "../../place/index";
import { App, Component } from "obsidian";
import type * as GeoJSON from "geojson";
import { loggedRequestUrl as requestUrl, stableSignature } from "../../utils/index";
import { hasTrackData } from "../../place/index";
import { type UnitsSystem } from "../../units/index";
import { PlacesBoundingBox, convertPlacesToGeoJSONData } from "../../geo/index";
import { TRACK_STYLE_DEFAULTS, PlaceTrackState, TrackVisibilityResult, CompleteTrackStyle, getPlaceId, getPlaceMarkerRenderSignature, getStyleForPlace, getTrackRenderSignature, syncVisibleTrackEntries, collectViewportTrackCandidates, selectViewportTracks, type TrackColorBy } from "../../track/index";
import { MapPlace, parseMapPlaceProperty, extendBoundingBoxWithOverlays, extractOverlayPointFeatures as extractOverlayPointFeaturesFromOverlays, getGeoJsonFeatures, type Overlay } from "../../overlay/index";
import { ViewportClusteringManager, resolveClusteringDecision, buildPagedPopupContent, appendPlaceSection, appendPopupDebugSection, createMapHit, createFeatureHit, createOverlayPointHit, orderMapHits, type MapHit, buildWaypointPopupContent, buildGeocodingSearchPopupContent, type MapProviderLifecycle, getMapProviderState, setMapProviderState, clearMapProviderState, estimateInitialZoom, updateZoomContainerState, type ZoomRange, ensureMapSurfaceLifecycle, ensureTrackDirectionArrowImage, ensureWaypointMarkerImage, dispatchMapTrackSelection, onMapTrackSelection, TRACK_INSPECTION_REQUEST_EVENT, TRACK_POINT_SELECT_EVENT, toGlMaxZoom, hasPlaceMarker, isNonInteractivePlace, attachMapSurfacePlumbing, persistMapViewport } from "../../map/index";
import { createContentPopup, createPlaceSummaryPopup, closeExistingPopups, TileCache, createGradientColoredGeoJson, prepareGradientColoredGeoJson, setupVectorContextMenu, TrackDetailsPanel, configureMapContainer, setSearchResultMarkers, resolveOverlayPointSource, buildOverlayPointPopup } from "../map/index";
import { renderPopupTargetContentCore } from "../map/index";
import { IPlaceExtensionSettings, type MapRenderRequest, type ResolvedMapConfig, type ClusterStyleKind, DEFAULT_GRADE_WINDOW, type MapToolAttachment, type MapToolFactory, type MetricWindow } from "../../settings/index";
import { MapBlockProcessorBase, CommonMapSettings } from "../services/index";
import { type MapDataUpdateContext, type MapDataUpdateResult, type MapControlHandle, type MapCameraApplyResult, type MapIncrementalUpdateCapabilities } from "../../services/index";
import { resolveFitDataCamera, hasOverlayRenderableChanges, hasTrackRenderableChanges, hasRenderableChanges, type MapCameraIntent } from "../../render/index";
import { renderMapSurfaceError, parseContributingFiles, MapConstants, logger, getErrorMessage, createPerformanceMonitor, hashString36, heapUsedMB, nextSharedSequence, type PerformanceMonitor } from "../../utils/index";
import type * as maplibregl from 'maplibre-gl';
import { getGl } from '../../maplibre/GlRuntime';
import { resolveStyleTextFont, MapLibreHelper } from './MapLibreHelper';
import { MapState, hasDisplayableContent } from '../../maplibre/MapState';
import { addDebugOverlay, DebugData } from '../../maplibre/MapLibreDebugOverlay';
import { decodeCacheProtocolUrl, encodeCacheProtocolUrl, PLACES_TILE_CACHE_PROTOCOL } from '../../maplibre/CacheProtocolUrl';
import type { DebugTilesetSummary } from "../../map/index";
import { MarkerStyleService } from "../../map/index";
import { buildMarkerOffsetExpressions, collectIconZoomSizeStops, ensureMarkerIconImage, ensureMarkerPictureImage, getMarkerPicture, markerPictureFailed, markerPictureFailedCount, markerPictureFailureCounts, markerPictureImageId, DEFAULT_ICON_IMAGE_QUALITY, type IconImageQuality, releaseMarkerPicture, loadMarkerPictures, takeMarkerPictureLoadTiming, takeStoredPictureCounts, domPictureLoader, getMarkerOffsetLayout, markerIconImageId, type MarkerIconImageHost, type MarkerIconImageResult } from "../../map/index";
import { POIDiscoveryHandler } from './MapLibrePOIDiscovery';
import { assertVectorPmtilesArchive, installPmtilesProtocol, registerPmtilesArchive } from './PmtilesProtocol';
import { MapLibreOverlayHandler } from './MapLibreOverlays';
import { resolveOverlayTileProvider } from '../../maplibre/OverlayTileProviders';
import { setupMapTouchHandlers } from './MapTouchHandler';
import { computePlaceMarkerDiff, applyPlaceMarkerDiff, hasPlaceMarkerDiffChanges } from '../../maplibre/PlaceMarkerDiff';
import { enterVectorFocusMode, clearVectorFocusMode, focusMapMarkerElement, createVectorMapControlHandle, SYMBOL_MARKER_LAYER_ID, SYMBOL_BENEATH_LAYER_ID, SYMBOL_MARKER_LAYER_IDS, SYMBOL_ICON_BASE_OPACITY } from './VectorMapInteractions';
import { handleWebGLContextLost } from './WebGLContextHandler';
import { buildMapLibrePOIFilter, isExpressionFilter, getPOILayerPatterns } from './MapLibrePOIFilter';
import { createPathLabelLayerConfig, createWaypointEmojiLayerConfig, createWaypointLabelLayerConfig, createWaypointLayerConfig } from "../../map/index";
import { setupVectorClusterInteractions } from "../../map/index";
import { createClusterHeatmapPaint, createHeatmapSourceOptions, CLUSTER_HEATMAP_HIT_LIMIT, CLUSTER_HEATMAP_HIT_TOLERANCE_PX } from "../../map/index";
import { findPointFeaturesWithin } from "../map/index";
import { usesNativeMarkerRenderer } from '../../maplibre/MarkerRendererPolicy';
import { applyCameraIntent, withProgrammaticCamera } from '../../maplibre/MapLibreCameraController';
import { applyTerrain } from './MapLibreTerrain';
import { registerPointerCursorLayer } from '../../maplibre/PointerCursorRegistry';
import { applyHillshade, applyColorRelief } from '../../maplibre/MapLibreRelief';
import { createHeatmapGeoJson, renderHeatmap, type MapLibreHeatmapData } from './MapLibreHeatmapRenderer';
import { recordOverlayVisibility } from '../../maplibre/MapLibreOverlayRenderer';
import { removeDynamicOverlay, removeLayersAndSources, removeTrackLayers, setLayerVisibility } from '../../maplibre/MapLibreTrackRenderer';
import { buildSymbolIconSizeExpression, buildSymbolMarkerLayout, isIconHidden, markerVisibilityDenyExpression, symbolIconFilter, symbolLabelFilter, symbolMarkerImage } from '../../maplibre/MapLibreSymbolFilters';
import { ensureApplicationLayerAnchor, lowestLayerId, promotePointIconLayers } from '../../maplibre/MapLibreLayerOrdering';
import { attachMapLibreDevicePositionControl } from './MapLibreDevicePositionControl';
import { ensureWaypointIconImages } from './WaypointIconImages';
import { ViewportTrackBucketData, type ViewportBucketTrack, type ViewportBucketUpdate } from '../../maplibre/ViewportTrackBucketData';
import { MapRenderProfiler, type SubmittedTrackSource } from '../../maplibre/MapRenderProfiler';
import { gradientTrackFeaturesWork } from '../../maplibre/GradientTrackFeatures';

const trackResidencyBudget = sharedRegistryValue(Symbol.for('places.track-source-residency.v1'),
  () => new TrackResidencyBudget(128 * 1024 * 1024, 64 * 1024 * 1024));

function trackEndpointFeatures(geojson: GeoJSON.GeoJSON): GeoJSON.Feature<GeoJSON.Point>[] {
  const features = geojson.type === 'FeatureCollection' ? geojson.features : geojson.type === 'Feature' ? [geojson] : [];
  const lines: GeoJSON.Position[][] = [];

  for (const feature of features) {
    const geometry = feature.geometry;

    if (geometry?.type === 'LineString') lines.push(geometry.coordinates);
    else if (geometry?.type === 'MultiLineString') lines.push(...geometry.coordinates);
  }

  const nonEmpty = lines.filter(line => line.length > 0);

  if (nonEmpty.length === 0) return [];
  const first = nonEmpty[0][0];
  const lastLine = nonEmpty[nonEmpty.length - 1];
  const last = lastLine[lastLine.length - 1];

  return [
    { type: 'Feature', properties: { _placesTrackEndpoint: '●' }, geometry: { type: 'Point', coordinates: first } },
    { type: 'Feature', properties: { _placesTrackEndpoint: '■' }, geometry: { type: 'Point', coordinates: last } },
  ];
}

interface ActiveMapTool {
  factory: MapToolFactory;
  attachment: MapToolAttachment;
  toolConfig: unknown;
}

const activeMapTools = new WeakMap<maplibregl.Map, Map<string, ActiveMapTool>>();

import { getMapLibreResourceRegistry, reportMapLibreCleanupIssues } from '../../maplibre/MapLibreResourceRegistry';
import { KeyedSourceFeed } from '../../maplibre/KeyedSourceFeed';
import { createHtmlMarkerFeature as buildHtmlMarkerFeature, createPointFeature as buildPointFeature, updateTextLabelSource } from '../../maplibre/MapLibreMarkerRenderer';
import { updateClusteredMarkers } from './MapLibreDataUpdater';

export type MapContainer = HTMLElement;

interface MapLibreProviderState {
  controlHandle?: MapControlHandle;
  map: maplibregl.Map;
  lifecycle: MapProviderLifecycle;
  devicePositionControl: ReturnType<typeof attachMapLibreDevicePositionControl> | null;
}

type MapLibreStyle = string | maplibregl.StyleSpecification;

const DEFAULT_TERRAIN_PITCH = 60;
const MAX_PITCH = 85;

const TRACK_HIT_TOLERANCE_PX = 5;
const VECTOR_FEATURE_HIT_LIMIT = 8;

const VIEWPORT_PICTURE_BUFFER = 0.1;

const PICTURE_DECODE_BATCH = 64;
const FOCUSED_MARKER_SORT_BOOST = 1e9;
const FED_SOURCE_IDS: ReadonlySet<string> = new Set([SYMBOL_MARKER_LAYER_ID, 'places-labels']);

const MAX_VIEWPORT_PICTURES = 768;
const MAX_PICTURE_IMAGES = 4096;
const PICTURE_IMAGE_OVERFLOW = 1.25;
const PICTURE_IMAGE_TTL_MS = 300000;

const PICTURE_EVICTION_INTERVAL_MS = 1000;
const PICTURE_DRAW_BUDGET_MS = 8;
const PICTURE_PASS_MAX_ROUNDS = 4;
const SLOW_PICTURE_SELECT_MS = 8;

const CLUSTER_HEATMAP_LAYER_ID = 'places-cluster-heatmap';

function clusterModeLayerIds(clusterStyle: ClusterStyleKind): { clusterLayerId: string; clusterCountLayerId: string | null } {
  return clusterStyle === 'heatmap'
    ? { clusterLayerId: CLUSTER_HEATMAP_LAYER_ID, clusterCountLayerId: null }
    : { clusterLayerId: 'clusters', clusterCountLayerId: 'cluster-count' };
}

interface PictureWork {
  running: boolean;
  drawn: Set<string>;
  requested?: { drawing: boolean };
}

interface MapSourceDataEvent {
  sourceId?: string;
  isSourceLoaded?: boolean;
}

const asStyleText = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
const asStyleNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const RENDER_SEQUENCE_GLOBAL_KEY = '__placesMapLibreRenderSequence';

type SymbolImagePreparation = {
  uniqueImages: number;
  flush: (reason: 'marker-mode' | 'cleanup') => void;
};
interface ViewportTrackController {
  setClustering: (active: boolean) => void;
  isManaged: (placeId: string) => boolean;
  isHidden: (placeId: string) => boolean;
  setHidden: (placeId: string, hidden: boolean) => void;
  setFilterHiddenIds: (hiddenIds: ReadonlySet<string>) => void;
  replaceCandidates: (places: MapPlace[], visibility: TrackVisibilityResult, settings: CommonMapSettings, signatures?: ReadonlyMap<string, string>) => void;
  setPerformanceMonitor: (perf: PerformanceMonitor) => void;
}

interface ViewportTrackRenderData {
  style: CompleteTrackStyle & { outline: boolean };
  bucketKey: string;
  preserveShortLines: boolean;
  renderSignature: string;
}

function symbolClusteringSignature(blockSettings: ResolvedMapConfig, overlayPointCount: number): string {
  return `${blockSettings.clusterThreshold}|${blockSettings.clusterGeoJsonOverlays}|${overlayPointCount > 0}|${blockSettings.clusterStyle}|${blockSettings.clusterStyle === 'heatmap' ? blockSettings.heatmapColorScheme ?? '' : ''}`;
}

export abstract class MapLibreProviderBase extends MapBlockProcessorBase {
  protected app: App;
  protected extensionSettings: IPlaceExtensionSettings;
  private poiDiscoveryHandler: POIDiscoveryHandler;
  private overlayHandler: MapLibreOverlayHandler;
  private static tileCacheProtocolRegistered = false;
  private static readonly auditedStyleDocuments = new WeakSet<Document>();
  private static readonly deduplicatedStyleCounts = new WeakMap<Document, number>();
  private initializedMaps = new WeakSet<maplibregl.Map>();
  private readonly renderProfiler = new MapRenderProfiler();
  private viewportTrackCleanups = new WeakMap<maplibregl.Map, () => void>();
  private viewportTrackControllers = new WeakMap<maplibregl.Map, ViewportTrackController>();
  private symbolImagePreparationCleanups = new WeakMap<maplibregl.Map, () => void>();
  private overlayPointLayers = new WeakMap<maplibregl.Map, Map<string, { sourcePath?: string; trackWaypoints: boolean }>>();
  private trackLineLayers = new WeakMap<maplibregl.Map, Map<string, string | undefined>>();
  private mapHitClickWiredMaps = new WeakSet<maplibregl.Map>();
  private trackInspectionPanels = new WeakMap<maplibregl.Map, TrackDetailsPanel>();
  private symbolVisibilityHidden = new WeakMap<maplibregl.Map, readonly string[]>();
  private trackUserVisibility = new WeakMap<maplibregl.Map, Map<string, boolean>>();
  private symbolClusterData = new WeakMap<maplibregl.Map, { features: GeoJSON.Feature[]; renderedPlaces: MapPlace[]; overlayPointFeatures: GeoJSON.Feature[] }>();
  private viewportPictureSyncInstalled = new WeakSet<maplibregl.Map>();
  private readonly pictureSourceRefreshPending = new WeakSet<maplibregl.Map>();
  private readonly glyphImageIds = new WeakMap<MapPlace, string>();
  private readonly pictureImageIds = new WeakMap<MapPlace, { quality: IconImageQuality; id: string }>();
  private readonly symbolStacked = new WeakMap<maplibregl.Map, boolean>();
  private readonly symbolFocusedPlaceIds = new WeakMap<maplibregl.Map, string>();
  private readonly symbolSortKeySignatures = new WeakMap<maplibregl.Map, string>();
  private readonly sourceFeeds = new WeakMap<maplibregl.Map, Map<string, KeyedSourceFeed>>();
  private readonly clusterHitFeatures = new WeakMap<maplibregl.Map, GeoJSON.Feature[]>();
  private readonly pointFeatures = new WeakMap<MapPlace, { feature: GeoJSON.Feature; iconImageId: string; glyphImageId: string; stopsKey: string; mapAlignedIcons: boolean }>();
  private pictureImages = new WeakMap<maplibregl.Map, Map<string, number>>();
  private viewportPictureWork = new WeakMap<maplibregl.Map, PictureWork>();
  private pictureEvictionAt = new WeakMap<maplibregl.Map, number>();
  private pictureIdsAdded = new WeakMap<maplibregl.Map, number>();
  private clusterInteractionsInstalled = new WeakSet<maplibregl.Map>();
  private symbolClusteringSignature = new WeakMap<maplibregl.Map, string>();
  private mapboxSymbolFeatures = new WeakMap<maplibregl.GeoJSONSource, Map<string | number, GeoJSON.Feature>>();

  readonly supportsLiveMarkerVisibility = true;

  private static nextRenderId(): number {
    return nextSharedSequence(RENDER_SEQUENCE_GLOBAL_KEY);
  }

  private getDocumentStyleAudit(document: Document): Record<string, number> {
    const styleElements = Array.from(document.querySelectorAll<HTMLStyleElement>('style'))
      .filter(style => {
        const text = style.textContent ?? '';

        return text.includes('places-') || text.includes('maplibre') || text.includes('mapboxgl') || text.includes('leaflet');
      });
    const hashCounts = new Map<string, number>();

    for (const style of styleElements) {
      const text = style.textContent ?? '';

      if (!text.trim()) continue;
      const hash = hashString36(text);

      hashCounts.set(hash, (hashCounts.get(hash) ?? 0) + 1);
    }

    return {
      documentStyleBlocks: styleElements.length,
      duplicateStyleBlockGroups: Array.from(hashCounts.values()).filter(count => count > 1).length,
      deduplicatedStyleBlocks: MapLibreProviderBase.deduplicatedStyleCounts.get(document) ?? 0,
    };
  }

  private deduplicateDocumentStyles(document: Document): void {
    if (MapLibreProviderBase.auditedStyleDocuments.has(document)) return;
    MapLibreProviderBase.auditedStyleDocuments.add(document);

    const seen = new Set<string>();
    let removed = 0;

    for (const style of Array.from(document.querySelectorAll<HTMLStyleElement>('style'))) {
      const text = style.textContent ?? '';

      if (!text.trim() || !(text.includes('places-') || text.includes('maplibre') || text.includes('mapboxgl') || text.includes('leaflet'))) continue;

      if (seen.has(text)) {
        style.remove();
        removed += 1;
      } else {
        seen.add(text);
      }
    }

    MapLibreProviderBase.deduplicatedStyleCounts.set(document, removed);

    if (removed > 0) {
      logger.scope('MapSurface').debug('Removed duplicate map style blocks', { removed });
    }
  }

  private getMapRuntimeAudit(map: maplibregl.Map, container: HTMLElement): Record<string, number> {
    const style = map.getStyle();

    return {
      mapSources: Object.keys(style.sources ?? {}).length,
      mapLayers: style.layers?.length ?? 0,
      mapMarkerNodes: container.querySelectorAll('.maplibregl-marker, .mapboxgl-marker').length,
      placeMarkerNodes: container.querySelectorAll('.places-marker').length,
      ...this.getDocumentStyleAudit(container.ownerDocument),
    };
  }

  private getRuntimeIdentity(map: maplibregl.Map): Record<string, unknown> {
    const runtime = getGl();

    return {
      provider: this.getProviderClassName(),
      integration: this.getProviderIntegration(),
      engine: this.getProviderClassName() === 'mapbox' ? 'mapbox-gl' : 'maplibre-gl',
      engineVersion: runtime.getVersion?.() ?? 'unknown',
      mapClass: map.constructor?.name ?? 'unknown',
      protocolSupport: typeof runtime.addProtocol === 'function',
    };
  }

  constructor(app: App, extensionSettings: IPlaceExtensionSettings, private readonly units: UnitsSystem, developerMode = false) {
    super();
    this.app = app;
    this.extensionSettings = extensionSettings;
    this.developerMode = developerMode;
    this.poiDiscoveryHandler = new POIDiscoveryHandler();
    this.overlayHandler = new MapLibreOverlayHandler(app, {
      registerPmtilesArchive: async (url) => {
        registerPmtilesArchive(app, url, (name, loadFn) => this.addMapLibreProtocol(name, loadFn));

        await assertVectorPmtilesArchive(url);
      },
      onFeatureHitLayer: (map, layerId) => {
        MapLibreHelper.addPointerCursor(map, layerId);
        this.wireMapHitClick(map);
      },
    });
  }

  protected addMapLibreProtocol(customProtocol: string, loadFn: Parameters<typeof maplibregl.addProtocol>[1]): void {
    getGl().addProtocol?.(customProtocol, loadFn);
  }

protected abstract getStyleUrl(style: string): MapLibreStyle | undefined;
  protected abstract getProviderClassName(): string;

  protected getProviderIntegration(): string {
    return 'maplibre-gl';
  }

  protected constructMap(options: maplibregl.MapOptions): maplibregl.Map {
    return new (getGl().Map)(options);
  }

  private getProviderStateId(): string {
    return `maplibre:${this.getProviderClassName()}`;
  }

  private getMapInstance(container: HTMLElement): maplibregl.Map | undefined {
    return getMapProviderState<MapLibreProviderState>(container, this.getProviderStateId())?.map;
  }

  private attachMapTool(map: maplibregl.Map, container: HTMLElement, request: MapRenderRequest, factory: MapToolFactory): ActiveMapTool | undefined {
    if (factory.engine !== 'maplibre') return undefined;
    const toolConfig = request.config.tools[factory.id];
    const attachment = this.buildMapToolAttachment(map, container, request, factory, toolConfig);

    if (!attachment) return undefined;
    const entry = { factory, attachment, toolConfig };
    const tools = activeMapTools.get(map) ?? new Map<string, ActiveMapTool>();

    activeMapTools.set(map, tools);
    tools.set(factory.id, entry);
    let disposed = false;

    getMapLibreResourceRegistry(map).registerDisposer('disposer', `map-tool:${factory.id}`, () => {
      if (disposed) return;
      disposed = true;
      attachment.destroy();
      if (tools.get(factory.id)?.attachment === attachment) tools.delete(factory.id);
    }, `map-tool:${factory.id}`);

    return entry;
  }

  private buildMapToolAttachment(map: maplibregl.Map, container: HTMLElement, request: MapRenderRequest, factory: MapToolFactory, toolConfig: unknown): MapToolAttachment | undefined {
    try {
      return this.attachMapToolUnguarded(map, container, request, factory);
    } catch (error) {
      logger.scope('MapLibre').error('map tool failed to attach', {
        tool: factory.id,
        source: request.runtime.source.path,
        toolConfig,
        error: getErrorMessage(error),
      });

      return undefined;
    }
  }

  private attachMapToolUnguarded(map: maplibregl.Map, container: HTMLElement, request: MapRenderRequest, factory: MapToolFactory): MapToolAttachment | undefined {
    return factory.attach({
      app: this.app,
      map,
      engineApi: {
        Marker: getGl().Marker,
        runProgrammaticCamera: move => withProgrammaticCamera(map, move),
        getPlacePositionHandle: placeId => {
          const marker = MapState.for(map).getPlaceMarker(placeId);

          if (marker) return { setLngLat: coordinate => { marker.setLngLat(coordinate); } };
          const source = map.getSource<maplibregl.GeoJSONSource>(SYMBOL_MARKER_LAYER_ID);

          if (!source || typeof source.updateData !== 'function') return undefined;

          return {
            setLngLat: coordinate => {
              if (this.getProviderIntegration() === 'mapbox-gl') {
                const features = this.mapboxSymbolFeatures.get(source);
                const feature = features?.get(placeId);

                if (!features || !feature) return;
                features.set(placeId, { ...feature, geometry: { type: 'Point', coordinates: coordinate } });
                void source.setData({ type: 'FeatureCollection', features: [...features.values()] });

                return;
              }

              void source.updateData({
                update: [{ id: placeId, newGeometry: { type: 'Point', coordinates: coordinate } }],
              });
              this.sourceFeeds.get(map)?.get(SYMBOL_MARKER_LAYER_ID)?.forget(placeId);
            },
          };
        },
        getSelectableTracks: () => MapState.for(map).getCurrentPlaces().filter(place => hasTrackData(place) && Boolean(place.filePath)),
        onTrackSelected: handler => {
          return onMapTrackSelection(container, selection => {
            if (selection.intent === 'preview') handler(selection);
          });
        },
      },
      container,
      source: request.runtime.source,
      config: request.config,
      toolConfig: request.config.tools[factory.id],
      trackLoader: request.runtime.trackLoader,
      placeNoteHost: request.runtime.placeNoteHost,
    });
  }

  private syncMapTools(map: maplibregl.Map, container: HTMLElement, request: MapRenderRequest): MapDataUpdateResult {
    const tools = activeMapTools.get(map) ?? new Map<string, ActiveMapTool>();

    activeMapTools.set(map, tools);
    const factories = new Map(request.runtime.mapTools.filter(factory => factory.engine === 'maplibre').map(factory => [factory.id, factory]));

    for (const [id, active] of [...tools]) {
      const factory = factories.get(id);
      const nextConfig = request.config.tools[id];

      if (!factory || nextConfig === undefined || nextConfig === false) {
        getMapLibreResourceRegistry(map).disposeOwner(`map-tool:${id}`);
        continue;
      }

      if (JSON.stringify(active.toolConfig) === JSON.stringify(nextConfig)) continue;

      if (!active.attachment.update?.({ config: request.config, toolConfig: nextConfig })) {
        return { updated: false, status: 'requires-rebuild', reason: `map tool "${id}" requires rebuild for this configuration change` };
      }

      active.toolConfig = nextConfig;
      active.factory = factory;
    }

    for (const [id, factory] of factories) {
      const toolConfig = request.config.tools[id];

      if (tools.has(id) || toolConfig === undefined || toolConfig === false) continue;
      this.attachMapTool(map, container, request, factory);
    }

    return { updated: true };
  }

  protected getSupportedStyles(): string[] {
    return [];
  }

  protected prepareStyle(blockSettings: ResolvedMapConfig): Promise<MapLibreStyle | undefined> {
    return Promise.resolve(this.getStyleUrl(blockSettings.style));
  }

  private supportsRequestRouting(): boolean {
    return getGl().addProtocol !== undefined;
  }

  protected getTileCacheProviderName(): string {
    return this.getProviderClassName();
  }

  protected getCacheableResourceUrl(url: string): string {
    return url;
  }

  protected getCacheableResourceHeaders(_url: string): Record<string, string> | undefined {
    return undefined;
  }

  private createRequestTransform(providerOptions: Record<string, unknown>): maplibregl.RequestTransformFunction {
    const providerTransform = providerOptions.transformRequest as maplibregl.RequestTransformFunction | undefined;
    const routeThroughProtocol = this.supportsRequestRouting();

    if (routeThroughProtocol) this.ensureTileCacheProtocol();

    const route = (params: maplibregl.RequestParameters, resourceType?: string): maplibregl.RequestParameters => {
      const url = resourceType === 'Glyphs' ? this.resolveGlyphsUrl(params.url) : params.url;

      if (!routeThroughProtocol || !/^https?:\/\//.test(url)) return { ...params, url };

      return { ...params, url: encodeCacheProtocolUrl(this.getCacheableResourceUrl(url)) };
    };

    return (url, resourceType) => {
      const transformed = providerTransform?.(url, resourceType) ?? { url };

      return transformed instanceof Promise ? transformed.then(params => route(params, resourceType)) : route(transformed, resourceType);
    };
  }

  protected ensureTileCacheProtocol(): void {
    if (MapLibreProviderBase.tileCacheProtocolRegistered) return;
    MapLibreProviderBase.tileCacheProtocolRegistered = true;

    this.addMapLibreProtocol(PLACES_TILE_CACHE_PROTOCOL, async (params, abortController) => {
      const url = decodeCacheProtocolUrl(params.url);
      const overlayProvider = resolveOverlayTileProvider(url);
      const response = await TileCache.getOrFetch(url, () => this.fetchCacheableResource(url, overlayProvider === undefined), overlayProvider ?? this.getTileCacheProviderName(), abortController.signal);

      return params.type === 'json'
        ? { data: JSON.parse(new TextDecoder().decode(response.arrayBuffer)) as object }
        : { data: response.arrayBuffer };
    });
  }

  protected resolveGlyphsUrl(url: string): string {
    return url;
  }

  private async fetchCacheableResource(url: string, providerResource: boolean): Promise<{ arrayBuffer: ArrayBuffer; contentType?: string }> {
    const headers = providerResource ? this.getCacheableResourceHeaders(url) : undefined;
    const remoteResponse = await requestUrl({ url, headers });

    return {
      arrayBuffer: remoteResponse.arrayBuffer,
      contentType: remoteResponse.headers['content-type'],
    };
  }

  processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): Promise<void> {
    return this.processPlaceCodeBlockAsync(places, mapContainerElement, request);
  }

  private async processPlaceCodeBlockAsync(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): Promise<void> {
    const blockSettings = request.config;
    const runtime = request.runtime;
    const loadStartTime = Date.now();
    const renderId = MapLibreProviderBase.nextRenderId();
    let renderedState: MapState | undefined = undefined;
    const perf = createPerformanceMonitor('maplibre-render', {
      renderId,
      provider: this.getProviderClassName(),
      source: runtime.source.path,
      initialPlaces: places.length,
      get places() { return renderedState?.getCurrentRenderRequest() ? renderedState.getCurrentPlaces().length : places.length; },
      overlays: runtime.overlays.length,
      trackDefaultVisibility: blockSettings.trackDefaultVisibility,
    }, { enabled: this.developerMode });

    perf.mark('start');

    perf.measure('setup-container', () => this.setupMapContainer(mapContainerElement, blockSettings));

    const settings = this.extractCommonSettings(blockSettings, runtime);
    const isHeatmapLayer = blockSettings.heatmapLayer;
    const prepared = perf.measure('prepare-geojson', () => isHeatmapLayer
      ? createHeatmapGeoJson(places, blockSettings.heatmapColorScheme)
      : convertPlacesToGeoJSONData(places, { includeMapPlace: false }));
    const geoJsonData = prepared[0];
    const hiddenIds = runtime.markerVisibilityHiddenIds;
    let boundingBox = prepared[1];

    if (!isHeatmapLayer && hiddenIds && hiddenIds.length > 0) {
      const hiddenSet = new Set(hiddenIds);
      const visibleBounds = new PlacesBoundingBox();

      for (const place of places) {
        if (!hiddenSet.has(getPlaceId(place))) visibleBounds.update(place.latitude, place.longitude);
      }

      if (visibleBounds.isValid()) boundingBox = visibleBounds;
    }

    this.extendBoundsWithOverlays(boundingBox, runtime.overlays, blockSettings.debug);

    let styleUrl: MapLibreStyle | undefined;

    try {
      styleUrl = await perf.measureAsync('prepare-style', () => this.prepareStyle(blockSettings));
    } catch (error) {
      logger.scope('MapLibre').error('Error preparing map style:', error);
      styleUrl = this.getStyleUrl(blockSettings.style);
    }

    if (!styleUrl) {
      this.showStyleError(mapContainerElement, blockSettings);

      return;
    }

    if (runtime.isStale?.()) {
      perf.mark('superseded', { phase: 'after-prepare-style' });
      logger.scope('MapSurface').debug('GL map render abandoned - section superseded', {
        renderId,
        source: runtime.source.path,
      });

      return;
    }

    const terrainEnabled = Boolean(runtime.terrainDem);
    const allowPitch = blockSettings.pitch || terrainEnabled;
    const map = perf.measure('create-map', () => this.createMapInstance(mapContainerElement, styleUrl, boundingBox, allowPitch, blockSettings, runtime.camera, terrainEnabled), {
      initialZoom: runtime.camera.kind === 'explicit' ? runtime.camera.zoom : 'bounds',
    });

    renderedState = MapState.for(map);
    MapState.for(map).setCurrentRenderRequest(request);
    this.deduplicateDocumentStyles(mapContainerElement.ownerDocument);
    const runtimeIdentity = this.getRuntimeIdentity(map);

    logger.scope('MapSurface').debug('GL map runtime created', {
      renderId,
      source: runtime.source.path,
      ...runtimeIdentity,
    });

    const surfaceLifecycle = ensureMapSurfaceLifecycle(mapContainerElement);

    surfaceLifecycle.reportCreated();

    const component = this.createMapComponent(mapContainerElement);
    let disposed = false;
    const providerStateId = this.getProviderStateId();
    const lifecycle: MapProviderLifecycle = {
      cleanup: () => component.unload(),
      hasActiveInstance: () => !disposed
    };
    const providerState: MapLibreProviderState = { map, lifecycle, devicePositionControl: null };

    setMapProviderState<MapLibreProviderState>(mapContainerElement, providerStateId, providerState);

    const contextLoss = handleWebGLContextLost(map, mapContainerElement, {
      onPermanentLoss: () => this.persistViewport(mapContainerElement, MapState.for(map).getCurrentRenderRequest()?.runtime.source ?? runtime.source),
    });

    component.register(() => {
      disposed = true;
      contextLoss.dispose();
      providerState.devicePositionControl?.dispose();
      providerState.devicePositionControl = null;
      reportMapLibreCleanupIssues(getMapLibreResourceRegistry(map).disposeAll(), 'surface disposal');
      this.symbolImagePreparationCleanups.get(map)?.();
      this.symbolImagePreparationCleanups.delete(map);
      this.viewportTrackCleanups.get(map)?.();
      MapState.for(map).getClusteringManager()?.destroy();
      MapState.cleanup(map);
      map.remove();
      clearMapProviderState(mapContainerElement, providerStateId);
      surfaceLifecycle.reportDestroyed();
    });
    component.register(setupMapTouchHandlers({ mapContainer: mapContainerElement }));
    component.load();

    component.register(attachMapSurfacePlumbing({
      container: mapContainerElement,
      engine: {
        on: (event, handler) => { map.on(event, handler); },
        getCenter: () => map.getCenter(),
        getZoom: () => map.getZoom(),
        resize: () => map.resize(),
      },
      source: runtime.source,
      guard: MapState.for(map).getCameraGuard(),
      measure: (event, work, details, options) => perf.measure(event, work, details, options),
    }));

    this.setupEventHandlers(map, settings, blockSettings.poiFilterPatterns);
    MapLibreHelper.handleMissingSprites(map, imageId => this.resolveSymbolIconImage(map, imageId));
    map.on("error", (e) => logger.scope('MapLibre').error('Map error', this.sanitizeMapError(e.error), {
      sourceId: (e as unknown as { sourceId?: string }).sourceId,
    }));
    attachMapTileRecovery(map);

    const readyTimeoutMs = 10000;
    const ownerWindow = mapContainerElement.ownerDocument.defaultView;

    if (!ownerWindow) throw new Error('Map container is not attached to a window.');
    void map.once("load", () => {
      perf.mark('map-load', { zoom: map.getZoom() });
      this.profileNextRenderAndIdle(map, perf, 'initial', {
        renderId,
        source: runtime.source.path,
        ...runtimeIdentity,
      });
      logger.scope('MapSurface').debug('GL map load complete', {
        renderId,
        source: runtime.source.path,
        elapsedMs: Date.now() - loadStartTime,
        zoom: map.getZoom(),
        ...runtimeIdentity,
      });
      surfaceLifecycle.reportLoaded();
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const timeoutId = ownerWindow.setTimeout(() => {
        if (settled) return;
        settled = true;
        logger.scope('MapLibre').warn('Map style did not become ready before readiness timeout', {
          renderId,
          provider: this.getProviderClassName(),
          source: runtime.source.path,
          timeoutMs: readyTimeoutMs,
        });
        resolve();
      }, readyTimeoutMs);

      const finish = () => {
        if (settled) return;
        settled = true;
        ownerWindow.clearTimeout(timeoutId);
        resolve();
      };

      let providerLoadRan = false;
      const runProviderLoad = () => {
        if (providerLoadRan) return;
        providerLoadRan = true;

        if (runtime.isStale?.()) {
          perf.mark('superseded', { phase: 'style-ready' });
          finish();

          return;
        }

        perf.mark('style-ready', { zoom: map.getZoom() });
        MapState.for(map).setOverlaysReady((async () => {
          try {
            perf.measure('load-resize', () => withProgrammaticCamera(map, () => map.resize()));
            perf.measure('load-zoom-state', () => updateZoomContainerState(mapContainerElement, map.getZoom()));

            perf.measure('on-map-load', () => getMapLibreResourceRegistry(map).capture(
              'provider-load',
              () => this.onMapLoad(map, places, geoJsonData, settings, request, perf),
            ));

            perf.measure('apply-poi-filters', () => this.applyPOIFilters(map, blockSettings.poiFilterPatterns));

            finish();

            try {
              await perf.measureAsync('process-overlays', () => getMapLibreResourceRegistry(map).captureAsync(
                'overlays',
                () => this.processOverlays(map, mapContainerElement, request),
              ), {
                overlays: runtime.overlays.length,
              });
            } catch (error) {
              logger.scope('Places').error('[MapLibre] Error processing overlays:', error);
            }

            perf.measure('setup-context-menu', () => this.setupContextMenu(map, mapContainerElement, request, places));

            for (const factory of runtime.mapTools) {
              const toolConfig = request.config.tools[factory.id];

              if (toolConfig === undefined || toolConfig === false) continue;
              this.attachMapTool(map, mapContainerElement, request, factory);
            }

            if (blockSettings.debug) {
              this.setupDebugOverlay(map, mapContainerElement, places, request, loadStartTime);
            }

            const runtimeAudit = this.getMapRuntimeAudit(map, mapContainerElement);

            if (runtimeAudit.duplicateStyleBlockGroups > 0) {
              logger.scope('MapLibre').warn('Map runtime audit detected duplicate document style blocks', {
                renderId,
                provider: this.getProviderClassName(),
                source: runtime.source.path,
                ...runtimeAudit,
              });
            }

            perf.mark('ready', {
              renderId,
              zoom: map.getZoom(),
              markers: MapState.for(map).getPlaceMarkers().size,
              visibleTracks: MapState.for(map).getVisibleTracks().size,
              ...runtimeAudit,
            });
            logger.scope('MapSurface').debug('GL map application render ready', {
              renderId,
              source: runtime.source.path,
              elapsedMs: Date.now() - loadStartTime,
              zoom: map.getZoom(),
              markers: MapState.for(map).getPlaceMarkers().size,
              visibleTracks: MapState.for(map).getVisibleTracks().size,
              ...runtimeAudit,
              ...runtimeIdentity,
            });
          } finally {
            finish();
          }
        })());
      };

      this.runWhenStyleReady(map, runProviderLoad);
      void map.once("load", runProviderLoad);
    });
  }

  private runWhenStyleReady(map: maplibregl.Map, run: () => void): void {
    if (map.isStyleLoaded()) {
      run();

      return;
    }

    void map.once('style.load', run);
  }

  private setupMapContainer(container: HTMLElement, blockSettings: ResolvedMapConfig): void {
    configureMapContainer(container, {
      className: `${this.getProviderClassName()}-map`,
      css: blockSettings.css,
    });
  }

  private showStyleError(container: HTMLElement, blockSettings: ResolvedMapConfig): void {
    const supportedStyles = this.getSupportedStyles();
    const requestedStyle = blockSettings.style;
    const providerName = this.getProviderClassName();

    const parent = container.parentElement;

    if (!parent) return;

    renderMapSurfaceError(container, {
      icon: '⚠️',
      title: 'Invalid Map Style',
      message: `Unknown style "${requestedStyle}" for ${providerName} provider.`,
      className: 'style-error'
    });

    if (supportedStyles.length > 0) {
      const section = parent.createDiv({ cls: 'places-help-section' });

      section.createEl('h3', { text: 'Available styles' });
      const styleList = section.createEl('ul');

      supportedStyles.forEach(style => styleList.createEl('li', { text: style }));
      section.createEl('p', { text: 'Use an available style:' });

      const pre = section.createEl('pre', { cls: 'places-help-code-block' });

      pre.createSpan({ cls: 'places-help-fence', text: '```places\n' });
      const codeEl = pre.createEl('code', { cls: 'language-places' });

      codeEl.textContent = `mapProvider: ${providerName}\nstyle: ${supportedStyles[0]}`;
      pre.createSpan({ cls: 'places-help-fence', text: '\n```' });
    }
  }

  private createMapInstance(
    container: HTMLElement,
    styleUrl: MapLibreStyle,
    boundingBox: PlacesBoundingBox,
    allowPitch: boolean,
    blockSettings: ResolvedMapConfig,
    camera: MapCameraIntent,
    terrainEnabled: boolean,
  ): maplibregl.Map {
    // MapLibre workers cannot resolve protocols registered after worker creation.
    installPmtilesProtocol((name, loadFn) => this.addMapLibreProtocol(name, loadFn));
    const rawCenter = boundingBox.getLngLatCenter();
    const fallbackCenter: [number, number] = (isFinite(rawCenter[0]) && isFinite(rawCenter[1]))
      ? rawCenter
      : [0, 0];
    const intent = camera;
    const initialCenter = intent.kind === 'explicit' ? intent.center : undefined;
    const initialZoom = intent.kind === 'explicit' ? intent.zoom : undefined;
    const useBoundsCamera = intent.kind === 'fit-data' && boundingBox.isValid();
    const center: [number, number] = initialCenter ?? fallbackCenter;
    const zoom = initialZoom ?? estimateInitialZoom(boundingBox);
    const initialPitch = terrainEnabled && intent.kind !== 'preserve' ? DEFAULT_TERRAIN_PITCH : 0;

    const providerOptions = this.getMapOptions(blockSettings);
    const map = this.constructMap({
      container,
      style: styleUrl,
      ...(useBoundsCamera
        ? { bounds: boundingBox.getLngLatBounds(), fitBoundsOptions: { ...resolveFitDataCamera(intent.kind === 'fit-data' ? intent : {}), pitch: initialPitch } }
        : { center, zoom, pitch: initialPitch }),
      minZoom: this.getMinZoom(blockSettings),
      pitchWithRotate: allowPitch,
      dragRotate: allowPitch,
      touchPitch: allowPitch,
      ...(allowPitch ? { maxPitch: MAX_PITCH } : {}),
      trackResize: false,
      ...providerOptions,
      transformRequest: this.createRequestTransform(providerOptions),
    });

    MapState.for(map);

    return map;
  }

  private setupDebugOverlay(map: maplibregl.Map, container: HTMLElement, places: MapPlace[], request: MapRenderRequest, loadStartTime: number): void {
    const blockSettings = request.config;
    const overlays = request.runtime.overlays;

    this.debugData = addDebugOverlay(map, container, {
      places,
      overlayCount: overlays.filter(o => o.type === 'geojson').length,
      imageOverlayCount: overlays.filter(o => o.type === 'image').length,
      vectorTileOverlayCount: overlays.filter(o => o.type === 'vector-tile').length,
      providerName: this.getProviderClassName(),
      style: blockSettings.style,
      loadStartTime,
      prepareTimings: request.runtime.prepareTimings,
      tilesets: collectDebugTilesets(overlays),
    });
  }

  private refreshDebugOverlayData(places: MapPlace[], overlays: readonly Overlay[]): void {
    this.debugData?.updateData?.({
      places,
      overlayCount: overlays.filter(o => o.type === 'geojson').length,
      imageOverlayCount: overlays.filter(o => o.type === 'image').length,
      vectorTileOverlayCount: overlays.filter(o => o.type === 'vector-tile').length,
    });
  }

  getMapControlHandle(container: HTMLElement): MapControlHandle | null {
    const mapState = getMapProviderState<MapLibreProviderState>(container, this.getProviderStateId());

    if (!mapState) return null;
    const { map } = mapState;

    return mapState.controlHandle ??= {
      ...createVectorMapControlHandle({
        container,
        map,
        highlightPlace: place => this.highlightPlace(map, container, place),
        clearHighlight: () => this.clearPlaceHighlight(map, container),
        setGeocodingSearchMarkers: places => this.setGeocodingSearchMarkers(places, container),
      }),
      getViewState: () => {
        const bounds = map.getBounds();
        const center = map.getCenter();
        const element = map.getContainer();

        return {
          bounds: new PlacesBoundingBox(bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()),
          center: { latitude: center.lat, longitude: center.lng },
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          width: element.clientWidth,
          height: element.clientHeight,
        };
      },
      onBoundsChanged: listener => {
        const events = ['moveend', 'zoomend', 'rotateend', 'pitchend', 'resize'] as const;

        for (const event of events) map.on(event, listener);

        return () => {
          for (const event of events) map.off(event, listener);
        };
      },
      setDevicePositionControl: button => {
        mapState.devicePositionControl?.dispose();
        mapState.devicePositionControl = button
          ? attachMapLibreDevicePositionControl(map, button)
          : null;
      },
    };
  }

  private highlightPlace(map: maplibregl.Map, container: HTMLElement, place: MapPlace): void {
    enterVectorFocusMode(container, map, getPlaceId(place));
    focusMapMarkerElement(container, place, map);
    this.focusSymbolMarker(map, place);
    this.openPopupForPlace(map, place);
  }

  private clearPlaceHighlight(map: maplibregl.Map, container: HTMLElement): void {
    clearVectorFocusMode(container, map);
    this.clearSymbolMarkerFocus(map);
    closeExistingPopups('.maplibregl-popup, .mapboxgl-popup');
  }

  private focusSymbolMarker(map: maplibregl.Map, place: MapPlace): void {
    this.symbolFocusedPlaceIds.set(map, getPlaceId(place));
    this.applySymbolSortKey(map);
  }

  private clearSymbolMarkerFocus(map: maplibregl.Map): void {
    this.symbolFocusedPlaceIds.delete(map);
    this.applySymbolSortKey(map);
  }

  private applySymbolSortKey(map: maplibregl.Map): void {
    if (!map.getLayer(SYMBOL_MARKER_LAYER_ID)) return;
    const focused = this.symbolFocusedPlaceIds.get(map);
    const stacking: maplibregl.ExpressionSpecification = ['coalesce', ['get', 'iconSortKey'], 0];
    const key: maplibregl.ExpressionSpecification | undefined = focused !== undefined
      ? ['+', stacking, ['case', ['==', ['get', 'placeId'], focused], FOCUSED_MARKER_SORT_BOOST, 0]]
      : this.symbolStacked.get(map) ? stacking : undefined;
    const signature = JSON.stringify(key ?? null);

    if (this.symbolSortKeySignatures.get(map) === signature) return;
    this.symbolSortKeySignatures.set(map, signature);
    for (const layerId of SYMBOL_MARKER_LAYER_IDS) map.setLayoutProperty(layerId, 'symbol-sort-key', key);
  }

  private openPopupForPlace(map: maplibregl.Map, place: MapPlace): void {
    createPlaceSummaryPopup({
      app: this.app,
      map,
      place,
      coordinates: [place.longitude, place.latitude] as [number, number],
      popupSelector: '.maplibregl-popup, .mapboxgl-popup',
      onPlaceAction: MapState.for(map).getCurrentSettings()?.onPlaceAction,
      createPopup: () => MapLibreHelper.createBasicPopup({
        offset: [0, -15],
        className: 'places-popup',
        closeOnClick: true,
        closeOnMove: false,
        focusAfterOpen: false
      }),
    });
  }

  private createMapComponent(_mapContainerElement: HTMLElement): Component {
    return new Component();
  }

  private setupEventHandlers(map: maplibregl.Map, settings: CommonMapSettings, poiFilterPatterns: readonly string[]): void {
    if (settings.poiDiscovery) {
      this.poiDiscoveryHandler.setup(map, [...poiFilterPatterns], settings.placeNoteHost, () => MapState.for(map).getCurrentRenderRequest()?.runtime.source.path);
    }
  }

  private applyPOIFilters(map: maplibregl.Map, patterns: readonly string[]): void {
    if (!patterns || patterns.length === 0) return;

    const poiLayerPattern = getPOILayerPatterns();

    const style = map.getStyle();

    if (!style || !style.layers) return;

    for (const layer of style.layers) {
      if (!poiLayerPattern.test(layer.id)) continue;

      const existingFilter = map.getFilter(layer.id);
      const useExpression = isExpressionFilter(existingFilter);
      const poiFilter = buildMapLibrePOIFilter([...patterns], 'class', 'subclass', useExpression);

      if (!poiFilter) continue;

      const combinedFilter: unknown[] = existingFilter
        ? ['all', existingFilter, ...poiFilter.slice(1)]
        : poiFilter;

      try {
        map.setFilter(layer.id, combinedFilter as maplibregl.FilterSpecification);
        logger.scope('Places').debug(`[POIFilter] Applied filter to layer "${layer.id}"`);
      } catch (e) {
        logger.scope('Places').warn(`[POIFilter] Failed to apply filter to layer "${layer.id}":`, e);
      }
    }
  }

  private debugData: DebugData | null = null;

  private onMapLoad(map: maplibregl.Map, places: MapPlace[], geoJsonData: unknown, settings: CommonMapSettings, request: MapRenderRequest, perf?: PerformanceMonitor): void {
    const blockSettings = request.config;
    const runtime = request.runtime;
    const isHeatmapLayer = (geoJsonData as { isHeatmapLayer?: boolean }).isHeatmapLayer;

    if (isHeatmapLayer) {
      this.measureIf(perf, 'render-heatmap', () => {
        ensureApplicationLayerAnchor(map);
        renderHeatmap({ app: this.app, map, data: geoJsonData as MapLibreHeatmapData });
      });

      return;
    }

    if (this.initializedMaps.has(map)) {
      perf?.mark('map-load-skipped', { reason: 'already initialized' });

      return;
    }

    this.initializedMaps.add(map);

    if (request.runtime.terrainDem) {
      this.measureIf(perf, 'setup-terrain', () => applyTerrain(map, request.runtime.terrainDem!, blockSettings.terrainExaggeration));
    }

    const reliefDem = request.runtime.reliefDem;

    if (reliefDem && blockSettings.colorReliefOpacity > 0 && this.getProviderIntegration() === 'maplibre-gl') {
      this.measureIf(perf, 'setup-color-relief', () => applyColorRelief(map, reliefDem, blockSettings.colorReliefOpacity, blockSettings.colorReliefColors));
    }

    if (reliefDem && blockSettings.hillshadeIntensity > 0) {
      this.measureIf(perf, 'setup-hillshade', () => applyHillshade(map, reliefDem, {
        intensity: blockSettings.hillshadeIntensity,
        method: this.getProviderIntegration() === 'maplibre-gl' ? blockSettings.hillshadeMethod : undefined,
        direction: blockSettings.hillshadeDirection,
        shadowColor: blockSettings.hillshadeShadowColor,
        highlightColor: blockSettings.hillshadeHighlightColor,
        accentColor: blockSettings.hillshadeAccentColor,
      }));
    }

    ensureApplicationLayerAnchor(map);

    this.measureIf(perf, 'setup-route-source', () => {
      MapLibreHelper.addRouteSource(map);
      MapLibreHelper.addBasicRouteLayers(map);
    });

    if (settings.showLabels) {
      this.measureIf(perf, 'setup-text-label-layer', () => this.setupTextLabelLayer(map, geoJsonData, places, settings, usesNativeMarkerRenderer(blockSettings)));
    }

    const overlayPointFeatures = blockSettings.clusterGeoJsonOverlays
      ? [...extractOverlayPointFeaturesFromOverlays(runtime.overlays)]
      : [];

    const interactivePlaceCount = places.filter(p => hasPlaceMarker(p)).length;

    const clusteringDecision = resolveClusteringDecision({
      placeCount: interactivePlaceCount,
      overlayPointCount: overlayPointFeatures.length,
      clusterThreshold: blockSettings.clusterThreshold,
      clusterGeoJsonOverlays: blockSettings.clusterGeoJsonOverlays,
    });

    if (blockSettings.debug) {
      logger.scope('Places').debug(`[Places Clustering] Places: ${interactivePlaceCount}, Overlay points: ${overlayPointFeatures.length}, Total: ${clusteringDecision.totalPointCount}, Threshold: ${blockSettings.clusterThreshold}, Should cluster: ${clusteringDecision.shouldCluster}`);
    }

    if (clusteringDecision.shouldCluster) {
      this.measureIf(perf, 'add-clustered-markers', () => this.addClusteredMarkers(map, geoJsonData, settings, places, blockSettings, blockSettings.clusterThreshold, overlayPointFeatures), {
        interactivePlaces: interactivePlaceCount,
        overlayPointFeatures: overlayPointFeatures.length,
      });
    } else if (usesNativeMarkerRenderer(blockSettings)) {
      this.measureIf(perf, 'add-symbol-markers', () => this.addSymbolLayerMarkers(map, settings, places, blockSettings), {
        interactivePlaces: interactivePlaceCount,
      });
    } else {
      this.measureIf(perf, 'add-icon-markers', () => this.addIconMarkers(map, settings, places, blockSettings), {
        interactivePlaces: interactivePlaceCount,
      });
    }

    this.measureIf(perf, 'initialize-map-view', () => this.initializeMapView(map, settings, request, clusteringDecision.shouldCluster, perf));
  }

  private ensureGeoJsonSource(map: maplibregl.Map, sourceId: string, source: maplibregl.GeoJSONSourceSpecification): void {
    const existingSource = map.getSource<maplibregl.GeoJSONSource>(sourceId);
    const fedFeatures = FED_SOURCE_IDS.has(sourceId) && typeof source.data !== 'string' && source.data.type === 'FeatureCollection' ? source.data.features : undefined;

    if (existingSource) {
      if (fedFeatures) this.feedSource(map, existingSource, sourceId, fedFeatures);
      else if (typeof existingSource.setData === 'function') {
        void existingSource.setData(source.data);
      }
    } else {
      map.addSource(sourceId, source);
      if (fedFeatures) this.replaceSourceFeed(map, sourceId, true).recordWhole(fedFeatures);
    }

    if (this.getProviderIntegration() === 'mapbox-gl' && sourceId === SYMBOL_MARKER_LAYER_ID && typeof source.data !== 'string' && source.data.type === 'FeatureCollection') {
      const features = new Map<string | number, GeoJSON.Feature>();

      for (const feature of source.data.features) if (feature.id !== undefined) features.set(feature.id, feature);
      this.mapboxSymbolFeatures.set(map.getSource<maplibregl.GeoJSONSource>(sourceId)!, features);
    }
  }

  private feedSource(map: maplibregl.Map, source: maplibregl.GeoJSONSource, sourceId: string, features: GeoJSON.Feature[]): void {
    if (sourceId === 'places-clustered') this.clusterHitFeatures.set(map, features);
    const canDiff = this.getProviderIntegration() !== 'mapbox-gl' && typeof source.updateData === 'function';
    const feed = this.sourceFeeds.get(map)?.get(sourceId) ?? this.replaceSourceFeed(map, sourceId, true);
    const submission = feed.submit(features, canDiff);

    if (submission.kind === 'full') void source.setData(submission.data);
    else if (submission.kind === 'diff') void source.updateData(submission.diff);
  }

  private replaceSourceFeed(map: maplibregl.Map, sourceId: string, orderMatters: boolean): KeyedSourceFeed {
    let feeds = this.sourceFeeds.get(map);

    if (!feeds) {
      feeds = new Map();
      this.sourceFeeds.set(map, feeds);
    }

    const feed = new KeyedSourceFeed(orderMatters);

    feeds.set(sourceId, feed);

    return feed;
  }

  private profileNextRenderAndIdle(map: maplibregl.Map, perf: PerformanceMonitor, phase: 'initial' | 'update', details: Record<string, unknown> = {}): void {
    if (!this.developerMode) return;
    this.renderProfiler.start(map, perf, phase, () => ({
      ...details,
      places: MapState.for(map).getCurrentPlaces().length,
      source: MapState.for(map).getCurrentRenderRequest()?.runtime.source.path,
    }), (message, data) => logger.scope('MapSurface').debug(message, data));
  }

  // MapLibre waits for every glyph dependency before returning symbol buckets
  // for a source, including symbols that use only local images.
  private setupTextLabelLayer(map: maplibregl.Map, geoJsonData: unknown, places: MapPlace[], settings: CommonMapSettings, nativeZoomLabels = false): void {
    const layerExisted = Boolean(map.getLayer('places-markers'));

    if (nativeZoomLabels) {
      const { features, offsetExpressions } = this.buildSymbolMarkerData(map, places);

      this.ensureGeoJsonSource(map, 'places-labels', {
        type: 'geojson', data: { type: 'FeatureCollection', features },
      });
      MapLibreHelper.addTextLayer(map, 'places-labels', undefined, offsetExpressions.labelAnchorOffsets);
      map.setFilter('places-markers', symbolLabelFilter(markerVisibilityDenyExpression(this.symbolVisibilityHidden.get(map) ?? [])));
    } else {
      const labelFeatures = (geoJsonData as { data: { features: GeoJSON.Feature[] } }).data.features.filter((_feature: GeoJSON.Feature, index: number) => {
        const place = places[index];

        if (!hasPlaceMarker(place)) {
          return false;
        }

        const labelStyle = place?.labelStyle;
        const usesDomZoomLabel = Boolean(place.iconStyle?.zoom || labelStyle?.zoom);

        return !isStyleHidden(labelStyle) && !usesDomZoomLabel;
      });

      this.ensureGeoJsonSource(map, "places-labels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: labelFeatures
        }
      });
      MapLibreHelper.addTextLayer(map, "places-labels");
    }

    if (!layerExisted) {
      map.on('click', 'places-markers', (e) => {
        e.preventDefault();
        const feature = e.features?.[0];

        if (feature) {
          void this.onPlacesLayerClick(e, settings);
        }
      });

      MapLibreHelper.addPointerCursor(map, 'places-markers');
    }
  }

  private initializeMapView(map: maplibregl.Map, settings: CommonMapSettings, request: MapRenderRequest, willCluster: boolean = false, perf?: PerformanceMonitor): void {
    const visibility = request.runtime.trackVisibility;

    const mapState = MapState.for(map);

    mapState.setDefaultTrackState(visibility?.shouldShowByDefault ? 'visible' : 'hidden');

    if (visibility?.hasAnyVisibleTracks) {
      const placesToShow = visibility.placeStates.filter(s => s.showOnLoad);

      if (visibility.isSingleTrackView && placesToShow.length === 1) {
        const { place, effectiveColorBy } = placesToShow[0];

        if (place.overlay?.geojson) {
          const fitTrack = request.runtime.camera.kind === 'fit-data';

          this.measureIf(perf, 'show-single-track', () => this.showGeoJsonOverlayAndFitBounds(map, place, visibility, settings, effectiveColorBy, settings.trackGradeWindow, fitTrack), { placeId: getPlaceId(place) });
        }

        return;
      } else if (placesToShow.length > 0) {
        this.measureIf(perf, 'show-initial-tracks', () => this.showInitialTracks(map, placesToShow, visibility, settings, willCluster, perf), { tracks: placesToShow.length });
      }
    } else if (willCluster && !visibility?.shouldShowByDefault) {
      logger.scope('Places').debug('[Places] Clustering enabled - trackLayers will show when markers are unclustered');
    }
  }

  private addClusteredMarkers(map: maplibregl.Map, geoJsonData: unknown, settings: CommonMapSettings, places: MapPlace[], blockSettings: ResolvedMapConfig, clusterThreshold: number, overlayPointFeatures: GeoJSON.Feature[] = []): void {
    if (overlayPointFeatures.length > 0) {
      ensureWaypointIconImages(map, { type: 'FeatureCollection', features: overlayPointFeatures });
    }

    if (usesNativeMarkerRenderer(blockSettings)) {
      this.addSymbolClusteredMarkers(map, settings, places, blockSettings, overlayPointFeatures);

      return;
    }

    const geojson = geoJsonData as { data: GeoJSON.FeatureCollection };
    const features = geojson.data.features;

    const filteredPlaces: MapPlace[] = [];
    const filteredFeatures: GeoJSON.Feature[] = [];

    places.forEach((place, index) => {
      if (hasPlaceMarker(place)) {
        filteredPlaces.push(place);
        filteredFeatures.push(features[index]);
      }
    });

    this.addClusterSourceAndLayers(map, [...filteredFeatures, ...overlayPointFeatures], blockSettings);

    if (overlayPointFeatures.length > 0) {
      map.addSource('overlay-points-unclustered', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: overlayPointFeatures
        }
      });

      this.addOverlayPointLayer(map, 'overlay-points-unclustered', { initiallyHidden: true });
    }

    const overlayPointCoordinates = overlayPointFeatures.map(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      return { longitude: coords[0], latitude: coords[1] };
    });

    const mapState = MapState.for(map);

    mapState.setCurrentPlaces(places);
    mapState.setCurrentSettings(settings);
    mapState.setCurrentBlockSettings(blockSettings);

    const clusteringManager = new ViewportClusteringManager<maplibregl.Marker>({
      map: map,
      places: filteredPlaces,
      clusterThreshold,
      ...clusterModeLayerIds(blockSettings.clusterStyle),
      overlayPointCoordinates,
      overlayPointsLayerId: overlayPointFeatures.length > 0 ? 'overlay-points-individual' : undefined,
      providerName: 'MapLibre',
      markerFactory: {
        createMarker: (place) => {
          const feature = this.createHtmlMarkerFeature(map, place);

          return MapLibreHelper.createIconMarker(
            map,
            feature,
            this.onMarkerClick.bind(this, map, feature, settings)
          );
        },
        removeMarker: (marker) => marker.remove()
      },
      onClusteringModeChange: (isClustering) => {
        this.handleClusteringModeChange(map, mapState, settings, isClustering);
      }
    });

    mapState.setClusteringManager(clusteringManager);

    const markerMap = clusteringManager.getMarkerMap();

    for (const [placeId, marker] of markerMap.entries()) {
      mapState.setPlaceMarker(placeId, marker);
    }

    for (const place of filteredPlaces) {
      mapState.setPlaceMarkerSignature(getPlaceId(place), getPlaceMarkerRenderSignature(place));
    }

    setupVectorClusterInteractions({
      map: map as never,
      clusteringManager,
      isClusterSourceLoadedEvent: event => {
        const sourceEvent = event as MapSourceDataEvent;

        return sourceEvent.sourceId === 'places-clustered' && Boolean(sourceEvent.isSourceLoaded);
      },
      getClusterExpansionZoom: async (_map, clusterId, sourceId) => {
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;

        return source.getClusterExpansionZoom(clusterId);
      },
    });
  }

  private addSymbolClusteredMarkers(map: maplibregl.Map, settings: CommonMapSettings, places: MapPlace[], blockSettings: ResolvedMapConfig, overlayPointFeatures: GeoJSON.Feature[]): void {
    const started = performance.now();
    const { renderedPlaces, features: placeFeatures, zoomSizeStops, offsetExpressions } = this.buildSymbolMarkerData(map, places);
    const dataReady = performance.now();
    const imagePreparation = this.scheduleSymbolMarkerImages(map, renderedPlaces);

    this.schedulePictureImages(map, renderedPlaces);
    const imagesReady = performance.now();

    this.addClusterSourceAndLayers(map, [...placeFeatures, ...overlayPointFeatures], blockSettings);
    this.symbolClusterData.set(map, { features: placeFeatures, renderedPlaces, overlayPointFeatures });

    this.ensureGeoJsonSource(map, SYMBOL_MARKER_LAYER_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: placeFeatures },
    });
    this.addSymbolMarkerLayer(map, SYMBOL_MARKER_LAYER_ID, settings, zoomSizeStops, renderedPlaces.some(place => place.iconRotation !== undefined), offsetExpressions.iconOffset, !MapState.for(map).getClusteringManager()?.isClustering());
    const layersReady = performance.now();

    if (overlayPointFeatures.length > 0) {
      map.addSource('overlay-points-unclustered', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: overlayPointFeatures }
      });
      this.addOverlayPointLayer(map, 'overlay-points-unclustered', { initiallyHidden: true });
    }

    const overlayPointCoordinates = overlayPointFeatures.map(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      return { longitude: coords[0], latitude: coords[1] };
    });

    const mapState = MapState.for(map);

    mapState.setCurrentPlaces(places);
    mapState.setCurrentSettings(settings);
    mapState.setCurrentBlockSettings(blockSettings);

    this.installSymbolClusteringManager(map, mapState, settings, blockSettings, renderedPlaces, overlayPointCoordinates, overlayPointFeatures.length > 0, () => imagePreparation.flush('marker-mode'));
    this.symbolClusteringSignature.set(map, symbolClusteringSignature(blockSettings, overlayPointFeatures.length));
    const managerReady = performance.now();

    logger.scope('MapSurface').debug('Native clustered marker setup ready', {
      provider: this.getProviderClassName(),
      places: renderedPlaces.length,
      overlayPointFeatures: overlayPointFeatures.length,
      uniqueImages: imagePreparation.uniqueImages,
      imagePreparation: 'scheduled',
      buildDataMs: Math.round((dataReady - started) * 10) / 10,
      scheduleImagesMs: Math.round((imagesReady - dataReady) * 10) / 10,
      addSourcesAndLayersMs: Math.round((layersReady - imagesReady) * 10) / 10,
      createManagerMs: Math.round((managerReady - layersReady) * 10) / 10,
      interactionsMs: Math.round((performance.now() - managerReady) * 10) / 10,
    });
  }

  private installSymbolClusteringManager(map: maplibregl.Map, mapState: ReturnType<typeof MapState.for>, settings: CommonMapSettings, blockSettings: ResolvedMapConfig, renderedPlaces: MapPlace[], overlayPointCoordinates: Array<{ longitude: number; latitude: number }>, hasOverlayPoints: boolean, onMarkerMode?: () => void): void {
    const clusteringManager = new ViewportClusteringManager<maplibregl.Marker>({
      map: map,
      places: renderedPlaces,
      clusterThreshold: blockSettings.clusterThreshold,
      ...clusterModeLayerIds(blockSettings.clusterStyle),
      providerName: 'MapLibre',
      markersLayerIds: [...SYMBOL_MARKER_LAYER_IDS, 'places-markers'],
      overlayPointCoordinates,
      overlayPointsLayerId: hasOverlayPoints ? 'overlay-points-individual' : undefined,
      onClusteringModeChange: (isClustering) => {
        this.setSymbolMarkerPictures(map, !isClustering);

        if (!isClustering) {
          onMarkerMode?.();
          this.schedulePictureImages(map, mapState.getCurrentPlaces());
        }

        this.handleClusteringModeChange(map, mapState, settings, isClustering);
      }
    });

    mapState.setClusteringManager(clusteringManager);

    if (!this.clusterInteractionsInstalled.has(map)) {
      this.clusterInteractionsInstalled.add(map);
      setupVectorClusterInteractions({
        map: map as never,
        clusteringManager: { update: () => MapState.for(map).getClusteringManager()?.update() },
        isClusterSourceLoadedEvent: event => {
          const sourceEvent = event as MapSourceDataEvent;

          return sourceEvent.sourceId === 'places-clustered' && Boolean(sourceEvent.isSourceLoaded);
        },
        getClusterExpansionZoom: async (_map, clusterId, sourceId) => {
          const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;

          return source.getClusterExpansionZoom(clusterId);
        },
      });
    }
  }

  private reconcileSymbolClustering(map: maplibregl.Map, mapState: ReturnType<typeof MapState.for>, settings: CommonMapSettings, blockSettings: ResolvedMapConfig, newPlaces: MapPlace[], runtime: MapRenderRequest['runtime']): void {
    const overlayPointFeatures = blockSettings.clusterGeoJsonOverlays ? [...extractOverlayPointFeaturesFromOverlays(runtime.overlays)] : [];
    const shouldCluster = resolveClusteringDecision({
      placeCount: newPlaces.filter(place => hasPlaceMarker(place)).length,
      overlayPointCount: overlayPointFeatures.length,
      clusterThreshold: blockSettings.clusterThreshold,
      clusterGeoJsonOverlays: blockSettings.clusterGeoJsonOverlays,
    }).shouldCluster;
    const wanted = shouldCluster ? symbolClusteringSignature(blockSettings, overlayPointFeatures.length) : '';

    if (wanted === (this.symbolClusteringSignature.get(map) ?? '')) return;

    this.removeSymbolClustering(map, mapState, settings);
    if (!shouldCluster) return;

    const { renderedPlaces, features } = this.buildSymbolMarkerData(map, newPlaces);

    this.addClusterSourceAndLayers(map, [], blockSettings);

    if (overlayPointFeatures.length > 0) {
      map.addSource('overlay-points-unclustered', { type: 'geojson', data: { type: 'FeatureCollection', features: overlayPointFeatures } });
      this.addOverlayPointLayer(map, 'overlay-points-unclustered', { initiallyHidden: true });
    }

    this.symbolClusterData.set(map, { features, renderedPlaces, overlayPointFeatures });
    this.installSymbolClusteringManager(map, mapState, settings, blockSettings, renderedPlaces, overlayPointFeatures.map(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      return { longitude: coords[0], latitude: coords[1] };
    }), overlayPointFeatures.length > 0);
    this.symbolClusteringSignature.set(map, wanted);
    this.applyClusteredData(map);
    logger.scope('MapSurface').debug('Native clustering installed on the live map', { provider: this.getProviderClassName(), places: renderedPlaces.length, overlayPointFeatures: overlayPointFeatures.length });
  }

  private removeSymbolClustering(map: maplibregl.Map, mapState: ReturnType<typeof MapState.for>, settings: CommonMapSettings): void {
    this.symbolClusteringSignature.delete(map);
    const manager = mapState.getClusteringManager();

    if (!manager) return;
    manager.destroy();
    mapState.setClusteringManager(null);
    this.removeMapLayersAndSources(map, ['clusters', 'cluster-count', CLUSTER_HEATMAP_LAYER_ID, 'overlay-points-individual', 'overlay-points-individual-emoji'], ['places-clustered', 'overlay-points-unclustered']);
    this.symbolClusterData.delete(map);
    setLayerVisibility(map, [...SYMBOL_MARKER_LAYER_IDS, 'places-markers'], 'visible');
    this.handleClusteringModeChange(map, mapState, settings, false);
    logger.scope('MapSurface').debug('Native clustering removed from the live map', { provider: this.getProviderClassName() });
  }

  private addClusterSourceAndLayers(map: maplibregl.Map, features: GeoJSON.Feature[], blockSettings: ResolvedMapConfig): void {
    const heatmap = blockSettings.clusterStyle === 'heatmap';

    map.addSource('places-clustered', heatmap ? {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      ...createHeatmapSourceOptions(),
    } : {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: MapConstants.CLUSTER_MAX_ZOOM   
    });
    this.replaceSourceFeed(map, 'places-clustered', !heatmap).recordWhole(features);
    this.clusterHitFeatures.set(map, features);

    if (heatmap) {
      map.addLayer({
        id: CLUSTER_HEATMAP_LAYER_ID,
        type: 'heatmap',
        source: 'places-clustered',
        paint: createClusterHeatmapPaint(blockSettings.heatmapColorScheme) as never,
      });
      this.wireMapHitClick(map);

      return;
    }

    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'places-clustered',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          MapConstants.CLUSTER_COLORS.SMALL,
          MapConstants.CLUSTER_SIZES.MEDIUM.threshold, MapConstants.CLUSTER_COLORS.MEDIUM,
          MapConstants.CLUSTER_SIZES.LARGE.threshold, MapConstants.CLUSTER_COLORS.LARGE
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          MapConstants.CLUSTER_SIZES.SMALL.radius,
          MapConstants.CLUSTER_SIZES.MEDIUM.threshold, MapConstants.CLUSTER_SIZES.MEDIUM.radius,
          MapConstants.CLUSTER_SIZES.LARGE.threshold, MapConstants.CLUSTER_SIZES.LARGE.radius
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });

    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'places-clustered',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': resolveStyleTextFont(map, { bold: true }),
        'text-size': 12
      },
      paint: {
        'text-color': '#000'
      }
    });
  }

  private addOverlayPointLayer(map: maplibregl.Map, sourceId: string, options: { initiallyHidden?: boolean } = {}): void {
    ensureWaypointMarkerImage(map);
    const filter = ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]];
    const visibility = options.initiallyHidden ? 'none' : 'visible';
    const layer = createWaypointLayerConfig({
      sourceId,
      layerId: 'overlay-points-individual',
      trackColor: TRACK_STYLE_DEFAULTS.color,
      filter,
      defaultRadius: 6,
      defaultOpacity: 0.8,
      defaultStrokeWidth: 2,
    }) as maplibregl.SymbolLayerSpecification;

    layer.layout = { ...(layer.layout ?? {}), visibility };
    map.addLayer(layer);
    const emojiLayer = createWaypointEmojiLayerConfig({
      sourceId,
      layerId: 'overlay-points-individual-emoji',
      filter,
      defaultOpacity: 0.8,
    }) as maplibregl.SymbolLayerSpecification;

    emojiLayer.layout = { ...(emojiLayer.layout ?? {}), visibility };
    map.addLayer(emojiLayer);

    for (const layerId of ['overlay-points-individual', 'overlay-points-individual-emoji']) {
      this.registerOverlayPointLayer(map, layerId);
    }
  }

  private handleOverlayPointClick(map: maplibregl.Map, feature: GeoJSON.Feature, fallbackSourcePath?: string): void {
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
    const popup = MapLibreHelper.openPopup(map, coords, map.getContainer().ownerDocument.createElement('div'));
    const content = this.buildOverlayPointContent(map, feature, fallbackSourcePath, popup, () => content);

    popup.setDOMContent(content);
  }

  private buildOverlayPointContent(map: maplibregl.Map, feature: GeoJSON.Feature, fallbackSourcePath: string | undefined, popup: maplibregl.Popup, getRoot: () => HTMLElement): HTMLElement {
    const properties: Record<string, unknown> = feature.properties || {};
    const mapState = MapState.for(map);
    const request = mapState.getCurrentRenderRequest();
    const { sourcePath, overlay } = resolveOverlayPointSource(properties, request?.runtime.overlays ?? [], fallbackSourcePath);
    const placeId = typeof properties._placeId === 'string' ? properties._placeId : undefined;
    const trackPlace = placeId ? mapState.getPlaceById(placeId) : undefined;
    const settings = mapState.getCurrentSettings();
    const popupConfig = trackPlace?.settings?.popup ?? overlay?.popup ?? (trackPlace?.overlay ? settings?.popup : undefined);
    const popupSourcePath = request?.runtime.source.path ?? settings?.popupSourcePath;

    if (trackPlace?.settings?.popup && popupConfig) {
      const content = buildOverlayPointPopup({ app: this.app, feature, sourcePath, markdownSourcePath: popupSourcePath });

      this.enrichPlaceSection(trackPlace, content, popup, getRoot(), popupConfig, popupSourcePath, request?.runtime.popupRenderers);

      return content;
    }

    return buildOverlayPointPopup({
      app: this.app,
      feature,
      sourcePath,
      popupConfig,
      markdownSourcePath: popupSourcePath,
      popupRenderers: request?.runtime.popupRenderers,
      onRendered: () => popup.setDOMContent(getRoot()),
    });
  }

  private addIconMarkers(map: maplibregl.Map, settings: CommonMapSettings, places: MapPlace[], blockSettings: ResolvedMapConfig): void {
    const mapState = MapState.for(map);

    mapState.setCurrentPlaces(places);
    mapState.setCurrentSettings(settings);
    mapState.setCurrentBlockSettings(blockSettings);

    for (const place of places) {
      if (!hasPlaceMarker(place)) {
        continue;
      }

      if (!isIconHidden(place)) {
        const marker = this.createIconMarkerWithReturn(map, this.createHtmlMarkerFeature(map, place), settings);
        const placeId = getPlaceId(place);
        const markerSignature = getPlaceMarkerRenderSignature(place);

        mapState.setPlaceMarkerWithSignature(placeId, marker, markerSignature);
      }
    }
  }

  private addSymbolLayerMarkers(map: maplibregl.Map, settings: CommonMapSettings, places: MapPlace[], blockSettings: ResolvedMapConfig): void {
    const mapState = MapState.for(map);

    mapState.setCurrentPlaces(places);
    mapState.setCurrentSettings(settings);
    mapState.setCurrentBlockSettings(blockSettings);

    const { renderedPlaces, features, zoomSizeStops, offsetExpressions } = this.buildSymbolMarkerData(map, places);

    this.registerSymbolIconImages(map, renderedPlaces);
    const picturePlaces = renderedPlaces.filter(place => place.iconImageUrl);

    if (picturePlaces.length > 0) this.scheduleSymbolMarkerImages(map, picturePlaces).flush('marker-mode');

    this.ensureGeoJsonSource(map, SYMBOL_MARKER_LAYER_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    this.addSymbolMarkerLayer(map, SYMBOL_MARKER_LAYER_ID, settings, zoomSizeStops, renderedPlaces.some(place => place.iconRotation !== undefined), offsetExpressions.iconOffset, !MapState.for(map).getClusteringManager()?.isClustering());
    if (picturePlaces.length > 0) this.schedulePictureImages(map, picturePlaces);
  }

  private addSymbolMarkerLayer(map: maplibregl.Map, sourceId: string, settings: CommonMapSettings, zoomSizeStops: number[], mapAlignedIcons: boolean, iconOffset: unknown[], pictures = true): void {
    this.removeMapLayersAndSources(map, SYMBOL_MARKER_LAYER_IDS.filter(layerId => map.getLayer(layerId)), []);
    const deny = markerVisibilityDenyExpression(this.symbolVisibilityHidden.get(map) ?? []);
    const layout = buildSymbolMarkerLayout(zoomSizeStops, mapAlignedIcons, iconOffset, pictures);

    map.addLayer({
      id: SYMBOL_MARKER_LAYER_ID,
      type: 'symbol',
      source: sourceId,
      filter: symbolIconFilter(deny, false),
      layout,
      paint: {
        'icon-opacity': SYMBOL_ICON_BASE_OPACITY,
      },
    });
    map.addLayer({
      id: SYMBOL_BENEATH_LAYER_ID,
      type: 'symbol',
      source: sourceId,
      filter: symbolIconFilter(deny, true),
      layout: { ...layout, 'icon-ignore-placement': true },
      paint: {
        'icon-opacity': SYMBOL_ICON_BASE_OPACITY,
      },
    }, lowestLayerId(map, [SYMBOL_MARKER_LAYER_ID, 'places-markers']));
    this.symbolSortKeySignatures.delete(map);
    this.applySymbolSortKey(map);

    for (const layerId of SYMBOL_MARKER_LAYER_IDS) {
      map.on('click', layerId, (event) => this.onPlacesLayerClick(event, settings));
      registerPointerCursorLayer(map, layerId);
    }
  }

  private buildSymbolMarkerData(map: maplibregl.Map, places: MapPlace[]): { renderedPlaces: MapPlace[]; features: GeoJSON.Feature[]; zoomSizeStops: number[]; offsetExpressions: ReturnType<typeof buildMarkerOffsetExpressions> } {
    const renderedPlaces = places.filter(place => hasPlaceMarker(place));
    const zoomSizeStops = collectIconZoomSizeStops(renderedPlaces.map(place => place.iconStyle));
    const mapAlignedIcons = renderedPlaces.some(place => place.iconRotation !== undefined);
    const stopsKey = zoomSizeStops.join(',');
    const features = renderedPlaces.map(place => this.createPointFeature(map, place, zoomSizeStops, stopsKey, mapAlignedIcons));

    this.symbolStacked.set(map, features.some(feature => feature.properties?.iconSortKey !== undefined));
    const offsetExpressions = buildMarkerOffsetExpressions(renderedPlaces.map(place =>
      getMarkerOffsetLayout(place.iconStyle, place.labelStyle?.fontSize, mapAlignedIcons)));

    return { renderedPlaces, features, zoomSizeStops, offsetExpressions };
  }

  private registerSymbolIconImages(map: maplibregl.Map, places: MapPlace[]): void {
    const drawn = places.filter(place => place.icon && !isIconHidden(place));
    const entries: Array<[string, MapPlace]> = [];

    for (const place of drawn) {
      entries.push([this.getSymbolIconImageId(map, place), place]);
      entries.push([this.glyphImageIdOf(place), place]);
    }

    MapState.for(map).setSymbolIconPlaces(entries);
  }

  private resolveSymbolIconImage(map: maplibregl.Map, imageId: string): boolean {
    const place = MapState.for(map).getSymbolIconPlace(imageId);

    if (!place) return false;
    const url = place.iconImageUrl;
    const quality = this.iconImageQuality(map);

    if (url && imageId === this.pictureImageIdOf(map, place, url) && !getMarkerPicture(url, quality.decodePx)) {
      this.schedulePictureImages(map, [place], true);

      return false;
    }

    return this.ensureSymbolIconImage(map, place, imageId) !== 'failed';
  }

  private scheduleSymbolMarkerImages(map: maplibregl.Map, places: MapPlace[]): SymbolImagePreparation {
    this.symbolImagePreparationCleanups.get(map)?.();
    const queued = new Map<string, MapPlace>();

    for (const place of places) {
      if (!place.icon || isIconHidden(place)) continue;
      const imageId = this.glyphImageIdOf(place);

      if (!map.hasImage(imageId) && !queued.has(imageId)) queued.set(imageId, place);
    }

    const items = Array.from(queued, ([imageId, place]) => ({ imageId, place }));
    const stats = { existing: 0, cacheHits: 0, rasterized: 0, failed: 0 };
    let index = 0;
    let frameId = 0;
    let finished = false;
    const started = performance.now();

    const record = (result: ReturnType<MapLibreProviderBase['ensureSymbolIconImage']>) => {
      if (result === 'existing') stats.existing += 1;
      else if (result === 'cache') stats.cacheHits += 1;
      else if (result === 'rasterized') stats.rasterized += 1;
      else stats.failed += 1;
    };
    const finish = (mode: 'incremental' | 'marker-mode') => {
      if (finished) return;
      finished = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      this.symbolImagePreparationCleanups.delete(map);
      logger.scope('MapSurface').debug('Native clustered marker images ready', {
        provider: this.getProviderClassName(),
        uniqueImages: items.length,
        ...stats,
        mode,
        durationMs: Math.round((performance.now() - started) * 10) / 10,
      });
    };
    const processFrame = () => {
      frameId = 0;
      if (finished) return;
      const sliceStarted = performance.now();

      while (index < items.length && performance.now() - sliceStarted < 6) {
        const item = items[index++];

        record(this.ensureSymbolIconImage(map, item.place, item.imageId));
      }

      if (index >= items.length) finish('incremental');
      else frameId = window.requestAnimationFrame(processFrame);
    };
    const flush = (reason: 'marker-mode' | 'cleanup') => {
      if (finished) return;

      if (reason === 'cleanup') {
        finished = true;
        if (frameId) window.cancelAnimationFrame(frameId);
        frameId = 0;

        return;
      }

      while (index < items.length) {
        const item = items[index++];

        record(this.ensureSymbolIconImage(map, item.place, item.imageId));
      }

      finish('marker-mode');
    };

    if (items.length === 0) finish('incremental');
    else frameId = window.requestAnimationFrame(processFrame);

    this.symbolImagePreparationCleanups.set(map, () => flush('cleanup'));

    return { uniqueImages: items.length, flush };
  }

  private getSymbolIconImageId(map: maplibregl.Map, place: MapPlace): string {
    const url = place.iconImageUrl;

    if (url && !markerPictureFailed(url)) return this.pictureImageIdOf(map, place, url);

    return this.glyphImageIdOf(place);
  }

  private glyphImageIdOf(place: MapPlace): string {
    let id = this.glyphImageIds.get(place);

    if (id === undefined) {
      id = markerIconImageId(place.icon || '', place.iconStyle);
      this.glyphImageIds.set(place, id);
    }

    return id;
  }

  private pictureImageIdOf(map: maplibregl.Map, place: MapPlace, url: string): string {
    const quality = this.iconImageQuality(map);
    const cached = this.pictureImageIds.get(place);

    if (cached?.quality === quality) return cached.id;
    const id = markerPictureImageId(url, place.iconStyle, quality);

    this.pictureImageIds.set(place, { quality, id });

    return id;
  }

  private iconCanvas: HTMLCanvasElement | undefined;

  private iconImageQuality(map: maplibregl.Map): IconImageQuality {
    return MapState.for(map).getCurrentSettings()?.iconImageQuality ?? DEFAULT_ICON_IMAGE_QUALITY;
  }

  private iconImageHost(): MarkerIconImageHost {
    return {
      createCanvas: () => (this.iconCanvas ??= createEl('canvas')),
      pixelRatio: activeWindow.devicePixelRatio || 1,
    };
  }

  private refreshSymbolLayerData(map: maplibregl.Map, newPlaces: MapPlace[], settings: CommonMapSettings, request: MapRenderRequest, profile: Record<string, unknown>): void {
    const blockSettings = request.config;
    const { renderedPlaces, features, zoomSizeStops, offsetExpressions } = this.buildSymbolMarkerData(map, newPlaces);
    const previousPlaces = MapState.for(map).getCurrentPlaces();
    const previousMarkerCount = previousPlaces.reduce((count, place) => count + (!hasPlaceMarker(place) ? 0 : 1), 0);

    this.registerSymbolIconImages(map, renderedPlaces);
    this.scheduleSymbolMarkerImages(map, renderedPlaces).flush('marker-mode');
    this.schedulePictureImages(map, renderedPlaces);
    const imageStats = { uniqueImages: new Set(renderedPlaces.map(place => this.getSymbolIconImageId(map, place))).size };

    this.applySymbolSortKey(map);

    for (const layerId of SYMBOL_MARKER_LAYER_IDS.filter(id => map.getLayer(id))) {
      map.setLayoutProperty(layerId, 'icon-size', buildSymbolIconSizeExpression(zoomSizeStops));
      map.setLayoutProperty(layerId, 'icon-offset', offsetExpressions.iconOffset as maplibregl.ExpressionSpecification);
    }

    const symbolSource = map.getSource<maplibregl.GeoJSONSource>(SYMBOL_MARKER_LAYER_ID);

    this.ensureGeoJsonSource(map, SYMBOL_MARKER_LAYER_ID, { type: 'geojson', data: { type: 'FeatureCollection', features } });

    const clusteredSource = map.getSource<maplibregl.GeoJSONSource>('places-clustered');
    let overlayPointCount = 0;

    if (clusteredSource) {
      const overlayPointFeatures = blockSettings.clusterGeoJsonOverlays
        ? [...extractOverlayPointFeaturesFromOverlays(request.runtime.overlays)]
        : [];

      overlayPointCount = overlayPointFeatures.length;
      this.symbolClusterData.set(map, { features, renderedPlaces, overlayPointFeatures });
      this.applyClusteredData(map);
    }

    if (settings.showLabels) {
      this.setupTextLabelLayer(map, undefined, newPlaces, settings, true);
    }

    Object.assign(profile, {
      previousMarkers: previousMarkerCount,
      nextMarkers: features.length,
      markerDelta: features.length - previousMarkerCount,
      zoomSizeStops: zoomSizeStops.length,
      clustered: Boolean(clusteredSource),
      overlayPoints: overlayPointCount,
      labels: settings.showLabels,
      iconImages: imageStats.uniqueImages,
      sourceOperation: symbolSource ? 'set-data' : 'add-source',
    });
  }

  private ensureSymbolIconImage(map: maplibregl.Map, place: MapPlace, imageId = this.getSymbolIconImageId(map, place)): MarkerIconImageResult['outcome'] {
    const url = place.iconImageUrl;
    const quality = this.iconImageQuality(map);

    if (url && imageId === this.pictureImageIdOf(map, place, url)) {
      if (!getMarkerPicture(url, quality.decodePx)) return 'failed';
      const picture = ensureMarkerPictureImage(map, url, place.iconStyle, this.iconImageHost(), quality, imageId);

      if (picture.outcome === 'failed') return 'failed';
      this.rememberPictureImage(map, imageId);
      releaseMarkerPicture(url);

      return picture.outcome;
    }

    return ensureMarkerIconImage(map, place.icon || '', place.iconStyle, this.iconImageHost(), imageId).outcome;
  }

  private rememberPictureImage(map: maplibregl.Map, imageId: string): void {
    let images = this.pictureImages.get(map);

    if (!images) {
      images = new Map();
      this.pictureImages.set(map, images);
    }

    if (!images.has(imageId)) this.pictureIdsAdded.set(map, (this.pictureIdsAdded.get(map) ?? 0) + 1);
    const now = performance.now();

    images.delete(imageId);
    images.set(imageId, now);
    if (images.size <= MAX_PICTURE_IMAGES) return;
    if (now - (this.pictureEvictionAt.get(map) ?? -Infinity) < PICTURE_EVICTION_INTERVAL_MS) return;
    this.pictureEvictionAt.set(map, now);
    this.evictPictureImages(map, this.viewportPictureImageIds(map));
  }

  private viewportPictureImageIds(map: maplibregl.Map): Set<string> {
    const keep = new Set<string>();

    try {
      const layers = SYMBOL_MARKER_LAYER_IDS.filter(layerId => map.getLayer(layerId));

      if (layers.length === 0) return keep;

      for (const feature of map.queryRenderedFeatures({ layers })) {
        const imageId: unknown = feature.properties?.iconImage;

        if (typeof imageId === 'string') keep.add(imageId);
      }
    } catch (error) {
      logger.scope('MapSurface').debug('Rendered marker images could not be read', { error: getErrorMessage(error) });
    }

    return keep;
  }

  private setSymbolMarkerPictures(map: maplibregl.Map, pictures: boolean): void {
    try {
      for (const layerId of SYMBOL_MARKER_LAYER_IDS.filter(id => map.getLayer(id))) map.setLayoutProperty(layerId, 'icon-image', symbolMarkerImage(pictures));
    } catch (error) {
      logger.scope('MapSurface').debug('Marker image choice not applied', { error: getErrorMessage(error) });
    }
  }

  private pictureEvictionDue(map: maplibregl.Map): boolean {
    return (this.pictureImages.get(map)?.size ?? 0) > MAX_PICTURE_IMAGES * PICTURE_IMAGE_OVERFLOW;
  }

  private evictPictureImages(map: maplibregl.Map, keep: ReadonlySet<string>): void {
    const images = this.pictureImages.get(map);

    if (!images || images.size <= MAX_PICTURE_IMAGES) return;
    const now = performance.now();

    for (const imageId of keep) {
      if (!images.delete(imageId)) continue;
      images.set(imageId, now);
    }

    for (const imageId of this.viewportPictureWork.get(map)?.drawn ?? []) {
      if (!images.delete(imageId)) continue;
      images.set(imageId, now);
    }

    const oldest = now - PICTURE_IMAGE_TTL_MS;
    let released = 0;
    let stale = 0;

    for (const [imageId, lastUsed] of [...images]) {
      if (lastUsed >= oldest) continue;

      if (map.hasImage(imageId)) map.removeImage(imageId);
      else stale++;

      images.delete(imageId);
      released++;
    }

    if (released > 0) {
      logger.scope('MapSurface').debug('Viewport pictures released', {
        provider: this.getProviderClassName(), released, stale, held: images.size, mapImages: map.listImages().length,
        newIds: this.pictureIdsAdded.get(map) ?? 0, failedPictures: markerPictureFailedCount(),
      });
      this.pictureIdsAdded.set(map, 0);
    }
  }

  private schedulePictureImages(map: maplibregl.Map, places: MapPlace[], drawing = false): void {
    this.installViewportPictureSync(map);
    if (!drawing && MapState.for(map).getClusteringManager()?.isClustering()) return;
    const running = this.viewportPictureWork.get(map);

    if (running?.running) {
      running.requested = { drawing: drawing || running.requested?.drawing === true };

      return;
    }

    const started = performance.now();
    const selected = this.viewportPicturePlaces(map, places);
    const selectMs = performance.now() - started;

    if (selectMs >= SLOW_PICTURE_SELECT_MS) {
      logger.scope('MapSurface').debug('Picture selection slow', {
        provider: this.getProviderClassName(), selectMs: Math.round(selectMs * 10) / 10, scanned: places.length, selected: selected.length,
      });
    }

    void this.runPicturePass(map, selected);
  }

  private async runPicturePass(map: maplibregl.Map, places: MapPlace[]): Promise<void> {
    const work: PictureWork = { running: true, drawn: new Set() };

    this.viewportPictureWork.set(map, work);
    const started = performance.now();
    let selected = 0;
    let drawn = 0;
    let failed = 0;
    let loadMs = 0;
    let drawMs = 0;

    try {
      let pending = places;

      for (let round = 0; pending.length > 0 && round < PICTURE_PASS_MAX_ROUNDS; round++) {
        const drawnBefore = drawn;

        for (let index = 0; index < pending.length; index += PICTURE_DECODE_BATCH) {
          const batch = pending.slice(index, index + PICTURE_DECODE_BATCH);
          const loadStarted = performance.now();

          await loadMarkerPictures(batch.map(place => place.iconImageUrl!), domPictureLoader, this.iconImageQuality(map).decodePx);
          loadMs += performance.now() - loadStarted;
          if (!map.getSource(SYMBOL_MARKER_LAYER_ID)) return;
          let sliceStarted = performance.now();

          for (const place of batch) {
            if (markerPictureFailed(place.iconImageUrl!)) { failed++; continue; }

            if (performance.now() - sliceStarted >= PICTURE_DRAW_BUDGET_MS) {
              await new Promise<void>(resolve => { activeWindow.requestAnimationFrame(() => resolve()); });
              if (!map.getSource(SYMBOL_MARKER_LAYER_ID)) return;
              sliceStarted = performance.now();
            }

            const drawStarted = performance.now();
            const outcome = this.ensureSymbolIconImage(map, place);

            drawMs += performance.now() - drawStarted;
            work.drawn.add(this.pictureImageIdOf(map, place, place.iconImageUrl!));
            if (outcome !== 'failed') drawn++;
          }
        }

        selected += pending.length;
        pending = drawn > drawnBefore && pending.length < MAX_VIEWPORT_PICTURES
          ? this.viewportPicturePlaces(map, MapState.for(map).getCurrentPlaces())
          : [];
      }
    } catch (error) {
      logger.scope('MapSurface').debug('Marker pictures did not load', { error: getErrorMessage(error) });
    } finally {
      work.running = false;
      if (drawn > 0 && map.getSource(SYMBOL_MARKER_LAYER_ID)) this.schedulePictureSourceRefresh(map);
      if (this.pictureEvictionDue(map)) this.evictPictureImages(map, this.viewportPictureImageIds(map));
      if (work.requested && map.getSource(SYMBOL_MARKER_LAYER_ID)) this.schedulePictureImages(map, MapState.for(map).getCurrentPlaces(), work.requested.drawing);

      if (selected > 0) {
        logger.scope('MapSurface').debug('Viewport pictures prepared', {
          provider: this.getProviderClassName(), selected, drawn, failed,
          images: this.pictureImages.get(map)?.size ?? 0, mapImages: map.listImages().length,
          loadMs: Math.round(loadMs), drawMs: Math.round(drawMs), ...takeMarkerPictureLoadTiming(), ...takeStoredPictureCounts(), ...markerPictureFailureCounts(),
          durationMs: Math.round((performance.now() - started) * 10) / 10,
          heapMB: heapUsedMB(),
        });
      }
    }
  }

  private viewportPicturePlaces(map: maplibregl.Map, places: MapPlace[]): MapPlace[] {
    const bounds = map.getBounds();
    const latitudeBuffer = (bounds.getNorth() - bounds.getSouth()) * VIEWPORT_PICTURE_BUFFER;
    const longitudeBuffer = (bounds.getEast() - bounds.getWest()) * VIEWPORT_PICTURE_BUFFER;
    const west = bounds.getWest() - longitudeBuffer;
    const east = bounds.getEast() + longitudeBuffer;
    const south = bounds.getSouth() - latitudeBuffer;
    const north = bounds.getNorth() + latitudeBuffer;
    const wanted = new Map<string, MapPlace>();

    for (const place of places) {
      const url = place.iconImageUrl;

      if (!url || isIconHidden(place) || markerPictureFailed(url)) continue;
      if (place.longitude < west || place.longitude > east) continue;
      if (place.latitude < south || place.latitude > north) continue;
      const imageId = this.pictureImageIdOf(map, place, url);

      if (wanted.has(imageId)) continue;
      if (map.hasImage(imageId)) continue;
      wanted.set(imageId, place);
    }

    const candidates = [...wanted.values()];

    if (candidates.length <= MAX_VIEWPORT_PICTURES) return candidates;

    const centerLatitude = (bounds.getNorth() + bounds.getSouth()) / 2;
    const centerLongitude = (bounds.getEast() + bounds.getWest()) / 2;
    const fromCenter = (place: MapPlace): number =>
      (place.latitude - centerLatitude) ** 2 + (place.longitude - centerLongitude) ** 2;

    return candidates.sort((left, right) => fromCenter(left) - fromCenter(right)).slice(0, MAX_VIEWPORT_PICTURES);
  }

  private installViewportPictureSync(map: maplibregl.Map): void {
    if (this.viewportPictureSyncInstalled.has(map)) return;
    this.viewportPictureSyncInstalled.add(map);
    map.on('moveend', () => { this.schedulePictureImages(map, MapState.for(map).getCurrentPlaces()); });
  }

  private schedulePictureSourceRefresh(map: maplibregl.Map): void {
    if (this.pictureSourceRefreshPending.has(map)) return;
    this.pictureSourceRefreshPending.add(map);
    map.once('render', () => {
      this.pictureSourceRefreshPending.delete(map);
      if (!map.getSource(SYMBOL_MARKER_LAYER_ID)) return;
      const { features } = this.buildSymbolMarkerData(map, MapState.for(map).getCurrentPlaces());

      this.replaceSourceFeed(map, SYMBOL_MARKER_LAYER_ID, true);
      this.ensureGeoJsonSource(map, SYMBOL_MARKER_LAYER_ID, {
        type: 'geojson', data: { type: 'FeatureCollection', features },
      });
    });
    map.triggerRepaint();
  }

  private createPointFeature(map: maplibregl.Map, place: MapPlace, zoomSizeStops: number[], stopsKey: string, mapAlignedIcons: boolean): GeoJSON.Feature {
    const iconImageId = this.getSymbolIconImageId(map, place);
    const glyphImageId = this.glyphImageIdOf(place);
    const cached = this.pointFeatures.get(place);

    if (cached && cached.iconImageId === iconImageId && cached.glyphImageId === glyphImageId && cached.stopsKey === stopsKey && cached.mapAlignedIcons === mapAlignedIcons) return cached.feature;
    const feature = buildPointFeature({ place, zoomSizeStops, mapAlignedIcons, iconImageId, glyphImageId });

    this.pointFeatures.set(place, { feature, iconImageId, glyphImageId, stopsKey, mapAlignedIcons });

    return feature;
  }

  private createHtmlMarkerFeature(map: maplibregl.Map, place: MapPlace): GeoJSON.Feature {
    return buildHtmlMarkerFeature({ place, iconImageId: this.getSymbolIconImageId(map, place) });
  }

  private createIconMarkerWithReturn(map: maplibregl.Map, feature: GeoJSON.Feature, settings: CommonMapSettings): maplibregl.Marker {
    return MapLibreHelper.createIconMarker(
      map,
      feature,
      this.onMarkerClick.bind(this, map, feature, settings),
      settings.showLabels
    );
  }

  protected onMarkerClick(map: maplibregl.Map, feature: GeoJSON.Feature, settings: CommonMapSettings): void {
    const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
    const place = parseMapPlaceProperty(feature.properties?.mapPlace);

    if (!hasPlaceMarker(place)) {
      return;
    }

    if (!hasDisplayableContent(place)) {
      return;
    }

    const hits = orderMapHits([createMapHit('marker', place, 0), ...this.collectMapHits(map, map.project(coordinates))]);

    if (hits.length > 1) {
      this.openHitStackPopup(map, hits, coordinates, settings);

      return;
    }

    this.createPopup(map, place, coordinates, settings);
  }

  protected onPlacesLayerClick(e: maplibregl.MapLayerMouseEvent, settings: CommonMapSettings): void {
    const map = e.target;
    const feature = e.features?.[0];

    if (!feature) return;

    e.preventDefault();

    const place = this.resolveFeaturePlace(map, feature);

    if (place.metadata?.boundsAnchor) {
      return;
    }

    if (place.metadata?.frequency !== undefined) {
      (e.originalEvent as Event & { _heatmapClicked?: boolean })._heatmapClicked = true;

      return;
    }

    if (!hasDisplayableContent(place)) {
      return;
    }

    if (this.claimMapClick(e.originalEvent)) return;

    const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];
    const hits = this.collectMapHits(map, e.point, e.features);

    if (hits.length > 1) {
      this.openHitStackPopup(map, hits, coordinates, settings);

      return;
    }

    this.createPopup(map, place, coordinates, settings);
  }

  private resolveFeaturePlace(map: maplibregl.Map, feature: maplibregl.MapGeoJSONFeature): MapPlace {
    const props: Record<string, unknown> = feature.properties ?? {};

    if (typeof props.placeId === 'string') {
      const statePlace = MapState.for(map).getPlaceById(props.placeId);

      if (statePlace) return statePlace;
    }

    if (typeof props.mapPlace === 'string') {
      try {
        return JSON.parse(props.mapPlace) as MapPlace;
      } catch (error) {
        logger.scope('MapSurface').debug('Feature place data could not be decoded; using feature properties', { error });
      }
    }

    const asText = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;

    return {
      latitude: (feature.geometry as GeoJSON.Point).coordinates[1],
      longitude: (feature.geometry as GeoJSON.Point).coordinates[0],
      name: asText(props.description) ?? '',
      icon: asText(props.icon) ?? '',
      filePath: asText(props.file_path),
    };
  }

  protected collectMapHits(map: maplibregl.Map, point: maplibregl.Point, markerFeatures?: maplibregl.MapGeoJSONFeature[]): MapHit[] {
    const mapState = MapState.for(map);
    const hits: MapHit[] = [];

    const markers = markerFeatures ?? this.queryMarkerFeatures(map, point);

    markers.forEach((feature, order) => {
      const place = this.resolveFeaturePlace(map, feature);

      if (place.metadata?.boundsAnchor || place.metadata?.frequency !== undefined) return;
      if (!hasDisplayableContent(place)) return;
      hits.push(createMapHit('marker', place, order));
    });

    if (mapState.getClusteringManager()?.isClustering() && map.getLayer(CLUSTER_HEATMAP_LAYER_ID)) {
      const sourceFeatures = this.clusterHitFeatures.get(map) ?? [];
      const near = findPointFeaturesWithin({ map, features: sourceFeatures, clickPoint: point, thresholdPx: CLUSTER_HEATMAP_HIT_TOLERANCE_PX });
      let order = 0;

      for (const feature of near) {
        if (order >= CLUSTER_HEATMAP_HIT_LIMIT) break;
        const properties: Record<string, unknown> = feature.properties ?? {};

        if (typeof properties.placeId !== 'string' && typeof properties.mapPlace !== 'string') continue;
        const place = this.resolveFeaturePlace(map, feature as maplibregl.MapGeoJSONFeature);

        if (!hasDisplayableContent(place)) continue;
        hits.push(createMapHit('marker', place, order));
        order++;
      }
    }

    const pointLayers = this.overlayPointLayers.get(map);
    const activePointLayerIds = pointLayers ? [...pointLayers.keys()].filter(id => map.getLayer(id)) : [];

    if (activePointLayerIds.length > 0) {
      map.queryRenderedFeatures(point, { layers: activePointLayerIds }).forEach((feature, order) => {
        const hit = createOverlayPointHit(feature, order, pointLayers?.get(feature.layer.id)?.sourcePath);

        if (hit) hits.push(hit);
      });
    }

    const layers = this.trackLineLayers.get(map);
    const activeLayerIds = layers ? [...layers.keys()].filter(id => map.getLayer(id)) : [];

    if (activeLayerIds.length > 0) {
      const hitBox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - TRACK_HIT_TOLERANCE_PX, point.y - TRACK_HIT_TOLERANCE_PX],
        [point.x + TRACK_HIT_TOLERANCE_PX, point.y + TRACK_HIT_TOLERANCE_PX],
      ];

      map.queryRenderedFeatures(hitBox, { layers: activeLayerIds }).forEach((feature, order) => {
        const placeId = typeof feature.properties?._placeId === 'string'
          ? feature.properties._placeId
          : layers?.get(feature.layer.id);
        const place = placeId ? mapState.getPlaceById(placeId) : undefined;

        if (place) hits.push(createMapHit('track', place, order));
      });
    }

    hits.push(...this.collectVectorFeatureHits(map, point));

    return orderMapHits(hits);
  }

  private collectVectorFeatureHits(map: maplibregl.Map, point: maplibregl.Point): MapHit[] {
    const layers = this.overlayHandler.getVectorFeatureHitLayers(map);
    const layerIds = [...layers.keys()].filter(id => map.getLayer(id));

    if (layerIds.length === 0) return [];

    const hitBox: [maplibregl.PointLike, maplibregl.PointLike] = [
      [point.x - TRACK_HIT_TOLERANCE_PX, point.y - TRACK_HIT_TOLERANCE_PX],
      [point.x + TRACK_HIT_TOLERANCE_PX, point.y + TRACK_HIT_TOLERANCE_PX],
    ];
    const clicked = map.unproject(point);
    const distance = (feature: maplibregl.MapGeoJSONFeature): number => {
      if (feature.geometry.type !== 'Point') return 0;
      const [longitude, latitude] = feature.geometry.coordinates;

      return map.project([longitude, latitude]).dist(point);
    };
    const features = map.queryRenderedFeatures(hitBox, { layers: layerIds })
      .map((feature, order) => ({ feature, order, distance: distance(feature) }))
      .sort((left, right) => left.distance - right.distance || left.order - right.order);

    const hits = new Map<string, MapHit>();

    for (const { feature } of features) {
      if (hits.size >= VECTOR_FEATURE_HIT_LIMIT) break;
      const layer = layers.get(feature.layer.id);

      if (!layer) continue;
      const labelValue: unknown = layer.textField ? feature.properties?.[layer.textField] : undefined;
      const label = typeof labelValue === 'string' || typeof labelValue === 'number' ? String(labelValue) : layer.label;
      const coordinate = feature.geometry.type === 'Point'
        ? { longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] }
        : { longitude: clicked.lng, latitude: clicked.lat };
      const hit = createFeatureHit(feature, hits.size, { layerId: feature.layer.id, label, coordinate });

      if (!hits.has(hit.id)) hits.set(hit.id, hit);
    }

    return [...hits.values()];
  }

  private claimMapClick(originalEvent: MouseEvent | undefined): boolean {
    if (!originalEvent) return false;

    const claimed = originalEvent as MouseEvent & { _placesHitAnswered?: boolean };

    if (claimed._placesHitAnswered) return true;
    claimed._placesHitAnswered = true;

    return false;
  }

  private queryMarkerFeatures(map: maplibregl.Map, point: maplibregl.Point): maplibregl.MapGeoJSONFeature[] {
    const layerIds = [...SYMBOL_MARKER_LAYER_IDS, 'places-markers'].filter(id => map.getLayer(id));

    return layerIds.length > 0 ? map.queryRenderedFeatures(point, { layers: layerIds }) : [];
  }

  private toggleGeoJsonOverlay(map: maplibregl.Map, place: MapPlace, visible?: boolean): void {
    const mapState = MapState.for(map);

    if (place.filePath) {
      const overlayIndex = mapState.getOverlayIndexForPlace(place.filePath);

      if (overlayIndex !== undefined) {
        const sourceId = `geojson-overlay-${overlayIndex}`;
        const lineLayerId = `${sourceId}-line`;
        const hitareaLayerId = `geojson-overlay-${overlayIndex}-line-hitarea`;

        const isCurrentlyVisible = mapState.isGeoJsonOverlayVisible(overlayIndex);
        const nextVisible = visible ?? !isCurrentlyVisible;
        const newVisibility = nextVisible ? 'visible' : 'none';

        setLayerVisibility(map, [`${sourceId}-fill`, `${sourceId}-fill-outline`, lineLayerId, `${lineLayerId}-outline`, `${lineLayerId}-route-label`, `${lineLayerId}-direction`, `${lineLayerId}-endpoints`, hitareaLayerId, `geojson-overlay-${overlayIndex}-circle`, `geojson-overlay-${overlayIndex}-circle-emoji`], newVisibility);
        mapState.setGeoJsonOverlayVisible(overlayIndex, nextVisible);
        this.recordTrackUserVisibility(map, getPlaceId(place), nextVisible);

        return;
      }
    }

    if (!place.overlay?.geojson) return;

    const placeId = getPlaceId(place);

    const viewportController = this.viewportTrackControllers.get(map);

    if (viewportController?.isManaged(placeId)) {
      viewportController.setHidden(placeId, visible === undefined ? !viewportController.isHidden(placeId) : !visible);

      return;
    }

    const sourceId = `dynamic-overlay-${placeId}`;
    const lineLayerId = `${sourceId}-line`;
    const hitareaLayerId = `${sourceId}-hitarea`;

    if (map.getSource(sourceId)) {
      const lineLayer = map.getLayer(lineLayerId);

      if (lineLayer) {
        const currentVisibility: unknown = map.getLayoutProperty(lineLayerId, 'visibility');
        const nowVisible = visible ?? currentVisibility === 'none';

        this.setDynamicOverlayVisibility(map, placeId, nowVisible);
        this.recordTrackUserVisibility(map, placeId, nowVisible);
      }
    } else if (visible !== false) {
      const style = getStyleForPlace(undefined, placeId, place);
      const currentSettings = MapState.for(map).getCurrentSettings();

      this.addDynamicOverlayLayers(map, place.overlay.geojson, sourceId, lineLayerId, hitareaLayerId, style, placeId, place.overlay.pathLabels ?? [], place.trackZoom, currentSettings?.showLabels ?? true, place.filePath);
      MapState.for(map).setTrack(placeId, {
        place,
        settings: MapState.for(map).getCurrentSettings()!,
        trackIndex: -1,
        renderSignature: getTrackRenderSignature(place, undefined),
      });
      this.recordTrackUserVisibility(map, placeId, true);
    }
  }

  private applyZoomRange<T extends maplibregl.LayerSpecification>(layer: T, zoom?: ZoomRange): T {
    if (zoom?.minZoom !== undefined) layer.minzoom = zoom.minZoom;
    if (zoom?.maxZoom !== undefined) layer.maxzoom = toGlMaxZoom(zoom.maxZoom);

    return layer;
  }

  private addPlacePolygonLayers(map: maplibregl.Map, sourceId: string, data: GeoJSON.GeoJSON, color: string, zoom?: ZoomRange, placeId?: string): string[] {
    const layerIds = [`${sourceId}-fill`, `${sourceId}-fill-outline`];

    if (!map.getLayer(layerIds[0]) && !getGeoJsonFeatures(data).some(feature => feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon')) return [];

    for (const layer of createGeoJsonPolygonLayers(sourceId, color)) {
      if (!map.getLayer(String(layer.id))) map.addLayer(this.applyZoomRange(layer as maplibregl.LayerSpecification, zoom));
    }

    this.registerTrackLineLayer(map, layerIds[0], placeId);

    return layerIds;
  }

  private addDynamicOverlayLayers(map: maplibregl.Map, geojson: GeoJSON.GeoJSON, sourceId: string, lineLayerId: string, hitareaLayerId: string, style: CompleteTrackStyle & { outline: boolean }, placeId: string, pathLabels: GeoJSON.Feature[] = [], zoom?: ZoomRange, showLabels = true, sourcePath?: string, preserveShortLines = false, original?: GeoJSON.GeoJSON): void {
    const outlineLayerId = `${lineLayerId}-outline`;
    const routeLabelLayerId = `${lineLayerId}-route-label`;
    const directionLayerId = `${lineLayerId}-direction`;
    const endpointLayerId = `${lineLayerId}-endpoints`;

    const endpointFeatures = trackEndpointFeatures(original ?? geojson);
    const sourceData: GeoJSON.GeoJSON = geojson.type === 'FeatureCollection'
      ? { ...geojson, features: [...geojson.features, ...pathLabels, ...endpointFeatures] }
      : geojson;

    const existingSource = map.getSource<maplibregl.GeoJSONSource>(sourceId);

    if (existingSource) {
      void existingSource.setData(sourceData);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        ...(preserveShortLines ? { tolerance: 0 } : {}),
        data: sourceData
      });
    }

    this.addPlacePolygonLayers(map, sourceId, sourceData, style.color, zoom, placeId);

    const dashArray = style.dashArray.length > 0 ? style.dashArray : undefined;

    if (style.outline && !map.getLayer(outlineLayerId)) {
      const outlinePaint: Record<string, unknown> = {
        'line-color': style.outlineColor,
        'line-width': style.outlineWeight,
        'line-opacity': style.outlineOpacity
      };

      if (style.outlineDashArray.length) {
        outlinePaint['line-dasharray'] = style.outlineDashArray;
      }

      map.addLayer(this.applyZoomRange({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: outlinePaint
      }, zoom));
    }

    const paint: Record<string, unknown> = {
      'line-color': ['coalesce', ['get', 'stroke'], style.color],
      'line-width': ['coalesce', ['get', 'stroke-width'], style.weight],
      'line-opacity': ['coalesce', ['get', 'stroke-opacity'], style.opacity]
    };

    if (dashArray) {
      paint['line-dasharray'] = dashArray;
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer(this.applyZoomRange({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint
      }, zoom));
    }

    const arrowScale = MapState.for(map).getCurrentBlockSettings()?.trackDirectionArrows ?? 1;

    if (arrowScale > 0 && !map.getLayer(directionLayerId)) {
      const directionImage = ensureTrackDirectionArrowImage(map);

      map.addLayer({
        id: directionLayerId, type: 'symbol', source: sourceId, minzoom: Math.max(zoom?.minZoom ?? 0, 10),
        ...(zoom?.maxZoom !== undefined ? { maxzoom: toGlMaxZoom(zoom.maxZoom) } : {}),
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'symbol-placement': 'line', 'symbol-spacing': 260, 'icon-image': directionImage, 'icon-size': 1.25 * arrowScale, 'icon-anchor': 'center', 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'icon-keep-upright': false, 'icon-allow-overlap': false, 'icon-ignore-placement': true, 'icon-padding': 8 },
        paint: { 'icon-color': ['coalesce', ['get', 'stroke'], style.color], 'icon-halo-color': '#ffffff', 'icon-halo-width': 1.25, 'icon-opacity': ['coalesce', ['get', 'stroke-opacity'], style.opacity] }
      });
    } else if (arrowScale <= 0 && map.getLayer(directionLayerId)) {
      map.removeLayer(directionLayerId);
    }

    if (!map.getLayer(endpointLayerId)) {
      map.addLayer({
        id: endpointLayerId, type: 'symbol', source: sourceId,
        filter: ['has', '_placesTrackEndpoint'],
        layout: { 'text-field': ['get', '_placesTrackEndpoint'], 'text-size': 12, 'text-allow-overlap': true },
        paint: { 'text-color': style.color, 'text-halo-color': '#fff', 'text-halo-width': 1.5 }
      });
    }

    if (!map.getLayer(hitareaLayerId)) {
      map.addLayer(this.applyZoomRange({
        id: hitareaLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        ...(this.getProviderIntegration() === 'mapbox-gl' ? {} : { layout: { 'line-join': 'round', 'line-cap': 'round' } }),
        paint: {
          'line-color': 'transparent',
          'line-width': 15,
          'line-opacity': 0
        }
      }, zoom));
    }

    this.addDynamicWaypointLayers(map, sourceId, lineLayerId, style, zoom, showLabels, sourcePath, sourceData);

    if (showLabels && !map.getLayer(routeLabelLayerId)) {
      this.addDynamicRouteLabelLayer(map, sourceId, routeLabelLayerId, zoom);
    }

    this.restorePointAnnotationCollisionOrder(map);
    this.registerTrackLineLayer(map, hitareaLayerId, placeId);
  }

  private addDynamicWaypointLayers(map: maplibregl.Map, sourceId: string, lineLayerId: string, style: CompleteTrackStyle & { outline: boolean }, zoom?: ZoomRange, showLabels = true, sourcePath?: string, data?: GeoJSON.GeoJSON): void {
    const pointsLayerId = `${lineLayerId}-points`;
    const pointsEmojiLayerId = `${pointsLayerId}-emoji`;
    const pointsLabelLayerId = `${lineLayerId}-points-label`;

    if (data) ensureWaypointIconImages(map, data);

    if (showLabels && !map.getLayer(pointsLabelLayerId)) {
      map.addLayer(this.applyZoomRange(createWaypointLabelLayerConfig({
        sourceId,
        layerId: pointsLabelLayerId,
        excludeProperties: ['route_label_point', '_placesTrackEndpoint', '_placesWaypointLabelApplied'],
      }) as maplibregl.LayerSpecification as never, zoom));
    }

    if (!map.getLayer(pointsLayerId)) {
      ensureWaypointMarkerImage(map);
      map.addLayer(this.applyZoomRange(createWaypointLayerConfig({
        sourceId,
        layerId: pointsLayerId,
        trackColor: style.color,
        excludeProperties: ['route_label_point', '_placesTrackEndpoint'],
      }) as maplibregl.LayerSpecification as never, zoom));
      this.registerOverlayPointLayer(map, pointsLayerId, { sourcePath, trackWaypoints: true });
    }

    if (!map.getLayer(pointsEmojiLayerId)) {
      map.addLayer(this.applyZoomRange(createWaypointEmojiLayerConfig({
        sourceId,
        layerId: pointsEmojiLayerId,
        excludeProperties: ['route_label_point', '_placesTrackEndpoint'],
      }) as maplibregl.LayerSpecification as never, zoom));
      this.registerOverlayPointLayer(map, pointsEmojiLayerId, { sourcePath, trackWaypoints: true });
    }
  }

  private restorePointAnnotationCollisionOrder(map: maplibregl.Map): void {
    const waypointLayerIds = [...(this.overlayPointLayers.get(map)?.entries() ?? [])].filter(([, entry]) => entry.trackWaypoints).map(([layerId]) => layerId);

    promotePointIconLayers(map, [...waypointLayerIds, SYMBOL_MARKER_LAYER_ID]);
    if (map.getLayer(SYMBOL_BENEATH_LAYER_ID)) map.moveLayer(SYMBOL_BENEATH_LAYER_ID, lowestLayerId(map, [SYMBOL_MARKER_LAYER_ID, 'places-markers']));
  }

  private registerTrackLineLayer(map: maplibregl.Map, hitareaLayerId: string, placeId?: string): void {
    let layers = this.trackLineLayers.get(map);

    if (!layers) {
      layers = new Map<string, string | undefined>();
      this.trackLineLayers.set(map, layers);
    }

    MapLibreHelper.addPointerCursor(map, hitareaLayerId);
    layers.set(hitareaLayerId, placeId);
    this.wireMapHitClick(map);
  }

  private wireMapHitClick(map: maplibregl.Map): void {
    if (this.mapHitClickWiredMaps.has(map)) return;
    this.mapHitClickWiredMaps.add(map);

    const applySharedTrackPoint = (event: Event): void => {
      const detail = (event as CustomEvent<{ trackPath?: string; latitude?: number; longitude?: number }>).detail;

      if (!detail || detail.latitude === undefined || detail.longitude === undefined) return;
      const mapState = MapState.for(map);
      const exactPlace = mapState.getCurrentPlaces().find(candidate => candidate.filePath === detail.trackPath);

      if (detail.trackPath && !exactPlace) return;
      const place = exactPlace ?? mapState.getCurrentPlaces().find(candidate => hasTrackData(candidate));

      if (!place) return;
      const settings = mapState.getCurrentSettings() ?? ({} as CommonMapSettings);
      const coordinate = { latitude: detail.latitude, longitude: detail.longitude };

      logger.scope('TrackInteractions').debug('shared track point applied to map', {
        placeId: getPlaceId(place),
        trackPath: place.filePath,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        detailsMode: settings.trackDetails,
      });

      if (settings.trackDetails === 'panel') {
        this.showTrackInspectionPanel(map, place, coordinate, settings);
      } else {
        this.createPopup(map, place, [coordinate.longitude, coordinate.latitude], settings, { toggleOverlay: false, inspectTrack: true });
      }
    };
    const mapContainer = map.getContainer();
    const document = mapContainer.ownerDocument;

    mapContainer.addEventListener(TRACK_INSPECTION_REQUEST_EVENT, applySharedTrackPoint);
    document.addEventListener(TRACK_POINT_SELECT_EVENT, applySharedTrackPoint);
    void map.once('remove', () => {
      mapContainer.removeEventListener(TRACK_INSPECTION_REQUEST_EVENT, applySharedTrackPoint);
      document.removeEventListener(TRACK_POINT_SELECT_EVENT, applySharedTrackPoint);
    });

    map.on('click', (e) => {
      if (e.defaultPrevented) return;

      const hits = this.collectMapHits(map, e.point);

      if (hits.length === 0) return;
      if (this.claimMapClick(e.originalEvent)) return;
      logger.scope('TrackInteractions').debug('map click resolved', {
        hitCount: hits.length,
        placeIds: hits.map(hit => hit.id),
      });

      e.preventDefault();
      const settings = MapState.for(map).getCurrentSettings() ?? ({} as CommonMapSettings);
      const coordinates: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (hits.length === 1) {
        const hit = hits[0];

        if (hit.kind === 'feature') {
          this.openVectorFeaturePopup(map, hit, coordinates);

          return;
        }

        if (hit.feature) {
          this.handleOverlayPointClick(map, hit.feature, hit.sourcePath);

          return;
        }

        const place = hit.place;

        if (hit.kinds.includes('marker')) {
          this.createPopup(map, place, coordinates, settings);

          return;
        }

        dispatchMapTrackSelection(map.getContainer(), { place, coordinate: { longitude: coordinates[0], latitude: coordinates[1] }, intent: 'preview', source: 'map-click' });

        if (settings.trackDetails === 'panel') {
          this.showTrackInspectionPanel(map, place, { latitude: coordinates[1], longitude: coordinates[0] }, settings);
        } else {
          this.createPopup(map, place, coordinates, settings, { toggleOverlay: false, inspectTrack: true });
        }

        return;
      }

      this.openHitStackPopup(map, hits, coordinates, settings);
    });
  }

  private openVectorFeaturePopup(map: maplibregl.Map, hit: MapHit, coordinates: [number, number]): void {
    const layer = hit.layerId ? this.overlayHandler.getVectorFeatureHitLayers(map).get(hit.layerId) : undefined;

    if (!hit.feature || !layer) return;
    const popup = MapLibreHelper.openPopup(map, coordinates, map.getContainer().ownerDocument.createElement('div'));
    const content = this.overlayHandler.buildVectorFeaturePopupContent(map, hit.feature, layer, hit.label, () => popup.setDOMContent(content));

    popup.setDOMContent(content);
  }

  protected openHitStackPopup(map: maplibregl.Map, hits: MapHit[], coordinates: [number, number], settings: CommonMapSettings): void {
    const rendered = new Map<number, HTMLElement>();
    let removed = false;
    const onRemove = () => { removed = true; };

    map.on('remove', onRemove);
    const popup = MapLibreHelper.openPopup(map, coordinates, map.getContainer().ownerDocument.createElement('div'));

    const paged = buildPagedPopupContent({
      pages: hits.map(hit => ({ label: hit.label, icon: hit.icon, kind: hit.kind })),
      onShow: (index, host, root) => {
        const hit = hits[index];
        const body = rendered.get(index);

        if (body) {
          host.appendChild(body);
        } else {
          const page = host.createDiv({ cls: 'places-popup-page-body' });

          rendered.set(index, page);
          this.renderHitPage(map, hit, page, popup, root, coordinates, settings);
        }

        if (hit.kinds.includes('track')) dispatchMapTrackSelection(map.getContainer(), { place: hit.place, coordinate: { longitude: coordinates[0], latitude: coordinates[1] }, intent: 'preview', source: 'map-click' });
        const place = MapState.for(map).getCurrentPlaces().find(place => getPlaceId(place) === hit.id) ?? hit.place;

        if (hit.kinds.includes('marker') && hasTrackData(place)) {
          this.toggleGeoJsonOverlay(map, place, true);

          return () => { if (!removed) this.toggleGeoJsonOverlay(map, place, false); };
        }
      },
    });

    popup.on('close', () => {
      map.off('remove', onRemove);
      paged.dispose();
    });
    popup.setDOMContent(paged.element);
  }

  private renderHitPage(map: maplibregl.Map, hit: MapHit, host: HTMLElement, popup: maplibregl.Popup, root: HTMLElement, coordinates: [number, number], settings: CommonMapSettings): void {
    const place = hit.place;
    const coordinate = { latitude: coordinates[1], longitude: coordinates[0] };

    if (hit.kind === 'feature') {
      const layer = hit.layerId ? this.overlayHandler.getVectorFeatureHitLayers(map).get(hit.layerId) : undefined;

      if (hit.feature && layer) host.appendChild(this.overlayHandler.buildVectorFeaturePopupContent(map, hit.feature, layer, hit.label, () => popup.setDOMContent(root)));
      popup.setDOMContent(root);

      return;
    }

    if (hit.feature) {
      host.appendChild(this.buildOverlayPointContent(map, hit.feature, hit.sourcePath, popup, () => root));
      popup.setDOMContent(root);

      return;
    }

    if (place.metadata?.isWaypoint && !place.settings?.popup && !settings.popup) {
      host.appendChild(buildWaypointPopupContent({ place, units: this.units, onSourceLinkClick: (linkPath) => openLocalFile(this.app, linkPath) }));
      popup.setDOMContent(root);

      return;
    }

    const onPlaceAction = settings.onPlaceAction ?? MapState.for(map).getCurrentSettings()?.onPlaceAction;

    appendPlaceSection(host, {
      icon: place.icon,
      name: place.name,
      subtitle: place.subtitle,
      isLink: !!place.filePath,
      linkPath: place.filePath,
      onLinkClick: place.filePath ? (linkPath) => openLocalFile(this.app, linkPath) : undefined,
      placeActions: place.actions,
      onPlaceAction: onPlaceAction ? (actionId, state) => onPlaceAction(place, actionId, state) : undefined,
      closePopup: () => closeExistingPopups('.maplibregl-popup, .mapboxgl-popup'),
    });

    if (settings.popupDebug) {
      appendPopupDebugSection(host, {
        fields: MarkerStyleService.styleMetadataEntries(place),
        filterRules: MarkerStyleService.explainPlaceMarkerFilter(place, settings.popupDebug.markerFilter),
      });
    }

    if (place.filePath || place.settings?.popup || settings.popup) {
      this.enrichPlaceSection(place, host, popup, root, settings.popup, settings.popupSourcePath, settings.popupRenderers);
    }

    if (!hit.kinds.includes('track') || settings.trackDetails === 'panel' || !settings.inspectTrack) return;
    appendTrackInspectionSection({
      host, place, coordinate, inspectTrack: settings.inspectTrack,
      signal: popupContentSignal(root),
      onRendered: () => popup.setDOMContent(root),
    });
  }

  private showTrackInspectionPanel(map: maplibregl.Map, place: MapPlace, coordinate: { latitude: number; longitude: number }, settings: CommonMapSettings): void {
    closeExistingPopups('.maplibregl-popup, .mapboxgl-popup');
    let panel = this.trackInspectionPanels.get(map);

    if (!panel) {
      panel = new TrackDetailsPanel({
        container: map.getContainer(),
        openLink: (linkPath) => openLocalFile(this.app, linkPath),
        onDispose: () => this.trackInspectionPanels.delete(map),
      });
      this.trackInspectionPanels.set(map, panel);
      getMapLibreResourceRegistry(map).registerDisposer('disposer', 'track-inspection-panel', () => {
        this.trackInspectionPanels.get(map)?.dispose();
      });
    }

    panel.show(place, coordinate, settings.inspectTrack);
  }

  private registerOverlayPointLayer(map: maplibregl.Map, layerId: string, options: { sourcePath?: string; trackWaypoints?: boolean } = {}): void {
    let registered = this.overlayPointLayers.get(map);

    if (!registered) {
      registered = new Map<string, { sourcePath?: string; trackWaypoints: boolean }>();
      this.overlayPointLayers.set(map, registered);
    }

    registered.set(layerId, { ...(options.sourcePath ? { sourcePath: options.sourcePath } : {}), trackWaypoints: options.trackWaypoints ?? false });
    MapLibreHelper.addPointerCursor(map, layerId);
    this.wireMapHitClick(map);
  }

  private addDynamicRouteLabelLayer(map: maplibregl.Map, sourceId: string, layerId: string, zoom?: ZoomRange): void {
    map.addLayer(this.applyZoomRange(createPathLabelLayerConfig({
      sourceId,
      layerId
    }) as maplibregl.LayerSpecification, zoom));
  }

  private getViewportTrackBucketKey(style: CompleteTrackStyle & { outline: boolean }, zoom: ZoomRange | undefined, preserveShortLines: boolean): string {
    const dashArray = style.dashArray.length > 0 ? style.dashArray : [];

    return [
      preserveShortLines ? 'segments' : 'simplified',
      style.outline ? `outline:${style.outlineDashArray.join(',')}` : 'plain',
      dashArray.length > 0 ? `dash:${dashArray.join(',')}` : 'solid',
      `min:${zoom?.minZoom ?? ''}`,
      `max:${zoom?.maxZoom ?? ''}`,
    ].join('|');
  }

  private resolveTrackGeoJson(place: MapPlace, settings?: CommonMapSettings): GeoJSON.GeoJSON | undefined {
    const geojson = place.overlay?.geojson;

    if (!geojson) return undefined;
    const colorBy = place.trackColorBy ?? settings?.trackColorBy;

    if (!colorBy || colorBy === 'none') return geojson;

    const derived = place.overlay ? resolveOverlayTrackData(place.overlay) : undefined;
    const hasData = (colorBy === 'elevation' || colorBy === 'grade')
      ? Boolean(derived?.elevation)
      : Boolean(derived?.time?.length);

    if (!hasData) return geojson;

    return createGradientColoredGeoJson(
      place,
      colorBy,
      settings?.trackGradeWindow ?? DEFAULT_GRADE_WINDOW,
      settings?.trackSpeedWindow,
    ) ?? geojson;
  }

  private createViewportTrackFeatures(place: MapPlace, visibility: TrackVisibilityResult, settings: CommonMapSettings, geojson = this.resolveTrackGeoJson(place, settings)): GeoJSON.Feature[] {
    return finishWork(this.createViewportTrackFeaturesWork(place, visibility, settings, geojson));
  }

  private *createViewportTrackFeaturesWork(place: MapPlace, visibility: TrackVisibilityResult, settings: CommonMapSettings, geojson: GeoJSON.GeoJSON | undefined): Generator<void, GeoJSON.Feature[]> {
    if (!geojson) return [];

    const placeId = getPlaceId(place);
    const style = getStyleForPlace(visibility, placeId, place);
    const features: GeoJSON.Feature[] = [];
    const lineProperties = ['stroke', 'stroke-width', 'stroke-opacity', 'outline-color', 'outline-width', 'outline-opacity'];
    const renderFeatures = geojson !== place.overlay?.geojson
      ? yield* gradientTrackFeaturesWork(geojson)
      : getGeoJsonFeatures(geojson);

    let count = 0;

    for (const feature of renderFeatures) {
      if (++count % 128 === 0) yield;
      const isLine = feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString';
      const properties: Record<string, unknown> = isLine
        ? Object.fromEntries(lineProperties
          .filter(key => feature.properties?.[key] !== undefined).map(key => [key, feature.properties![key]]))
        : { ...(feature.properties ?? {}) };
      const isPointFeature = feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint';

      if (!properties.stroke) properties.stroke = style.color;
      if ((feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') && properties.fill === undefined) properties.fill = style.color;
      if (!isPointFeature && properties['stroke-width'] === undefined) properties['stroke-width'] = style.weight;
      if (properties['stroke-opacity'] === undefined) properties['stroke-opacity'] = style.opacity;

      if (style.outline) {
        if (properties['outline-color'] === undefined) properties['outline-color'] = style.outlineColor;
        if (properties['outline-width'] === undefined) properties['outline-width'] = style.outlineWeight;
        if (properties['outline-opacity'] === undefined) properties['outline-opacity'] = style.outlineOpacity;
      }

      properties._placeId = placeId;

      if (isPointFeature) {
        properties._overlaySource = place.filePath;
      }

      features.push({ ...feature, properties });
    }

    for (const endpoint of trackEndpointFeatures(place.overlay?.geojson ?? geojson)) {
      features.push({ ...endpoint, properties: { ...endpoint.properties, _placeId: placeId, stroke: style.color } });
    }

    if (settings.showLabels) {
      for (const labelFeature of place.overlay?.pathLabels ?? []) {
        features.push({
          ...labelFeature,
          properties: {
            ...(labelFeature.properties ?? {}),
            _placeId: placeId,
          },
        });
      }
    }

    return features;
  }

  private updateViewportTrackBucket(map: maplibregl.Map, sourceId: string, update: ViewportBucketUpdate, style: CompleteTrackStyle & { outline: boolean }, zoom: ZoomRange | undefined, showLabels: boolean, preserveShortLines: boolean): string[] {
    const lineLayerId = `${sourceId}-line`;
    const outlineLayerId = `${lineLayerId}-outline`;
    const hitareaLayerId = `${sourceId}-hitarea`;
    const routeLabelLayerId = `${lineLayerId}-route-label`;
    const directionLayerId = `${lineLayerId}-direction`;
    const endpointLayerId = `${lineLayerId}-endpoints`;

    const source = map.getSource<maplibregl.GeoJSONSource>(sourceId);

    if (update.initial) {
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, ...(preserveShortLines ? { tolerance: 0 } : {}) });
      void map.getSource<maplibregl.GeoJSONSource>(sourceId)!.setData(update.initial);
    } else if (source && update.snapshot) {
      void source.setData(update.snapshot);
    } else if (source) {
      void source.updateData(update.diff);
    }

    const polygonLayerIds = this.addPlacePolygonLayers(map, sourceId, update.initial ?? update.snapshot ?? { type: 'FeatureCollection', features: update.diff.add ?? [] }, style.color, zoom);

    const dashArray = style.dashArray.length > 0 ? style.dashArray : undefined;

    if (style.outline && !map.getLayer(outlineLayerId)) {
      const outlinePaint: Record<string, unknown> = {
        'line-color': ['coalesce', ['get', 'outline-color'], style.outlineColor],
        'line-width': ['coalesce', ['get', 'outline-width'], style.outlineWeight],
        'line-opacity': ['coalesce', ['get', 'outline-opacity'], style.outlineOpacity],
      };

      if (style.outlineDashArray.length) {
        outlinePaint['line-dasharray'] = style.outlineDashArray;
      }

      map.addLayer(this.applyZoomRange({
        id: outlineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: outlinePaint,
      }, zoom));
    }

    const paint: Record<string, unknown> = {
      'line-color': ['coalesce', ['get', 'stroke'], style.color],
      'line-width': ['coalesce', ['get', 'stroke-width'], style.weight],
      'line-opacity': ['coalesce', ['get', 'stroke-opacity'], style.opacity],
    };

    if (dashArray) {
      paint['line-dasharray'] = dashArray;
    }

    if (!map.getLayer(lineLayerId)) {
      map.addLayer(this.applyZoomRange({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint,
      }, zoom));
    }

    const arrowScale = MapState.for(map).getCurrentBlockSettings()?.trackDirectionArrows ?? 1;

    if (arrowScale > 0 && !map.getLayer(directionLayerId)) {
      const directionImage = ensureTrackDirectionArrowImage(map);

      map.addLayer({ id: directionLayerId, type: 'symbol', source: sourceId, minzoom: Math.max(zoom?.minZoom ?? 0, 10), ...(zoom?.maxZoom !== undefined ? { maxzoom: toGlMaxZoom(zoom.maxZoom) } : {}), filter: ['==', ['geometry-type'], 'LineString'], layout: { 'symbol-placement': 'line', 'symbol-spacing': 260, 'icon-image': directionImage, 'icon-size': 1.25 * arrowScale, 'icon-anchor': 'center', 'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'icon-keep-upright': false, 'icon-allow-overlap': false, 'icon-ignore-placement': true, 'icon-padding': 8 }, paint: { 'icon-color': ['coalesce', ['get', 'stroke'], style.color], 'icon-halo-color': '#ffffff', 'icon-halo-width': 1.25, 'icon-opacity': ['coalesce', ['get', 'stroke-opacity'], style.opacity] } });
    } else if (arrowScale <= 0 && map.getLayer(directionLayerId)) {
      map.removeLayer(directionLayerId);
    }

    if (!map.getLayer(endpointLayerId)) {
      map.addLayer({ id: endpointLayerId, type: 'symbol', source: sourceId, filter: ['has', '_placesTrackEndpoint'], layout: { 'text-field': ['get', '_placesTrackEndpoint'], 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': ['coalesce', ['get', 'stroke'], style.color], 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
    }

    if (!map.getLayer(hitareaLayerId)) {
      map.addLayer(this.applyZoomRange({
        id: hitareaLayerId,
        type: 'line',
        source: sourceId,
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        ...(this.getProviderIntegration() === 'mapbox-gl' ? {} : { layout: { 'line-join': 'round', 'line-cap': 'round' } }),
        paint: {
          'line-color': 'transparent',
          'line-width': 15,
          'line-opacity': 0,
        },
      }, zoom));
    }

    if (!showLabels && map.getLayer(routeLabelLayerId)) {
      this.removeMapLayersAndSources(map, [routeLabelLayerId], []);
    }

    this.addDynamicWaypointLayers(map, sourceId, lineLayerId, style, zoom, showLabels, undefined, update.initial ?? { type: 'FeatureCollection', features: update.diff.add ?? [] });

    if (showLabels && !map.getLayer(routeLabelLayerId)) {
      this.addDynamicRouteLabelLayer(map, sourceId, routeLabelLayerId, zoom);
    }

    this.restorePointAnnotationCollisionOrder(map);
    this.registerTrackLineLayer(map, hitareaLayerId);
    const pointLayerIds = [`${lineLayerId}-points`, `${lineLayerId}-points-emoji`, `${lineLayerId}-points-label`, directionLayerId, endpointLayerId];

    return style.outline
      ? [hitareaLayerId, routeLabelLayerId, lineLayerId, outlineLayerId, ...pointLayerIds, ...polygonLayerIds]
      : [hitareaLayerId, routeLabelLayerId, lineLayerId, ...pointLayerIds, ...polygonLayerIds];
  }

  private showGeoJsonOverlayAndFitBounds(map: maplibregl.Map, place: MapPlace, visibility: TrackVisibilityResult | undefined, settings?: CommonMapSettings, colorBy?: string, gradeWindow?: MetricWindow, fitBounds = true): void {
    if (!place.overlay?.geojson) return;

    const placeId = getPlaceId(place);
    const sourceId = `dynamic-overlay-${placeId}`;
    const lineLayerId = `${sourceId}-line`;
    const hitareaLayerId = `${sourceId}-hitarea`;

    const style = getStyleForPlace(visibility, placeId, place);
    const mapState = MapState.for(map);
    const currentSettings = settings ?? mapState.getCurrentSettings();
    const camera = mapState.getCurrentRenderRequest()?.runtime.camera;

    colorBy = place.trackColorBy ?? colorBy;

    this.renderPreparedTrack(map, place, colorBy as TrackColorBy | undefined, gradeWindow ?? DEFAULT_GRADE_WINDOW, currentSettings?.trackSpeedWindow, geojson => {
      this.addDynamicOverlayLayers(map, geojson, sourceId, lineLayerId, hitareaLayerId, style, placeId, place.overlay?.pathLabels ?? [], place.trackZoom, currentSettings?.showLabels ?? true, place.filePath, geojson !== place.overlay?.geojson, place.overlay?.geojson);
    });

    if (currentSettings) {
      mapState.setTrack(placeId, {
        place,
        settings: currentSettings,
        trackIndex: -1,
        renderSignature: getTrackRenderSignature(place, visibility),
      });
    }

    const overlayBounds = PlacesBoundingBox.fromGeoJSON(place.overlay.geojson);

    if (fitBounds && overlayBounds.isValid()) {
      withProgrammaticCamera(map, () => map.fitBounds(overlayBounds.getLngLatBounds(), { ...resolveFitDataCamera(camera?.kind === 'fit-data' ? camera : {}), animate: false, pitch: map.getPitch(), bearing: map.getBearing() }));
    }
  }

  private clearTrackLayers(map: maplibregl.Map, trackIndex: number): void {
    const prefix = `trackLayer-${trackIndex}`;

    this.removeMapLayersAndSources(
      map,
      [
        `${prefix}-route-path`,
        `${prefix}-route-outline`,
        `${prefix}-frequency-line`,
        `${prefix}-outline`
      ],
      [
        `${prefix}-route`,
        `${prefix}-frequency`,
        `${prefix}-outline`
      ]
    );

    let segmentIndex = 0;

    while (segmentIndex < 1000) {  
      const segmentLayerId = `${prefix}-segment-${segmentIndex}`;

      if (!map.getLayer(segmentLayerId)) break;

      this.removeMapLayersAndSources(
        map,
        [segmentLayerId],
        [`${prefix}-segment-source-${segmentIndex}`]
      );
      segmentIndex++;
    }
  }

  protected createPopup(map: maplibregl.Map, place: MapPlace | undefined, coordinates: [number, number], settings: CommonMapSettings, options?: { toggleOverlay?: boolean; inspectTrack?: boolean }): void {
    if (!place) return;

    const mapState = MapState.for(map);
    const originalPlaces = mapState.getCurrentPlaces();
    const placeId = getPlaceId(place);
    const originalPlace = originalPlaces.find(p => getPlaceId(p) === placeId) ?? place;
    const onPlaceAction = settings.onPlaceAction ?? mapState.getCurrentSettings()?.onPlaceAction;

    if (originalPlace.metadata?.isWaypoint && !originalPlace.settings?.popup && !settings.popup) {
      MapLibreHelper.openPopup(map, coordinates, buildWaypointPopupContent({
        place: originalPlace,
        units: this.units,
        onSourceLinkClick: (linkPath) => openLocalFile(this.app, linkPath),
      }));

      return;
    }

    MapLibreHelper.createPopup(map, {
      content: {
        icon: place.icon,
        name: place.name,
        subtitle: originalPlace.subtitle,
        isLink: !!place.filePath,
        linkPath: place.filePath,
        placeActions: originalPlace.actions,
        onPlaceAction: onPlaceAction ? (actionId, state) => onPlaceAction(originalPlace, actionId, state) : undefined,
        debug: settings.popupDebug
          ? { fields: MarkerStyleService.styleMetadataEntries(originalPlace), filterRules: MarkerStyleService.explainPlaceMarkerFilter(originalPlace, settings.popupDebug.markerFilter) }
          : undefined
      },
      coordinates,
      app: this.app,
      onAdd: (createdPopup) => {
        if ((options?.toggleOverlay ?? true) && !isNonInteractivePlace(originalPlace) && originalPlace.overlay) {
          this.toggleGeoJsonOverlay(map, originalPlace);
        }

        if (originalPlace.filePath || originalPlace.settings?.popup || settings.popup) {
          const popupElement = createdPopup.getElement();
          const contentDiv = popupElement?.querySelector('.places-popup-content');

          if (contentDiv?.instanceOf(HTMLElement)) {
            this.enrichPlaceSection(originalPlace, contentDiv, createdPopup, contentDiv, settings.popup, settings.popupSourcePath, settings.popupRenderers);

            if (options?.inspectTrack && settings.inspectTrack) {
              appendTrackInspectionSection({
                host: contentDiv, place: originalPlace,
                coordinate: { latitude: coordinates[1], longitude: coordinates[0] },
                inspectTrack: settings.inspectTrack, signal: popupContentSignal(contentDiv),
                onRendered: () => createdPopup.setDOMContent(contentDiv),
              });
            }
          }
        }
      }
    });
  }

  private enrichPlaceSection(
    place: MapPlace,
    sectionEl: HTMLElement,
    popup: maplibregl.Popup,
    rootEl: HTMLElement = sectionEl,
    popupConfig?: CommonMapSettings['popup'],
    popupSourcePath?: string,
    popupRenderers: CommonMapSettings['popupRenderers'] = [],
  ): void {
    const loadingEl = sectionEl.createDiv({
      text: "Loading...",
      cls: "places-popup-loading"
    });

    let popupClosed = false;

    popup.on('close', () => { popupClosed = true; });

    void (async () => {
      try {
        const rendered = await renderPopupTargetContentCore(this.app, {
          kind: 'place',
          place,
          markdownSourcePath: popupSourcePath,
        }, popupConfig, sectionEl, popupRenderers);

        if (rendered) {
          if (popupClosed) {
            rendered.dispose();
          } else {
            popup.on('close', () => rendered.dispose());
          }
        }

        if (popupClosed) return;

        const images = sectionEl.querySelectorAll('img');

        images.forEach(img => {
          img.addEventListener('load', () => {
            if (!popupClosed) {
              popup.setDOMContent(rootEl);
            }
          }, { once: true });
        });

        popup.setDOMContent(rootEl);

        if (loadingEl.parentElement) {
          loadingEl.remove();
        }
      } catch (error) {
        if (!popupClosed && loadingEl.parentElement) {
          loadingEl.textContent = "Error loading content";
        }

        logger.scope('Places').error(`Failed to load content for ${place.filePath}:`, error);
      }
    })();
  }

  private showInitialTracks(map: maplibregl.Map, placeStates: PlaceTrackState[], visibility: TrackVisibilityResult, settings: CommonMapSettings, willCluster: boolean = false, perf?: PerformanceMonitor): void {
    const mapState = MapState.for(map);

    const frequencyStates = placeStates.filter(s => hasTrackData(s.place) && s.place.metadata?.frequency !== undefined);
    const regularStates = placeStates.filter(s => hasTrackData(s.place) && s.place.metadata?.frequency === undefined && !s.place.metadata?.boundsAnchor);

    if (frequencyStates.length > 0) {
      this.showMultipleTracks(map, frequencyStates.map(s => s.place), settings);
    }

    if (willCluster) {
      logger.scope('Places').debug(`[Places] Clustering will be active - trackLayers will show when markers are unclustered`);

      return;
    }

    this.setupViewportTrackLoading(map, regularStates.map(s => s.place), visibility, settings, mapState, perf);
  }

  private readonly gradientControllers = new WeakMap<maplibregl.Map, Map<string, AbortController>>();

  private renderPreparedTrack(map: maplibregl.Map, place: MapPlace, colorBy: TrackColorBy | undefined, gradeWindow: MetricWindow, speedWindow: MetricWindow | undefined, draw: (geojson: GeoJSON.GeoJSON) => void): void {
    if (!place.overlay) return;

    if (!colorBy || colorBy === 'none') { draw(place.overlay.geojson);

 return; }

    const placeId = getPlaceId(place);
    let jobs = this.gradientControllers.get(map);

    if (!jobs) this.gradientControllers.set(map, jobs = new Map<string, AbortController>());
    jobs.get(placeId)?.abort();
    const controller = new AbortController();

    jobs.set(placeId, controller);
    const cancel = () => controller.abort();

    map.on('remove', cancel);
    void prepareGradientColoredGeoJson(place, colorBy, gradeWindow, speedWindow, controller.signal).then(async geojson => {
      const prepared = geojson && geojson !== place.overlay!.geojson
        ? { type: 'FeatureCollection' as const, features: await runCooperativeWork(gradientTrackFeaturesWork(geojson), controller.signal) }
        : place.overlay!.geojson;

      if (!controller.signal.aborted && jobs.get(placeId) === controller) draw(prepared);
    }).catch(error => {
      if (!controller.signal.aborted) logger.scope('MapSurface').error('Track gradient preparation failed', error, { placeId });
    }).finally(() => {
      map.off('remove', cancel);
      if (jobs.get(placeId) === controller) jobs.delete(placeId);
      if (jobs.size === 0) this.gradientControllers.delete(map);
    });
  }

  private showTrackForPlace(map: maplibregl.Map, place: MapPlace, visibility?: TrackVisibilityResult, settings?: CommonMapSettings): void {
    if (!place.overlay?.geojson) return;

    const placeId = getPlaceId(place);
    const sourceId = `dynamic-overlay-${placeId}`;
    const lineLayerId = `${sourceId}-line`;
    const hitareaLayerId = `${sourceId}-hitarea`;

    const nextSignature = getTrackRenderSignature(place, visibility);
    const mapState = MapState.for(map);
    const existingTrack = mapState.getTrack(placeId);

    if (existingTrack && existingTrack.renderSignature !== nextSignature) {
      this.removeDynamicOverlayLayers(map, placeId);
      mapState.removeTrack(placeId);
    }

    if (!map.getSource(sourceId)) {
      const style = getStyleForPlace(visibility, placeId, place);

      if (existingTrack?.renderSignature === nextSignature && this.gradientControllers.get(map)?.has(placeId)) return;
      const currentSettings = settings ?? mapState.getCurrentSettings();

      this.renderPreparedTrack(map, place, place.trackColorBy ?? currentSettings?.trackColorBy, currentSettings?.trackGradeWindow ?? DEFAULT_GRADE_WINDOW, currentSettings?.trackSpeedWindow, geojson => {
        this.addDynamicOverlayLayers(map, geojson, sourceId, lineLayerId, hitareaLayerId, style, placeId, place.overlay?.pathLabels ?? [], place.trackZoom, currentSettings?.showLabels ?? true, place.filePath, geojson !== place.overlay?.geojson, place.overlay?.geojson);
      });

      mapState.setTrack(placeId, {
        place,
        settings: settings ?? mapState.getCurrentSettings()!,
        trackIndex: -1,
        renderSignature: nextSignature,
      });
    }
  }

  private handleClusteringModeChange(map: maplibregl.Map, mapState: ReturnType<typeof MapState.for>, settings: CommonMapSettings, isClustering: boolean): void {
    setLayerVisibility(map, ['overlay-points-individual-emoji'], isClustering ? 'none' : 'visible');
    const defaultState = mapState.getDefaultTrackState();
    const visibleTracks = mapState.getVisibleTracks();
    const embeddedTrackIndices = mapState.getEmbeddedTrackOverlayIndices();

    if (isClustering) {
      this.viewportTrackControllers.get(map)?.setClustering(true);

      for (const [placeId, trackState] of visibleTracks.entries()) {
        if (trackState.trackIndex === -1) {
          this.removeDynamicOverlayLayers(map, placeId);
        } else {
          this.removeTrackLayersById(map, trackState.trackIndex);
        }

        mapState.removeTrack(placeId);
      }

      for (const i of embeddedTrackIndices) {
        setLayerVisibility(map, [`geojson-overlay-${i}-line`, `geojson-overlay-${i}-line-hitarea`, `geojson-overlay-${i}-circle`, `geojson-overlay-${i}-circle-emoji`], 'none');
        mapState.setGeoJsonOverlayVisible(i, false);
      }
    } else {
      if (defaultState !== 'visible') {
        return;
      }

      for (const i of embeddedTrackIndices) {
        setLayerVisibility(map, [`geojson-overlay-${i}-line`, `geojson-overlay-${i}-line-hitarea`, `geojson-overlay-${i}-circle`, `geojson-overlay-${i}-circle-emoji`], 'visible');
        mapState.setGeoJsonOverlayVisible(i, true);
      }

      if (this.viewportTrackControllers.has(map)) {
        this.viewportTrackControllers.get(map)!.setClustering(false);

        return;
      }

      const placesWithTracks = mapState.getCurrentPlaces()
        .filter(p => hasTrackData(p) && !p.metadata?.frequency && !p.metadata?.boundsAnchor && Boolean(p.overlay));

      this.setupViewportTrackLoading(map, placesWithTracks, settings.trackVisibility, settings, mapState);
    }
  }

  private removeMapLayersAndSources(map: maplibregl.Map, layerIds: string[], sourceIds: string[]): void {
    if (sourceIds.includes('places-clustered')) this.clusterHitFeatures.delete(map);
    reportMapLibreCleanupIssues(removeLayersAndSources(map, layerIds, sourceIds), 'layer/source removal');
  }

  private removeDynamicOverlayLayers(map: maplibregl.Map, placeId: string): void {
    this.gradientControllers.get(map)?.get(placeId)?.abort();
    this.gradientControllers.get(map)?.delete(placeId);
    reportMapLibreCleanupIssues(removeDynamicOverlay(map, placeId), `dynamic overlay ${placeId}`);
    this.trackLineLayers.get(map)?.delete(`dynamic-overlay-${placeId}-hitarea`);
    this.trackLineLayers.get(map)?.delete(`dynamic-overlay-${placeId}-fill`);
  }

  private removeTrackLayersById(map: maplibregl.Map, trackIndex: number): void {
    reportMapLibreCleanupIssues(removeTrackLayers(map, trackIndex), `track ${trackIndex}`);
  }

  private setupViewportTrackLoading(
    map: maplibregl.Map, places: MapPlace[], visibility: TrackVisibilityResult, settings: CommonMapSettings,
    mapState: ReturnType<typeof MapState.for>, perf?: PerformanceMonitor, signatures?: ReadonlyMap<string, string>,
  ): void {
    this.viewportTrackCleanups.get(map)?.();

    if (this.developerMode && !perf) {
      perf = createPerformanceMonitor('viewport-tracks', { sourcePath: mapState.getCurrentRenderRequest()?.runtime.source.path });
    }

    const viewportBucketPrefix = 'viewport-trackLayers';
    const bucketLayerIds = new Map<string, { layerIds: string[]; sourceId: string }>();
    const bucketFilters = new Map<string, { base: maplibregl.FilterSpecification | undefined; key: string; hidden: boolean }>();
    const bucketData = new Map<string, ViewportTrackBucketData>();
    const renderedViewportPlaceIds = new Set<string>();
    const userHiddenPlaceIds = new Set<string>();

    for (const [placeId, visible] of this.trackUserVisibility.get(map) ?? []) {
      if (!visible) userHiddenPlaceIds.add(placeId);
    }

    let filterHiddenPlaceIds = new Set(this.symbolVisibilityHidden.get(map) ?? []);
    const hiddenPlaceIds = {
      has: (placeId: string) => userHiddenPlaceIds.has(placeId) || filterHiddenPlaceIds.has(placeId),
    };

    const removeViewportTrackBuckets = () => {
      this.renderProfiler.cancelTracks(map);

      for (const bucket of bucketLayerIds.values()) {
        this.removeMapLayersAndSources(map, bucket.layerIds, [bucket.sourceId]);
        this.trackLineLayers.get(map)?.delete(`${bucket.sourceId}-hitarea`);
      }

      bucketFilters.clear();
      bucketLayerIds.clear();
      bucketData.clear();

      for (const placeId of renderedViewportPlaceIds) {
        mapState.removeTrack(placeId);
      }

      renderedViewportPlaceIds.clear();
    };

    const prepareCandidates = (nextPlaces: MapPlace[], nextSignatures?: ReadonlyMap<string, string>) =>
      this.measureIf(perf, 'viewport-prepare-candidates', () => collectViewportTrackCandidates(nextPlaces).map(candidate => ({
          ...candidate, planSignature: nextSignatures?.get(candidate.placeId),
          renderData: undefined as ViewportTrackRenderData | undefined,
          rendered: false, pending: false,
          gradientController: undefined as AbortController | undefined,
          preparationFailed: false,
          cost: undefined as GeoJsonFootprint | undefined,
          features: undefined as GeoJSON.Feature[] | undefined,
      })), { tracks: nextPlaces.length, planSignatures: Boolean(nextSignatures) });
    let trackData = prepareCandidates(places, signatures);

    type Candidate = typeof trackData[number];
    const resident = new Map<string, Candidate>();
    let clustered = false;
    let gradientRefresh: number | undefined;
    let gradientRefreshDeadline: number | undefined;
    let gradientRefreshPending = false;
    const scheduleGradientRefresh = () => {
      if (!gradientRefreshPending || gradientRefresh !== undefined || disposed) return;

      if ([...bucketLayerIds.keys()].some(id => map.getSource(id) && !map.isSourceLoaded(id))) {
        gradientRefreshDeadline ??= window.setTimeout(() => {
          gradientRefreshDeadline = undefined;
          if (disposed || !gradientRefreshPending) return;
          gradientRefreshPending = false;
          updateVisibleTracksWithTiming('refresh');
        }, 1000);

        return;
      }

      window.clearTimeout(gradientRefreshDeadline);
      gradientRefreshDeadline = undefined;
      gradientRefresh = window.setTimeout(() => {
        gradientRefresh = undefined;
        gradientRefreshPending = false;
        if (!disposed) updateVisibleTracksWithTiming('refresh');
      }, 0);
    };
    const lease = trackResidencyBudget.open(ids => {
      for (const id of ids) {
        const data = resident.get(id);

        if (data) { data.cost = undefined; data.renderData = undefined; data.features = undefined; }
        resident.delete(id);
      }

      submitBuckets();
      reportResidency(ids.length);
    });
    const reportResidency = (evicted: number) => perf?.mark('viewport-residency', {
      map: lease.snapshot(), aggregate: trackResidencyBudget.snapshot(), evicted,
    });

    const submitBuckets = (started = performance.now()) => {
      const bucketPlaces = new Map<string, {
        tracks: Map<string, ViewportBucketTrack>;
        style: CompleteTrackStyle & { outline: boolean };
        zoom?: ZoomRange;
        preserveShortLines: boolean;
      }>();

      for (const data of resident.values()) {
        if (!data.renderData || !data.cost) continue;
        const { style, bucketKey, renderSignature, preserveShortLines } = data.renderData;
        let bucket = bucketPlaces.get(bucketKey);

        if (!bucket) {
          bucket = { tracks: new Map(), style, zoom: data.place.trackZoom, preserveShortLines };
          bucketPlaces.set(bucketKey, bucket);
        }

        bucket.tracks.set(data.placeId, { place: data.place, signature: renderSignature });
      }

      const activeBucketSourceIds = new Set<string>();
      const submittedSources: SubmittedTrackSource[] = [];

      this.measureIf(perf, 'viewport-update-trackLayer-buckets', () => {
        for (const [bucketKey, bucket] of bucketPlaces.entries()) {
          const sourceId = `${viewportBucketPrefix}-${hashString36(bucketKey)}`;

          activeBucketSourceIds.add(sourceId);
          let data = bucketData.get(sourceId);

          if (!data) bucketData.set(sourceId, data = new ViewportTrackBucketData(this.getProviderIntegration() === 'mapbox-gl', {
            stroke: bucket.style.color, 'stroke-width': bucket.style.weight, 'stroke-opacity': bucket.style.opacity,
            'outline-color': bucket.style.outlineColor, 'outline-width': bucket.style.outlineWeight, 'outline-opacity': bucket.style.outlineOpacity,
          }));

          const update = this.measureIf(perf, 'viewport-build-features', () => data.update(bucket.tracks, place => resident.get(getPlaceId(place))?.features ?? this.createViewportTrackFeatures(place, visibility, settings)), { sourceId, tracks: bucket.tracks.size });

          if (update) {
            const operation = update.initial ? 'add-source' : update.snapshot ? 'set-data' : 'update-data';
            const layerIds = this.measureIf(perf, 'viewport-submit-source', () => this.updateViewportTrackBucket(map, sourceId, update, bucket.style, bucket.zoom, settings.showLabels, bucket.preserveShortLines), { sourceId, operation });

            bucketLayerIds.set(sourceId, { layerIds, sourceId });
            if (this.developerMode) submittedSources.push({ sourceId, layerIds: [`${sourceId}-line`, `${sourceId}-line-points`, `${sourceId}-line-points-emoji`] });
            perf?.mark('viewport-bucket-submit', {
              sourceId, operation, tracks: bucket.tracks.size,
              addedFeatures: update.initial?.features.length ?? update.diff?.add?.length ?? 0,
              removedFeatures: update.diff?.remove?.length ?? 0,
            });
          }

          const blocked = [...bucket.tracks.keys()].filter(id => hiddenPlaceIds.has(id)).sort();
          const key = JSON.stringify(blocked);
          const allHidden = clustered || blocked.length === bucket.tracks.size;

          for (const layerId of bucketLayerIds.get(sourceId)?.layerIds ?? []) {
            if (!map.getLayer(layerId)) continue;
            let filter = bucketFilters.get(layerId);

            if (!filter) {
              filter = { base: map.getFilter(layerId) ?? undefined, key: '[]', hidden: false };
              bucketFilters.set(layerId, filter);
            }

            if (filter.hidden !== allHidden) {
              map.setLayoutProperty(layerId, 'visibility', allHidden ? 'none' : 'visible');
              filter.hidden = allHidden;
            }

            if (!allHidden && filter.key !== key) {
              const allowed: maplibregl.FilterSpecification = ['!', ['in', ['get', '_placeId'], ['literal', blocked]]];

              map.setFilter(layerId, (blocked.length ? filter.base ? ['all', filter.base, allowed] : allowed : filter.base ?? null) as maplibregl.FilterSpecification | null);
              filter.key = key;
            }
          }
        }

        for (const [sourceId, bucket] of Array.from(bucketLayerIds.entries())) {
          if (!activeBucketSourceIds.has(sourceId)) {
            this.removeMapLayersAndSources(map, bucket.layerIds, [bucket.sourceId]);
            bucketLayerIds.delete(sourceId);
            bucketData.delete(sourceId);
            this.trackLineLayers.get(map)?.delete(`${sourceId}-hitarea`);
            for (const id of bucket.layerIds) bucketFilters.delete(id);
          }
        }
      }, {
        buckets: bucketPlaces.size,
        bucketsWithData: bucketData.size,
        tracks: resident.size,
        zoom: map.getZoom(),
      }, { slowOnly: true });

      if (this.developerMode && perf && submittedSources.length) {
        this.renderProfiler.startTracks(map, perf, submittedSources, started);
      }

      for (const data of trackData) data.features = undefined;
    };

    const updateVisibleTracks = (force = false, clusteringOverride?: boolean) => {
      const started = performance.now();
      const wasClustered = clustered;

      clustered = clusteringOverride ?? mapState.getClusteringManager()?.isClustering() ?? false;
      const bounds = map.getBounds();
      const selection = this.measureIf(perf, 'viewport-select-tracks', () => selectViewportTracks(trackData, {
        minLng: bounds.getWest(), maxLng: bounds.getEast(), minLat: bounds.getSouth(), maxLat: bounds.getNorth(),
      }, {
        minimumMarginDegrees: 0.01, worldCopies: map.getRenderWorldCopies(),
        isHidden: id => clustered || hiddenPlaceIds.has(id), isActive: data => data.rendered || data.pending,
      }), { candidates: trackData.length });

      for (const data of selection.remove) {
        data.gradientController?.abort();
        data.gradientController = undefined;
        if (!data.cost) { data.features = undefined; resident.delete(data.placeId); }
        mapState.removeTrack(data.placeId);
        renderedViewportPlaceIds.delete(data.placeId);
        data.rendered = false;
        data.pending = false;
      }

      const removedCount = selection.remove.length;
      const dataToAdd = selection.add;
      const desiredIds = new Set(selection.desired.map(data => data.placeId));

      if (!force && !removedCount && !dataToAdd.length && wasClustered === clustered) return;
      for (const data of selection.desired) resident.set(data.placeId, data);
      this.measureIf(perf, 'viewport-prepare-residency', () => {
        for (const data of resident.values()) {
          const style = getStyleForPlace(visibility, data.placeId, data.place);
          const renderSignature = data.planSignature ?? getTrackRenderSignature(data.place, visibility);

          if (!data.cost || data.renderData?.renderSignature !== renderSignature) {
            if (!desiredIds.has(data.placeId)) continue;
            const colorBy = data.place.trackColorBy ?? settings.trackColorBy;

            if (!data.features && colorBy && colorBy !== 'none') {
              if (!data.gradientController && !data.preparationFailed) {
                const controller = data.gradientController = new AbortController();

                data.pending = true;
                const nextVisibility = visibility, nextSettings = settings;

                void prepareGradientColoredGeoJson(data.place, colorBy, settings.trackGradeWindow ?? DEFAULT_GRADE_WINDOW, settings.trackSpeedWindow, controller.signal)
                  .then(geojson => runCooperativeWork(this.createViewportTrackFeaturesWork(data.place, nextVisibility, nextSettings, geojson ?? data.place.overlay?.geojson), controller.signal))
                  .then(features => {
                    if (disposed || controller.signal.aborted || data.gradientController !== controller) return;
                    data.gradientController = undefined;
                    data.features = features;
                    gradientRefreshPending = true;
                    scheduleGradientRefresh();
                  }, error => {
                    if (controller.signal.aborted || disposed) return;
                    data.gradientController = undefined;
                    data.pending = false;
                    data.preparationFailed = true;
                    logger.scope('MapSurface').error('Track gradient preparation failed', error, { placeId: data.placeId });
                  });
              }

              continue;
            }

            data.features ??= this.createViewportTrackFeatures(data.place, visibility, settings);
            const size = geoJsonFootprint({ type: 'FeatureCollection', features: data.features });

            data.cost = { ...size, estimatedBytes: size.estimatedBytes * 2 };
          }

          const colorBy = data.place.trackColorBy ?? settings.trackColorBy;
          const preserveShortLines = Boolean(colorBy && colorBy !== 'none');

          data.renderData = { style, bucketKey: this.getViewportTrackBucketKey(style, data.place.trackZoom, preserveShortLines), renderSignature, preserveShortLines };
        }
      }, { tracks: resident.size });

      for (const data of selection.desired) {
        if (!data.cost || data.gradientController || data.preparationFailed) continue;
        data.rendered = true;
        data.pending = false;
        mapState.setTrack(data.placeId, { place: data.place, settings, trackIndex: -1, renderMode: 'viewport-batch', renderSignature: data.renderData!.renderSignature });
        renderedViewportPlaceIds.add(data.placeId);
      }

      const retained = lease.update([...resident.values()].filter(data => data.cost).map(data => ({ id: data.placeId, active: data.rendered || data.pending, ...data.cost! })));
      let evicted = 0;

      for (const [id, data] of resident) if (data.cost && !retained.has(id)) {
        data.cost = undefined; data.renderData = undefined; data.features = undefined;
        resident.delete(id); evicted++;
      }

      submitBuckets(started);
      reportResidency(evicted);

      const finalRendered = trackData.filter(d => d.rendered || d.pending).length;

      if (dataToAdd.length > 0 || removedCount > 0) {
        logger.scope('Places').info(`[Places] Viewport update: +${dataToAdd.length} -${removedCount} trackLayers (${finalRendered}/${trackData.length} visible)`);
      }
    };

    const updateVisibleTracksWithTiming = (event: 'initial' | 'moveend' | 'refresh', clusteringOverride?: boolean) => {
      const details = {
        event,
        zoom: map.getZoom(),
        previousVisibleTracks: mapState.getVisibleTracks().size,
        visibleTracks: mapState.getVisibleTracks().size,
        tracks: trackData.length,
      };

      this.measureIf(perf, 'viewport-trackLayer-update-total', () => {
        updateVisibleTracks(event === 'refresh', clusteringOverride);
        details.visibleTracks = mapState.getVisibleTracks().size;
      }, details);
    };

    const handleMoveEnd = () => updateVisibleTracksWithTiming('moveend');

    map.on('moveend', handleMoveEnd);
    map.on('sourcedata', scheduleGradientRefresh);
    map.on('error', scheduleGradientRefresh);
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      map.off('moveend', handleMoveEnd);
      map.off('sourcedata', scheduleGradientRefresh);
      map.off('error', scheduleGradientRefresh);
      map.off('remove', cleanup);
      for (const data of trackData) data.gradientController?.abort();
      window.clearTimeout(gradientRefresh);
      window.clearTimeout(gradientRefreshDeadline);
      lease.dispose();
      removeViewportTrackBuckets();
      resident.clear();
      this.viewportTrackControllers.delete(map);
      this.viewportTrackCleanups.delete(map);
    };

    this.viewportTrackCleanups.set(map, cleanup);
    map.on('remove', cleanup);

    let managedPlaceIds = new Set(trackData.map(data => getPlaceId(data.place)));

    this.viewportTrackControllers.set(map, {
      setClustering: active => updateVisibleTracksWithTiming('refresh', active),
      setPerformanceMonitor: nextPerf => { perf = nextPerf; },
      isManaged: placeId => managedPlaceIds.has(placeId),
      isHidden: placeId => hiddenPlaceIds.has(placeId),
      setHidden: (placeId, hidden) => {
        if (hidden) userHiddenPlaceIds.add(placeId);
        else userHiddenPlaceIds.delete(placeId);

        this.recordTrackUserVisibility(map, placeId, !hidden);
        updateVisibleTracksWithTiming('refresh');
      },
      setFilterHiddenIds: hiddenIds => {
        if (hiddenIds.size === filterHiddenPlaceIds.size && [...hiddenIds].every(id => filterHiddenPlaceIds.has(id))) return;
        filterHiddenPlaceIds = new Set(hiddenIds);
        updateVisibleTracksWithTiming('refresh');
      },
      replaceCandidates: (nextPlaces, nextVisibility, nextSettings, nextSignatures) => {
        visibility = nextVisibility;
        settings = nextSettings;
        filterHiddenPlaceIds = new Set(this.symbolVisibilityHidden.get(map) ?? []);
        const previous = new Map(trackData.map(data => [getPlaceId(data.place), data]));

        for (const data of previous.values()) data.gradientController?.abort();
        const next = prepareCandidates(nextPlaces, nextSignatures);
        const nextIds = new Set(next.map(candidate => candidate.placeId));
        let removed = 0;

        for (const [placeId, data] of previous) {
          if (nextIds.has(placeId) || !(data.rendered || data.pending)) continue;
          mapState.removeTrack(placeId);
          renderedViewportPlaceIds.delete(placeId);
          removed++;
        }

        trackData = next.map(candidate => {
          const before = previous.get(candidate.placeId);

          return { ...candidate, rendered: before?.rendered ?? false, cost: before?.cost, renderData: before?.renderData };
        });
        const replacements = new Map(trackData.map(data => [data.placeId, data]));

        for (const id of resident.keys()) {
          const replacement = replacements.get(id);

          if (replacement) resident.set(id, replacement);
          else resident.delete(id);
        }

        managedPlaceIds = new Set(nextIds);
        logger.scope('Places').debug('[Places] Viewport tracks replaced', { previous: previous.size, next: next.length, removed });
        updateVisibleTracksWithTiming('refresh');
      },
    });

    try {
      updateVisibleTracksWithTiming('initial');
    } catch (error) {
      cleanup();

      throw error;
    }
  }

  protected showTrackAndFitBounds(map: maplibregl.Map, place: MapPlace, coloringType?: TrackColorBy, gradeWindow?: MetricWindow): void {
    const effectiveColorBy = coloringType ?? place.trackColorBy;

    this.showGeoJsonOverlayAndFitBounds(map, place, undefined, undefined, effectiveColorBy, gradeWindow ?? DEFAULT_GRADE_WINDOW);
  }

  protected showMultipleTracks(map: maplibregl.Map, places: MapPlace[], settings: CommonMapSettings): void {
    const mapState = MapState.for(map);

    places.forEach((place) => {
      if (!place.overlay?.geojson) return;

      const trackIndex = mapState.getNextTrackIndex();
      const placeId = getPlaceId(place);

      mapState.setTrack(placeId, { place, settings, trackIndex, renderSignature: getTrackRenderSignature(place, settings.trackVisibility) });

      this.addFrequencyOverlayLayer(map, place, trackIndex);
    });
  }

  private addFrequencyOverlayLayer(map: maplibregl.Map, place: MapPlace, trackIndex: number): void {
    const sourceId = `overlay-${trackIndex}-frequency`;
    const layerId = `overlay-${trackIndex}-frequency-line`;

    const geojson = place.overlay!.geojson;

    const dataWithMetadata: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => ({
        ...feature,
        properties: {
          ...feature.properties,
          frequency: place.metadata?.frequency || 0,
          contributingFiles: place.metadata?.contributingFiles || []
        }
      }))
    };

    map.addSource(sourceId, {
      type: 'geojson',
      data: dataWithMetadata
    });

    const overlayStyle = place.overlay?.style;
    const featureProps: Record<string, unknown> | null | undefined = geojson.features[0]?.properties;
    const appearance = getStyleForPlace(undefined, getPlaceId(place), place);

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': overlayStyle?.color ?? asStyleText(featureProps?.stroke) ?? TRACK_STYLE_DEFAULTS.color,
        'line-width': overlayStyle?.weight ?? asStyleNumber(featureProps?.['stroke-width']) ?? TRACK_STYLE_DEFAULTS.weight,
        'line-opacity': overlayStyle?.opacity ?? asStyleNumber(featureProps?.['stroke-opacity']) ?? TRACK_STYLE_DEFAULTS.opacity,
        ...(appearance.dashArray.length ? { 'line-dasharray': appearance.dashArray } : {})
      }
    });

    map.on('click', layerId, (e: maplibregl.MapLayerMouseEvent) => {
      if (!e.features || e.features.length === 0) return;

      const allLayers = map.getStyle()?.layers || [];
      const frequencyLayerIds = allLayers
        .filter(layer => layer.id.endsWith('-frequency-line'))
        .map(layer => layer.id);

      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 5, e.point.y - 5],
        [e.point.x + 5, e.point.y + 5]
      ];
      const allFeatures = map.queryRenderedFeatures(bbox, { layers: frequencyLayerIds });

      const allContributingFiles = new Set<string>();
      let totalFrequency = 0;

      for (const feature of allFeatures) {
        const featureFrequency = Number(feature.properties?.frequency) || 0;

        totalFrequency += featureFrequency;

        const files = parseContributingFiles(feature.properties?.contributingFiles);

        for (const file of files) {
          allContributingFiles.add(file);
        }
      }

      e.preventDefault();

      const displayFrequency = allContributingFiles.size > 0 ? allContributingFiles.size : totalFrequency;

      MapLibreHelper.createFrequencyPopup(map, e.lngLat, displayFrequency, Array.from(allContributingFiles), this.app);
    });

    MapLibreHelper.addPointerCursor(map, layerId);
  }

  protected showTrack(map: maplibregl.Map, place: MapPlace): void {
    MapLibreHelper.clearExistingTracks(map);
    this.clearTrackLayers(map, 0);

    if (place.overlay?.geojson) {
      this.showTrackForPlace(map, place);
    }
  }

  private extendBoundsWithOverlays(boundingBox: PlacesBoundingBox, overlays: MapRenderRequest['runtime']['overlays'], debug: boolean): void {
    const result = extendBoundingBoxWithOverlays(boundingBox, overlays);

    if (debug) {
      logger.scope('Places').debug('[Places Bounds] Processed overlays:', result.overlays.length, 'bounds:', boundingBox.getLngLatBounds());
    }
  }

  protected getMapOptions(_blockSettings: ResolvedMapConfig): Record<string, unknown> {
    return {
      cancelPendingTileRequestsWhileZooming: true,
      fadeDuration: 0,
      maxTileCacheSize: 256,
      maxTileCacheZoomLevels: 8,
      refreshExpiredTiles: false,
    };
  }

  private sanitizeMapError(error: unknown): string {
    const message = getErrorMessage(error ?? '');

    return message.replace(
      /([?&](?:apiKey|apikey|api_key|access_token|token)=)[^&\s)]+/gi,
      '$1[REDACTED]'
    );
  }

  private setupContextMenu(map: maplibregl.Map, mapContainerElement: HTMLElement, request: MapRenderRequest, places: MapPlace[]): void {
    setupVectorContextMenu({
      app: this.app,
      map,
      container: mapContainerElement,
      getRuntime: () => MapState.for(map).getCurrentRenderRequest()?.runtime ?? request.runtime,
      places,
      developerMode: this.developerMode,
      providerName: this.getProviderClassName(),
      getCurrentPlaces: () => this.getCurrentPlaces(mapContainerElement) ?? undefined,
      includeDirectionsRouteActions: true,
    });
  }

  protected async processOverlays(map: maplibregl.Map, _mapContainer: HTMLElement, request: MapRenderRequest): Promise<void> {
    const unifiedClustering = request.runtime.unifiedClusteringActive;

    const clusteringConfig = unifiedClustering
      ? { enabled: true, threshold: 0, unifiedClustering: true }
      : undefined;

    await this.overlayHandler.processOverlays(map, request.runtime.overlays, request.config.showLabels, clusteringConfig, request.runtime.source.path);
    recordOverlayVisibility({
      map,
      runtime: request.runtime,
      setLayerVisibility: (layerIds, visibility) => setLayerVisibility(map, layerIds, visibility),
    });
    this.restorePointAnnotationCollisionOrder(map);
  }

  getCurrentPlaces(container: HTMLElement): MapPlace[] | null {
    const mapInstance = this.getMapInstance(container);

    if (!mapInstance) return null;
    const places = MapState.for(mapInstance).getCurrentPlaces();

    return places.length > 0 ? places : null;
  }

  getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities> {
    return {
      places: true,
      overlays: true,
      styles: false,
      tools: true,
      clustering: true,
      terrain: false,
    };
  }

  async updateMapData(container: HTMLElement, newPlaces: MapPlace[], request: MapRenderRequest, context?: MapDataUpdateContext): Promise<MapDataUpdateResult> {
    const perf = createPerformanceMonitor('maplibre-update', {
      provider: this.getProviderClassName(), source: request.runtime.source.path,
      places: newPlaces.length, overlays: request.runtime.overlays.length,
      trackDefaultVisibility: request.config.trackDefaultVisibility,
    }, { enabled: this.developerMode });
    const result = await perf.measureAsync('provider-update-total', () => this.performMapDataUpdate(container, newPlaces, request, perf, context));

    if (result.updated === false && result.status === 'requires-rebuild') {
      this.persistViewport(container, request.runtime.source);
    }

    return result;
  }

  private persistViewport(container: HTMLElement, source: MapRenderRequest['runtime']['source']): void {
    const map = this.getMapInstance(container);

    if (map) persistMapViewport(map, source);
  }

  private async performMapDataUpdate(container: HTMLElement, newPlaces: MapPlace[], request: MapRenderRequest, perf: PerformanceMonitor, context?: MapDataUpdateContext): Promise<MapDataUpdateResult> {
    const blockSettings = request.config;
    const runtime = request.runtime;
    const ineligibleReason = this.getMapDataUpdateIneligibleReason(blockSettings);

    if (ineligibleReason) return this.declineUpdate(ineligibleReason, perf);

    const mapInstance = this.getMapInstance(container);

    if (!mapInstance) {
      return this.declineUpdate('no map instance found', perf);
    }

    const mapState = MapState.for(mapInstance);

    this.viewportTrackControllers.get(mapInstance)?.setPerformanceMonitor(perf);
    await mapState.whenOverlaysReady();
    let updateProfileStarted = false;
    const profileUpdate = (details: Record<string, unknown> = {}): void => {
      if (updateProfileStarted) return;
      updateProfileStarted = true;
      this.profileNextRenderAndIdle(mapInstance, perf, 'update', details);
    };
    const markerMap = mapState.getPlaceMarkers();
    const settings = mapState.getCurrentSettings();
    const previousBlockSettings = mapState.getCurrentBlockSettings();
    const previousRequest = mapState.getCurrentRenderRequest();

    if (previousBlockSettings && JSON.stringify(previousBlockSettings.tools) !== JSON.stringify(blockSettings.tools)) {
      const result = this.syncMapTools(mapInstance, container, request);

      if (!result.updated) return result;
    }

    if (previousBlockSettings && previousBlockSettings.showLabels !== blockSettings.showLabels) {
      return this.declineUpdate('showLabels changed', perf);
    }

    if (previousBlockSettings && previousBlockSettings.showCurrentDevicePosition !== blockSettings.showCurrentDevicePosition) {
      return this.declineUpdate('showCurrentDevicePosition changed', perf);
    }

    if (previousBlockSettings && previousBlockSettings.trackDirectionArrows !== blockSettings.trackDirectionArrows) {
      return this.declineUpdate('trackDirectionArrows changed', perf);
    }

    if (previousBlockSettings && JSON.stringify(previousBlockSettings.trackBuilder) !== JSON.stringify(blockSettings.trackBuilder)) {
      return this.declineUpdate('trackBuilder changed', perf);
    }

    if (previousBlockSettings && usesNativeMarkerRenderer(previousBlockSettings) !== usesNativeMarkerRenderer(blockSettings)) {
      return this.declineUpdate('marker renderer config changed', perf);
    }

    if (settings) Object.assign(settings, this.extractCommonSettings(blockSettings, runtime));
    const overlayClusteringConfig = runtime.unifiedClusteringActive
      ? { enabled: true, threshold: 0, unifiedClustering: true }
      : undefined;

    if (hasOverlayRenderableChanges(context?.planDiff)) {
      profileUpdate();
      await perf.measureAsync('sync-overlays', () => this.overlayHandler.syncOverlays(mapInstance, previousRequest?.runtime.overlays ?? [], runtime.overlays, blockSettings.showLabels, overlayClusteringConfig, runtime.source.path));
      this.restorePointAnnotationCollisionOrder(mapInstance);
    }

    this.refreshDebugOverlayData(newPlaces, runtime.overlays);

    if (hasTrackRenderableChanges(context?.planDiff)) {
      const trackSettings = this.extractCommonSettings(blockSettings, runtime);
      const visibility = trackSettings.trackVisibility;

      mapState.setDefaultTrackState(visibility?.shouldShowByDefault ? 'visible' : 'hidden');
      const showsByDefault = Boolean(visibility?.hasAnyVisibleTracks) && !visibility?.isSingleTrackView;
      const viewportController = this.viewportTrackControllers.get(mapInstance);

      if (viewportController || showsByDefault) {
        profileUpdate();
        const placesWithTracks = (visibility?.placeStates ?? [])
          .filter(state => state.showOnLoad && hasTrackData(state.place) && !isNonInteractivePlace(state.place) && Boolean(state.place.overlay))
          .map(state => state.place);
        const trackSignatures = context?.nextPlan ? new Map(context.nextPlan.renderables
          .filter(renderable => renderable.kind === 'note-track')
          .map(renderable => [renderable.id.slice('note-track:'.length), renderable.signature])) : undefined;

        perf.measure('resync-viewport-tracks', () => {
          if (viewportController) viewportController.replaceCandidates(placesWithTracks, trackSettings.trackVisibility, trackSettings, trackSignatures);
          else this.setupViewportTrackLoading(mapInstance, placesWithTracks, trackSettings.trackVisibility, trackSettings, mapState, perf, trackSignatures);
        }, {
          tracks: placesWithTracks.length,
          incremental: Boolean(viewportController),
        });
      } else {
        profileUpdate();
        perf.measure('sync-visible-tracks', () => this.syncVisibleTrackOverlays(mapInstance, mapState, trackSettings), {
          currentVisibleTracks: mapState.getVisibleTracks().size,
        });
      }
    }

    if (usesNativeMarkerRenderer(previousBlockSettings ?? blockSettings)) {
      if (!settings) {
        return this.declineUpdate('missing marker tracking data', perf);
      }

      perf.measure('reconcile-clustering', () => this.reconcileSymbolClustering(mapInstance, mapState, settings, blockSettings, newPlaces, runtime));
      const symbolUpdateProfile: Record<string, unknown> = {
        previousPlaces: mapState.getCurrentPlaces().length,
        nextPlaces: newPlaces.length,
      };
      const unchangedPlaces = !hasRenderableChanges(context?.planDiff, renderable =>
        renderable.kind === 'marker' || renderable.kind === 'label' || renderable.kind === 'note-track');
      const unchangedClustering = previousBlockSettings?.clusterGeoJsonOverlays === blockSettings.clusterGeoJsonOverlays
        && previousRequest?.runtime.unifiedClusteringActive === runtime.unifiedClusteringActive;
      const overlayPointsChanged = hasOverlayRenderableChanges(context?.planDiff) && blockSettings.clusterGeoJsonOverlays
        && stableSignature(extractOverlayPointFeaturesFromOverlays(previousRequest?.runtime.overlays ?? []))
          !== stableSignature(extractOverlayPointFeaturesFromOverlays(runtime.overlays));

      if (previousRequest && unchangedPlaces && unchangedClustering && !overlayPointsChanged) {
        perf.mark('symbol-source-unchanged', symbolUpdateProfile);
      } else {
        profileUpdate(symbolUpdateProfile);
        perf.measure(
          'symbol-source-update',
          () => this.refreshSymbolLayerData(mapInstance, newPlaces, settings, request, symbolUpdateProfile),
          symbolUpdateProfile,
        );
      }

      mapState.setCurrentPlaces(newPlaces);
      mapState.setCurrentSettings(settings);
      mapState.setCurrentBlockSettings(blockSettings);
      mapState.setCurrentRenderRequest(request);
      perf.mark('symbol-update-complete', { places: newPlaces.length });

      return { updated: true };
    }

    if (context?.previousPlan && context.nextPlan && context.previousPlan.clusteringEnabled !== context.nextPlan.clusteringEnabled) {
      return this.declineUpdate('clustering changed', perf);
    }

    if (context?.previousPlan && context.nextPlan && context.previousPlan.config.clusterStyle !== context.nextPlan.config.clusterStyle) {
      return this.declineUpdate('cluster style changed', perf);
    }

    const clusteringManager = mapState.getClusteringManager();

    if (clusteringManager) {
      try {
        profileUpdate();
        this.updateClusteredMarkersIncrementally(mapInstance, clusteringManager, mapState, newPlaces, settings, request);
        mapState.setCurrentBlockSettings(blockSettings);
        mapState.setCurrentRenderRequest(request);
        perf.mark('clustered-update-complete', {
          markers: mapState.getPlaceMarkers().size,
          visibleTracks: mapState.getVisibleTracks().size,
        });

        return Promise.resolve({ updated: true });
      } catch (error) {
        logger.scope('Places').debug('[Places Incremental] Clustered source update failed:', error);

        return Promise.resolve({ updated: false, status: 'requires-rebuild', reason: 'clustered source update failed' });
      }
    }

    if (!settings) {
      return this.declineUpdate('missing marker tracking data', perf);
    }

    const nextMarkerSignatures = context?.nextPlan
      ? new Map(context.nextPlan.renderables
        .filter(renderable => renderable.kind === 'marker')
        .map(renderable => [renderable.id.slice('marker:'.length), renderable.signature]))
      : undefined;
    const diff = computePlaceMarkerDiff({
      currentMarkers: markerMap,
      nextPlaces: newPlaces,
      getStoredMarkerSignature: (_marker, identity) => mapState.getPlaceMarkerRenderSignature(identity),
      getNextMarkerSignature: (_place, identity) => nextMarkerSignatures?.get(identity),
    });

    if (!hasPlaceMarkerDiffChanges(diff)) {
      logger.scope('Places').debug('[Places Incremental] No marker changes needed');
      mapState.setCurrentPlaces(newPlaces);
      mapState.setCurrentSettings(settings);
      mapState.setCurrentBlockSettings(blockSettings);
      mapState.setCurrentRenderRequest(request);
      perf.mark('no-marker-changes', {
        markers: markerMap.size,
        visibleTracks: mapState.getVisibleTracks().size,
      });

      return { updated: true };
    }

    logger.scope('Places').debug('[Places Incremental] Updating markers', { removeCount: diff.removedIds.length, addCount: diff.added.length, updateCount: diff.updated.length });
    profileUpdate();

    const createMarkerForPlace = (place: MapPlace, markerSignature: string): void => {
      const iconStyle = place?.iconStyle;
      const isHidden = iconStyle?.opacity === 0 ||
        iconStyle?.inlineCss?.toLowerCase().includes('display: none');

      if (!isHidden) {
        const feature: GeoJSON.Feature = {
          type: 'Feature',
          properties: {
            description: place.name || '',
            file_path: place.filePath || '',
            icon: place.icon || '',
            mapPlace: JSON.stringify(place)
          },
          geometry: {
            type: 'Point',
            coordinates: [place.longitude, place.latitude]
          }
        };

        const marker = this.createIconMarkerWithReturn(mapInstance, feature, settings);
        const identity = getPlaceId(place);

        mapState.setPlaceMarkerWithSignature(identity, marker, markerSignature);
      }
    };

    perf.measure('apply-marker-diff', () => applyPlaceMarkerDiff({
      diff,
      getStored: identity => markerMap.get(identity),
      removeStored: identity => {
        const marker = mapState.deletePlaceMarkerWithSignature(identity);

        marker?.remove();
      },
      createStored: ({ place, markerSignature }) => {
        createMarkerForPlace(place, markerSignature);

        return markerMap.get(getPlaceId(place));
      }
    }), { removeCount: diff.removedIds.length, addCount: diff.added.length, updateCount: diff.updated.length });

    if (settings.showLabels) {
      perf.measure('update-text-label-layer', () => this.updateTextLabelLayer(mapInstance, newPlaces));
    }

    mapState.setCurrentPlaces(newPlaces);
    mapState.setCurrentSettings(settings);
    mapState.setCurrentBlockSettings(blockSettings);
    mapState.setCurrentRenderRequest(request);

    perf.mark('complete', {
      markers: mapState.getPlaceMarkers().size,
      visibleTracks: mapState.getVisibleTracks().size,
    });

    return { updated: true };
  }

  applyCamera(container: HTMLElement, camera: MapCameraIntent, request: MapRenderRequest): MapCameraApplyResult {
    const map = this.getMapInstance(container);

    if (!map) return { applied: false, reason: 'no map instance found' };

    return applyCameraIntent(map, camera, request);
  }

  applyMarkerVisibility(container: HTMLElement, hiddenPlaceIds: readonly string[]): void {
    const map = this.getMapInstance(container);

    if (!map) return;
    this.symbolVisibilityHidden.set(map, hiddenPlaceIds);
    const deny = markerVisibilityDenyExpression(hiddenPlaceIds);

    if (map.getLayer(SYMBOL_MARKER_LAYER_ID)) map.setFilter(SYMBOL_MARKER_LAYER_ID, symbolIconFilter(deny, false));
    if (map.getLayer(SYMBOL_BENEATH_LAYER_ID)) map.setFilter(SYMBOL_BENEATH_LAYER_ID, symbolIconFilter(deny, true));
    if (map.getLayer('places-markers')) map.setFilter('places-markers', symbolLabelFilter(deny));
    this.applyClusteredData(map);
    this.applyTrackFilterVisibility(map);
  }

  private applyTrackFilterVisibility(map: maplibregl.Map): void {
    const hidden = new Set(this.symbolVisibilityHidden.get(map) ?? []);
    const mapState = MapState.for(map);
    const controller = this.viewportTrackControllers.get(map);

    controller?.setFilterHiddenIds(hidden);

    for (const place of mapState.getCurrentPlaces()) {
      if (!hasTrackData(place)) continue;
      const placeId = getPlaceId(place);
      const filtered = hidden.has(placeId);

      if (controller?.isManaged(placeId)) continue;

      const overlayIndex = place.filePath ? mapState.getOverlayIndexForPlace(place.filePath) : undefined;

      if (overlayIndex !== undefined) {
        const sourceId = `geojson-overlay-${overlayIndex}`;
        const lineLayerId = `${sourceId}-line`;

        if (!map.getLayer(lineLayerId)) continue;
        const visible = !filtered && mapState.isGeoJsonOverlayVisible(overlayIndex);

        setLayerVisibility(map, [`${sourceId}-fill`, `${sourceId}-fill-outline`, lineLayerId, `${lineLayerId}-outline`, `${lineLayerId}-route-label`, `${lineLayerId}-direction`, `${lineLayerId}-endpoints`, `${lineLayerId}-hitarea`, `geojson-overlay-${overlayIndex}-circle`, `geojson-overlay-${overlayIndex}-circle-emoji`], visible ? 'visible' : 'none');
        continue;
      }

      const sourceId = `dynamic-overlay-${placeId}`;
      const lineLayerId = `${sourceId}-line`;

      if (!map.getLayer(lineLayerId)) continue;
      const userVisible = this.trackUserVisibility.get(map)?.get(placeId) ?? true;

      this.setDynamicOverlayVisibility(map, placeId, !filtered && userVisible);
    }
  }

  private recordTrackUserVisibility(map: maplibregl.Map, placeId: string, visible: boolean): void {
    let overrides = this.trackUserVisibility.get(map);

    if (!overrides) this.trackUserVisibility.set(map, overrides = new Map<string, boolean>());
    overrides.set(placeId, visible);
  }

  private setDynamicOverlayVisibility(map: maplibregl.Map, placeId: string, visible: boolean): void {
    const sourceId = `dynamic-overlay-${placeId}`;
    const lineLayerId = `${sourceId}-line`;

    setLayerVisibility(map, [`${sourceId}-fill`, `${sourceId}-fill-outline`, lineLayerId, `${lineLayerId}-outline`, `${lineLayerId}-route-label`, `${lineLayerId}-direction`, `${lineLayerId}-endpoints`, `${sourceId}-hitarea`, `${lineLayerId}-points`, `${lineLayerId}-points-emoji`, `${lineLayerId}-points-label`], visible ? 'visible' : 'none');
  }

  private applyClusteredData(map: maplibregl.Map): void {
    const data = this.symbolClusterData.get(map);
    const clusteredSource = map.getSource<maplibregl.GeoJSONSource>('places-clustered');

    if (!data || !clusteredSource) return;
    const hidden = new Set(this.symbolVisibilityHidden.get(map) ?? []);
    const visibleFeatures = hidden.size === 0 ? data.features : data.features.filter(feature => !hidden.has(String(feature.properties?.placeId)));
    const visiblePlaces = hidden.size === 0 ? data.renderedPlaces : data.renderedPlaces.filter(place => !hidden.has(getPlaceId(place)));

    ensureWaypointIconImages(map, { type: 'FeatureCollection', features: data.overlayPointFeatures });
    this.feedSource(map, clusteredSource, 'places-clustered', [...visibleFeatures, ...data.overlayPointFeatures]);
    void map.getSource<maplibregl.GeoJSONSource>('overlay-points-unclustered')?.setData({ type: 'FeatureCollection', features: data.overlayPointFeatures });
    MapState.for(map).getClusteringManager()?.updatePlaces(visiblePlaces, data.overlayPointFeatures.map(feature => {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;

      return { longitude: coords[0], latitude: coords[1] };
    }));
  }

  private syncVisibleTrackOverlays(map: maplibregl.Map, mapState: MapState, nextSettings: CommonMapSettings): void {
    const nextVisibility = nextSettings.trackVisibility;

    if (!nextVisibility) return;
    const userVisibility = this.trackUserVisibility.get(map);

    syncVisibleTrackEntries(mapState.getVisibleTracks(), nextVisibility, nextSettings, {
      isVisible: state => userVisibility?.get(state.placeId) ?? state.showOnLoad,
      remove: (placeId, trackState) => {
        if (trackState.trackIndex === -1) {
          this.removeDynamicOverlayLayers(map, placeId);
        } else {
          this.removeTrackLayersById(map, trackState.trackIndex);
        }

        mapState.removeTrack(placeId);
      },
      add: state => this.showTrackForPlace(map, state.place, nextVisibility, nextSettings),
    });
  }

  private updateClusteredMarkersIncrementally(map: maplibregl.Map, clusteringManager: ViewportClusteringManager<maplibregl.Marker>, mapState: MapState, newPlaces: MapPlace[], settings: CommonMapSettings | null, request: MapRenderRequest): void {
    this.sourceFeeds.get(map)?.delete('places-clustered');
    this.sourceFeeds.get(map)?.delete('places-labels');
    updateClusteredMarkers(map, clusteringManager, mapState, newPlaces, settings, request);
  }

  private updateTextLabelLayer(map: maplibregl.Map, places: MapPlace[]): void {
    this.sourceFeeds.get(map)?.delete('places-labels');
    updateTextLabelSource(map, places);
  }

  setGeocodingSearchMarkers(places: MapPlace[], container: HTMLElement): void {
    const mapInstance = this.getMapInstance(container);

    if (!mapInstance) return;

    setSearchResultMarkers({
      container,
      places,
      focus: { enter: () => enterVectorFocusMode(container, mapInstance), clear: () => clearVectorFocusMode(container, mapInstance) },
      createMarker: (place, element) => new (getGl().Marker)({ element, anchor: 'center' })
        .setLngLat([place.longitude, place.latitude])
        .addTo(mapInstance),
      onMarkerClick: (place) => {
        createContentPopup({
          map: mapInstance,
          coordinates: [place.longitude, place.latitude] as [number, number],
          content: buildGeocodingSearchPopupContent(place, MapState.for(mapInstance).getCurrentSettings()?.onPlaceAction ?? undefined, () => closeExistingPopups('.maplibregl-popup, .mapboxgl-popup')),
          popupSelector: '.maplibregl-popup, .mapboxgl-popup',
          createPopup: () => MapLibreHelper.createBasicPopup({
            offset: 18,
            className: 'places-popup',
            closeOnClick: true,
            closeOnMove: false,
            focusAfterOpen: false
          }),
        });
      }
    });
  }

  cleanup(): void {
  }
}

function collectDebugTilesets(overlays: readonly Overlay[]): DebugTilesetSummary[] {
  const byUrl = new Map<string, DebugTilesetSummary>();

  for (const overlay of overlays) {
    if (overlay.type !== 'vector-tile') continue;
    const url = (overlay as { url?: string }).url;

    if (!url || byUrl.has(url)) continue;
    const layers = MapLibreOverlayHandler.getResolvedVectorLayers(url);

    if (!layers?.length) continue;
    byUrl.set(url, { url, layers: layers.map(layer => ({ id: layer.id, fields: layer.fields })) });
  }

  return [...byUrl.values()];
}
