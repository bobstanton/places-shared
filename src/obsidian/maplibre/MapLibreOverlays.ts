import { App } from 'obsidian';
import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { mergeMapLibreCleanupResults, reportMapLibreCleanupIssues, type MapLibreCleanupResult } from '../../maplibre/MapLibreResourceRegistry';
import { removeLayersAndSources } from '../../maplibre/MapLibreTrackRenderer';
import { TRACK_STYLE_DEFAULTS, parseDashArray } from "../../track/index";
import { isPmtilesUrl, createTileJsonResolver, createVectorTileOverlaySourceId, createVectorTileSourceSpec, isGeoJSONOverlay, isImageOverlay, isVectorTileOverlay, resolveOverlayRenderBand, zoomScaledNumberToExpression, type OverlayRenderBand, type OverlayRenderStyle, type VectorTileLayerType } from "../../overlay/index";
import { buildGeoJsonFeaturePopupContent, buildPopupContent, getGeoJsonGeometryIcon, createSourceLinkClickHandler, createWaypointEmojiLayerConfig, createWaypointLayerConfig, ensureWaypointMarkerImage, shouldClusterCount, type ZoomRange, toGlMaxZoom } from "../../map/index";
import { renderFeaturePopupContentAsync } from "../map/index";
import type { Overlay, ResolvedTileJson, TileJsonVectorLayer } from "../../overlay/index";
import type { PopupContentConfig } from "../../settings/index";
import { getErrorMessage, hashString36, logger, loggedRequestUrl as requestUrl, redactUrl, renderMapSupplementalError } from "../../utils/index";
import { openLocalFile } from "../utils/index";
import { resolveStyleTextFont, MapLibreHelper } from './MapLibreHelper';
import { createGeoJsonOverlayLayerIds, createGeoJsonOverlaySourceId, createImageOverlayLayerId, createImageOverlaySourceId, createVectorTileOverlayLayerId, getImageOverlayOpacity } from '../../maplibre/OverlayRendering';
import { createRouteEndpointLabelLayerConfig, createRouteLabelLayerConfig } from "../../map/index";
import { MapState } from '../../maplibre/MapState';
import { getRenderBandBeforeId } from '../../maplibre/MapLibreLayerOrdering';
import { ensureWaypointIconImages } from './WaypointIconImages';
import { registerOverlayTileProvider } from '../../maplibre/OverlayTileProviders';

export interface GeoJSONOverlayConfig {
  index?: number;
  geojson: GeoJSON.GeoJSON;
  source?: string;
  zoom?: ZoomRange;
  style?: OverlayRenderStyle;
  hoverStyle?: OverlayRenderStyle;
  popup?: PopupContentConfig;
  popupSourcePath?: string;
  renderBand: OverlayRenderBand;
}

export interface ImageOverlayConfig {
  index?: number;
  url: string;
  bounds?: { north: number; south: number; east: number; west: number };
  corners?: {
    nwLng: number; nwLat: number;
    neLng: number; neLat: number;
    seLng: number; seLat: number;
    swLng: number; swLat: number;
  };
  opacity?: number;
  sourcePath?: string;
  zoom?: ZoomRange;
  renderBand: OverlayRenderBand;
}

export interface VectorTileOverlayConfig {
  index?: number;
  source: string;
  url?: string;
  tiles?: string[];
  sourceLayer: string;
  layerType: VectorTileLayerType;
  zoom?: ZoomRange;
  bounds?: [number, number, number, number];
  attribution?: string;
  filter?: unknown[];
  textField?: string;
  symbolPlacement?: 'point' | 'line' | 'line-center';
  sprite?: string;
  icon?: string;
  style?: OverlayRenderStyle;
  hoverStyle?: OverlayRenderStyle;
  popup?: PopupContentConfig;
  popupSourcePath?: string;
  hitLabel?: string;
  tileZoom?: ZoomRange;
  tileProvider?: string;
  renderBand: OverlayRenderBand;
}

export interface VectorFeatureHitLayer {
  readonly popup: PopupContentConfig;
  readonly popupSourcePath?: string;
  readonly label: string;
  readonly textField?: string;
}

export interface MapLibreOverlayHandlerOptions {
  isInteractionEnabled?: () => boolean;
  registerPmtilesArchive?: (url: string) => void | Promise<void>;
  onFeatureHitLayer?: (map: maplibregl.Map, layerId: string) => void;
}

export interface OverlayClusteringConfig {
  enabled: boolean;
  threshold: number;
  unifiedClustering?: boolean;
}

export class MapLibreOverlayHandler {
  private app: App;
  private isInteractionEnabled?: () => boolean;
  private registerPmtilesArchive?: (url: string) => void | Promise<void>;
  private onFeatureHitLayer?: (map: maplibregl.Map, layerId: string) => void;
  private readonly featureHitLayers = new WeakMap<maplibregl.Map, Map<string, VectorFeatureHitLayer>>();
  private readonly hoverListeners = new WeakMap<maplibregl.Map, Map<string, {
    move: (event: maplibregl.MapLayerMouseEvent) => void;
    leave: () => void;
  }>>();

  constructor(app: App, options: MapLibreOverlayHandlerOptions = {}) {
    this.app = app;
    this.isInteractionEnabled = options.isInteractionEnabled;
    this.registerPmtilesArchive = options.registerPmtilesArchive;
    this.onFeatureHitLayer = options.onFeatureHitLayer;
  }

  getVectorFeatureHitLayers(map: maplibregl.Map): ReadonlyMap<string, VectorFeatureHitLayer> {
    return this.featureHitLayers.get(map) ?? new Map();
  }

  buildVectorFeaturePopupContent(map: maplibregl.Map, feature: GeoJSON.Feature, layer: VectorFeatureHitLayer, label: string, onRendered: () => void): HTMLElement {
    const geometryType = feature.geometry?.type || 'Feature';
    const content = buildPopupContent({ icon: getGeoJsonGeometryIcon(geometryType), name: label, isLink: false });

    renderFeaturePopupContentAsync(this.app, {
      kind: 'feature',
      feature,
      presentation: 'feature',
      markdownSourcePath: layer.popupSourcePath,
    }, layer.popup, content, {
      markdownSourcePath: layer.popupSourcePath,
      popupRenderers: MapState.for(map).getCurrentRenderRequest()?.runtime.popupRenderers,
      onRendered,
    });

    return content;
  }

  async processOverlays(map: maplibregl.Map, overlays: readonly Overlay[], showLabels: boolean, clusteringConfig?: OverlayClusteringConfig, popupSourcePath?: string): Promise<void> {
    try {
      if (!overlays || overlays.length === 0) {
        return;
      }

      const geoJsonOverlays: GeoJSONOverlayConfig[] = [];
      const imageOverlayConfigs: ImageOverlayConfig[] = [];
      const vectorTileOverlays: VectorTileOverlayConfig[] = [];

      for (const [index, overlay] of overlays.entries()) {
        if (isGeoJSONOverlay(overlay)) {
          geoJsonOverlays.push({
            index,
            geojson: overlay.geojson,
            source: overlay.source,
            zoom: overlay.zoom,
            style: overlay.style,
            hoverStyle: overlay.hoverStyle,
            popup: overlay.popup,
            popupSourcePath,
            renderBand: resolveOverlayRenderBand(overlay),
          });
        } else if (isImageOverlay(overlay)) {
          imageOverlayConfigs.push({
            index,
            url: overlay.url,
            bounds: overlay.bounds ? {
              north: overlay.bounds.neLat,
                south: overlay.bounds.swLat,
                east: overlay.bounds.neLng,
                west: overlay.bounds.swLng
              } : undefined,
              corners: overlay.corners ? {
                nwLng: overlay.corners.nwLng,
                nwLat: overlay.corners.nwLat,
                neLng: overlay.corners.neLng,
                neLat: overlay.corners.neLat,
                seLng: overlay.corners.seLng,
                seLat: overlay.corners.seLat,
                swLng: overlay.corners.swLng,
                swLat: overlay.corners.swLat
              } : undefined,
              opacity: overlay.style?.opacity,
              sourcePath: overlay.source,
              zoom: overlay.zoom,
              renderBand: resolveOverlayRenderBand(overlay),
            });
          } else if (isVectorTileOverlay(overlay)) {
            vectorTileOverlays.push({
              index,
              source: overlay.source,
              url: overlay.url,
              tiles: overlay.tiles,
              sourceLayer: overlay.sourceLayer,
              layerType: overlay.layerType,
              zoom: overlay.zoom,
              bounds: overlay.bounds,
              attribution: overlay.attribution,
              filter: overlay.filter,
              textField: overlay.textField,
              symbolPlacement: overlay.symbolPlacement,
              sprite: overlay.sprite,
              icon: overlay.icon,
              style: overlay.style,
              hoverStyle: overlay.hoverStyle,
              popup: overlay.popup,
              popupSourcePath,
              hitLabel: overlay.hitLabel,
              tileZoom: overlay.tileZoom,
              tileProvider: overlay.tileProvider,
              renderBand: resolveOverlayRenderBand(overlay),
            });
          }
        }

      if (geoJsonOverlays.length > 0) {
        this.addGeoJSONOverlays(map, geoJsonOverlays, clusteringConfig, showLabels);
      }

      if (imageOverlayConfigs.length > 0) {
        this.addImageOverlays(map, imageOverlayConfigs);
      }

      if (vectorTileOverlays.length > 0) {
        logger.scope('Places').debug(`[MapLibre] Processing ${vectorTileOverlays.length} vector tile overlay layer(s)`);

        await this.addVectorTileOverlays(map, vectorTileOverlays);
      }
    } catch (error) {
      logger.scope('Places').error('Error processing overlays:', error);
    }
  }

  async syncOverlays(map: maplibregl.Map, previousOverlays: readonly Overlay[], nextOverlays: readonly Overlay[], showLabels: boolean, clusteringConfig?: OverlayClusteringConfig, popupSourcePath?: string): Promise<void> {
    if (this.applyImageOpacityOnlyUpdate(map, previousOverlays, nextOverlays)) {
      return;
    }

    const count = Math.max(previousOverlays.length, nextOverlays.length);
    const cleanupResults: MapLibreCleanupResult[] = [];

    for (let index = 0; index < count; index++) {
      cleanupResults.push(this.removeGeoJsonOverlay(map, index));
      cleanupResults.push(this.removeImageOverlay(map, index));
      cleanupResults.push(this.removeVectorTileOverlayLayer(map, index));
    }

    cleanupResults.push(this.removeUnusedVectorTileOverlaySources(map));
    reportMapLibreCleanupIssues(mergeMapLibreCleanupResults(...cleanupResults), 'overlay synchronization');

    await this.processOverlays(map, nextOverlays, showLabels, clusteringConfig, popupSourcePath);
  }

  private applyImageOpacityOnlyUpdate(map: maplibregl.Map, previousOverlays: readonly Overlay[], nextOverlays: readonly Overlay[]): boolean {
    if (previousOverlays.length !== nextOverlays.length || previousOverlays.length === 0) return false;

    const changed: Array<{ index: number; opacity: number }> = [];

    for (let index = 0; index < previousOverlays.length; index++) {
      const previous = previousOverlays[index];
      const next = nextOverlays[index];

      if (!isImageOverlay(previous) || !isImageOverlay(next)) {
        if (JSON.stringify(previous) !== JSON.stringify(next)) return false;
        continue;
      }

      const previousIdentity = { ...previous, style: undefined };
      const nextIdentity = { ...next, style: undefined };

      if (JSON.stringify(previousIdentity) !== JSON.stringify(nextIdentity)) return false;

      const previousOpacity = getImageOverlayOpacity(previous);
      const nextOpacity = getImageOverlayOpacity(next);

      if (previousOpacity !== nextOpacity) {
        changed.push({ index, opacity: nextOpacity });
      }
    }

    for (const { index, opacity } of changed) {
      const layerId = createImageOverlayLayerId(index);

      if (!map.getLayer(layerId)) return false;
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }

    return true;
  }

  private removeGeoJsonOverlay(map: maplibregl.Map, index: number): MapLibreCleanupResult {
    const sourceId = createGeoJsonOverlaySourceId(index);
    const results: MapLibreCleanupResult[] = [];

    for (const suffix of ['circle-hover', 'circle-emoji-hover', 'fill-hover', 'line-hover']) {
      const hoverId = `${sourceId}-${suffix}`;
      const hoverSourceId = `${hoverId}-source`;

      this.removeHoverListeners(map, hoverId.replace(/-hover$/, suffix === 'line-hover' ? '-hitarea' : ''));
      results.push(removeLayersAndSources(map, [hoverId], [hoverSourceId]));
    }

    results.push(removeLayersAndSources(map, createGeoJsonOverlayLayerIds(sourceId), [sourceId]));

    return mergeMapLibreCleanupResults(...results);
  }

  private removeImageOverlay(map: maplibregl.Map, index: number): MapLibreCleanupResult {
    const layerId = createImageOverlayLayerId(index);
    const sourceId = createImageOverlaySourceId(index);

    return removeLayersAndSources(map, [layerId], [sourceId]);
  }

  private removeVectorTileOverlayLayer(map: maplibregl.Map, index: number): MapLibreCleanupResult {
    const layerId = createVectorTileOverlayLayerId(index);
    const hitareaId = `${layerId}-hitarea`;
    const hoverId = `${layerId}-hover`;
    const hoverSourceId = `${hoverId}-source`;

    this.removeHoverListeners(map, hitareaId);
    this.removeHoverListeners(map, layerId);
    if (this.featureHitLayers.get(map)?.delete(layerId)) MapLibreHelper.removePointerCursor(map, layerId);

    return removeLayersAndSources(map, [hoverId, hitareaId, layerId], [hoverSourceId]);
  }

  private removeUnusedVectorTileOverlaySources(map: maplibregl.Map): MapLibreCleanupResult {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    const sourceIds: string[] = [];

    for (const sourceId of Object.keys(style?.sources ?? {})) {
      if (!sourceId.startsWith('vector-tile-overlay-src-')) continue;
      const inUse = layers.some(layer => 'source' in layer && layer.source === sourceId);

      if (!inUse) sourceIds.push(sourceId);
    }

    return removeLayersAndSources(map, [], sourceIds);
  }

  private getOverlayDashArray(geojson: GeoJSON.GeoJSON): number[] | undefined {
    const feature = geojson.type === 'FeatureCollection'
      ? geojson.features.find(item => item.geometry?.type === 'LineString' || item.geometry?.type === 'MultiLineString')
      : geojson.type === 'Feature' ? geojson : undefined;
    const dash: unknown = feature?.properties?.['stroke-dasharray'];

    if (dash === null || dash === '') return undefined;

    if (typeof dash === 'string' || Array.isArray(dash)) {
      const width: unknown = feature?.properties?.['stroke-width'];
      const weight = typeof width === 'number' && width > 0 ? width : TRACK_STYLE_DEFAULTS.weight;
      const values = parseDashArray(dash).map(n => n / weight);

      return values.length ? values : undefined;
    }

    return TRACK_STYLE_DEFAULTS.dashArray;
  }

  addGeoJSONOverlays(map: maplibregl.Map, overlays: GeoJSONOverlayConfig[], clusteringConfig?: OverlayClusteringConfig, showLabels = true): void {
    const skipPointLayers = clusteringConfig?.unifiedClustering === true;

    let shouldClusterSeparately = false;

    if (!skipPointLayers && clusteringConfig?.enabled) {
      let totalPointCount = 0;

      for (const overlay of overlays) {
        totalPointCount += this.countPointFeatures(overlay.geojson);
      }

      shouldClusterSeparately = shouldClusterCount(totalPointCount, clusteringConfig.threshold);
    }

    overlays.forEach((overlay, index) => {
      try {
        const overlayIndex = overlay.index ?? index;
        const sourceId = `geojson-overlay-${overlayIndex}`;
        const defaultColor = TRACK_STYLE_DEFAULTS.color;
        const beforeId = getRenderBandBeforeId(map, overlay.renderBand);

        const dashArray = overlay.style?.dashArray !== undefined
          ? parseDashArray(overlay.style.dashArray)
          : this.getOverlayDashArray(overlay.geojson);

        const hasPointFeatures = this.hasPointGeometry(overlay.geojson);

        if (!skipPointLayers && hasPointFeatures) {
          ensureWaypointMarkerImage(map);
          ensureWaypointIconImages(map, overlay.geojson);
        }

        if (skipPointLayers) {
          const nonPointGeoJson = this.filterOutPointFeatures(overlay.geojson);

          if (nonPointGeoJson) {
            map.addSource(sourceId, {
              type: 'geojson',
              data: nonPointGeoJson
            });
          }
        } else if (shouldClusterSeparately && hasPointFeatures) {
          this.addClusteredPointSource(map, sourceId, overlay, defaultColor, beforeId);
        } else {
          map.addSource(sourceId, {
            type: 'geojson',
            data: overlay.geojson
          });

          this.addPointLayers(map, sourceId, defaultColor, overlay.source, overlay.zoom, overlay.style, overlay.hoverStyle, overlay.popup, overlay.popupSourcePath, beforeId);
        }

        if (map.getSource(sourceId)) {
          this.addPolygonLayers(map, sourceId, defaultColor, overlay.source, overlay.zoom, overlay.style, overlay.hoverStyle, overlay.popup, overlay.popupSourcePath, beforeId);
          this.addLineLayers(map, sourceId, defaultColor, overlay.source, dashArray, overlay.zoom, overlay.style, overlay.hoverStyle, overlay.popup, overlay.popupSourcePath, beforeId);

          if (showLabels) {
            this.addRouteLabelLayer(map, sourceId, overlay.zoom, beforeId);
          }
        }
      } catch (error) {
        logger.scope('Places').warn(`[MapLibre] Failed to add GeoJSON overlay from ${redactUrl(String(overlay.source))}:`, error);
      }
    });
  }

  private filterOutPointFeatures(geojson: GeoJSON.GeoJSON): GeoJSON.GeoJSON | null {
    if (geojson.type === 'FeatureCollection') {
      const nonPointFeatures = geojson.features.filter(feature =>
        feature.geometry?.type !== 'Point' && feature.geometry?.type !== 'MultiPoint'
      );

      if (nonPointFeatures.length === 0) return null;

      return {
        type: 'FeatureCollection',
        features: nonPointFeatures
      };
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry?.type === 'Point' || geojson.geometry?.type === 'MultiPoint') {
        return null;
      }

      return geojson;
    }

    if (geojson.type === 'Point' || geojson.type === 'MultiPoint') {
      return null;
    }

    return geojson;
  }

  private countPointFeatures(geojson: GeoJSON.GeoJSON): number {
    let count = 0;

    if (geojson.type === 'FeatureCollection') {
      for (const feature of geojson.features) {
        if (feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint') {
          count++;
        }
      }
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry?.type === 'Point' || geojson.geometry?.type === 'MultiPoint') {
        count = 1;
      }
    } else if (geojson.type === 'Point' || geojson.type === 'MultiPoint') {
      count = 1;
    }

    return count;
  }

  private hasPointGeometry(geojson: GeoJSON.GeoJSON): boolean {
    return this.countPointFeatures(geojson) > 0;
  }

  private addClusteredPointSource(map: maplibregl.Map, sourceId: string, overlay: GeoJSONOverlayConfig, defaultColor: string, beforeId?: string): void {
    const pointFeatures = this.extractPointFeatures(overlay.geojson);

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: pointFeatures
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-clusters`,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',    
          100,
          '#f1f075',    
          750,
          '#f28cb1'     
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,     
          100,
          30,     
          750,
          40      
        ]
      }
    }, overlay.zoom), beforeId);

    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-cluster-count`,
      type: 'symbol',
      source: sourceId,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': resolveStyleTextFont(map, { bold: true }),
        'text-size': 12
      },
      paint: {
        'text-color': '#000'
      }
    }, overlay.zoom), beforeId);

    map.addLayer(this.applyZoomRange(createWaypointLayerConfig({
      sourceId,
      layerId: `${sourceId}-circle`,
      trackColor: overlay.style?.color ?? overlay.style?.fillColor ?? defaultColor,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]],
      defaultRadius: overlay.style?.circleRadius ?? 5,
      defaultOpacity: zoomScaledNumberToExpression(overlay.style?.opacity) ?? 0.7,
      defaultStrokeColor: overlay.style?.strokeColor ?? '#fff',
      defaultStrokeWidth: overlay.style?.strokeWidth ?? 1,
    }) as maplibregl.SymbolLayerSpecification, overlay.zoom), beforeId);
    map.addLayer(this.applyZoomRange(createWaypointEmojiLayerConfig({
      sourceId,
      layerId: `${sourceId}-circle-emoji`,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'point_count']]],
      defaultOpacity: zoomScaledNumberToExpression(overlay.style?.opacity) ?? 0.7,
    }) as maplibregl.SymbolLayerSpecification, overlay.zoom), beforeId);

    map.on('click', `${sourceId}-clusters`, (e) => {
      if (this.isInteractionEnabled?.() === false) return;

      void (async () => {
        const features = e.features;

        if (!features || !features.length) return;

        const clusterId: unknown = features[0].properties?.cluster_id;

        if (typeof clusterId !== 'number') return;
        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;

        try {
          const zoom = await source.getClusterExpansionZoom(clusterId);

          map.jumpTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom ?? map.getZoom() + 2
          });
        } catch {
          map.jumpTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: map.getZoom() + 2
          });
        }
      })();
    });

    for (const layerId of [`${sourceId}-circle`, `${sourceId}-circle-emoji`]) {
      map.on('click', layerId, (e) => {
        if (this.isInteractionEnabled?.() === false) return;
        if (e.defaultPrevented || !e.features || e.features.length === 0) return;
        e.preventDefault();
        e.originalEvent.stopPropagation();
        this.showGeoJsonFeaturePopup(map, e.features[0], e.lngLat, overlay.source, overlay.popup, overlay.popupSourcePath);
      });
    }

    MapLibreHelper.addPointerCursor(map, `${sourceId}-clusters`);
    MapLibreHelper.addPointerCursor(map, `${sourceId}-circle`);
    MapLibreHelper.addPointerCursor(map, `${sourceId}-circle-emoji`);
    this.addHoverOverlay(map, `${sourceId}-circle`, `${sourceId}-circle-hover`, 'circle', this.createHoverPaint('circle', overlay.style, overlay.hoverStyle), beforeId);
    this.addHoverOverlay(map, `${sourceId}-circle-emoji`, `${sourceId}-circle-emoji-hover`, 'circle', this.createHoverPaint('circle', overlay.style, overlay.hoverStyle), beforeId);
  }

  private extractPointFeatures(geojson: GeoJSON.GeoJSON): GeoJSON.Feature[] {
    const points: GeoJSON.Feature[] = [];

    if (geojson.type === 'FeatureCollection') {
      for (const feature of geojson.features) {
        if ((feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint') && !feature.properties?.route_label_point) {
          points.push(feature);
        }
      }
    } else if (geojson.type === 'Feature') {
      if (geojson.geometry?.type === 'Point' || geojson.geometry?.type === 'MultiPoint') {
        points.push(geojson);
      }
    }

    return points;
  }

  private applyZoomRange<T extends maplibregl.LayerSpecification>(layer: T, zoom?: ZoomRange): T {
    if (zoom?.minZoom !== undefined) layer.minzoom = zoom.minZoom;
    if (zoom?.maxZoom !== undefined) layer.maxzoom = toGlMaxZoom(zoom.maxZoom);

    return layer;
  }

  private addPointLayers(map: maplibregl.Map, sourceId: string, defaultColor: string, sourcePath?: string, zoom?: ZoomRange, style?: OverlayRenderStyle, hoverStyle?: OverlayRenderStyle, popup?: PopupContentConfig, popupSourcePath?: string, beforeId?: string): void {
    map.addLayer(this.applyZoomRange(createWaypointLayerConfig({
      sourceId,
      layerId: `${sourceId}-circle`,
      trackColor: style?.color ?? style?.fillColor ?? defaultColor,
      filter: ['all', ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']], ['!', ['has', 'route_label_point']]],
      defaultRadius: style?.circleRadius ?? 5,
      defaultOpacity: zoomScaledNumberToExpression(style?.opacity) ?? 0.7,
      defaultStrokeColor: style?.strokeColor ?? '#fff',
      defaultStrokeWidth: style?.strokeWidth ?? 1,
    }) as maplibregl.SymbolLayerSpecification, zoom), beforeId);
    map.addLayer(this.applyZoomRange(createWaypointEmojiLayerConfig({
      sourceId,
      layerId: `${sourceId}-circle-emoji`,
      filter: ['all', ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']], ['!', ['has', 'route_label_point']]],
      defaultOpacity: zoomScaledNumberToExpression(style?.opacity) ?? 0.7,
    }) as maplibregl.SymbolLayerSpecification, zoom), beforeId);

    this.addGeoJsonPopupHandler(map, `${sourceId}-circle`, sourcePath, popup, popupSourcePath);
    this.addGeoJsonPopupHandler(map, `${sourceId}-circle-emoji`, sourcePath, popup, popupSourcePath);
    this.addHoverOverlay(map, `${sourceId}-circle`, `${sourceId}-circle-hover`, 'circle', this.createHoverPaint('circle', style, hoverStyle), beforeId);
    this.addHoverOverlay(map, `${sourceId}-circle-emoji`, `${sourceId}-circle-emoji-hover`, 'circle', this.createHoverPaint('circle', style, hoverStyle), beforeId);
  }

  private addPolygonLayers(map: maplibregl.Map, sourceId: string, defaultColor: string, sourcePath?: string, zoom?: ZoomRange, style?: OverlayRenderStyle, hoverStyle?: OverlayRenderStyle, popup?: PopupContentConfig, popupSourcePath?: string, beforeId?: string): void {
    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-fill`,
      type: 'fill',
      source: sourceId,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'fill-color': ['coalesce', ['get', 'fill'], style?.fillColor ?? style?.color ?? defaultColor],
        'fill-opacity': ['coalesce', ['get', 'fill-opacity'], style?.fillOpacity ?? 0.3]
      }
    }, zoom), beforeId);

    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-fill-outline`,
      type: 'line',
      source: sourceId,
      filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
      paint: {
        'line-color': ['coalesce', ['get', 'stroke'], style?.strokeColor ?? style?.color ?? defaultColor],
        'line-width': ['coalesce', ['get', 'stroke-width'], style?.strokeWidth ?? 2],
        'line-opacity': ['coalesce', ['get', 'stroke-opacity'], style?.strokeOpacity ?? 1]
      }
    }, zoom), beforeId);

    this.addGeoJsonPopupHandler(map, `${sourceId}-fill`, sourcePath, popup, popupSourcePath);
    this.addHoverOverlay(map, `${sourceId}-fill`, `${sourceId}-fill-hover`, 'fill', this.createHoverPaint('fill', style, hoverStyle), beforeId);
  }

  private addLineLayers(map: maplibregl.Map, sourceId: string, defaultColor: string, sourcePath?: string, dashArray?: number[], zoom?: ZoomRange, style?: OverlayRenderStyle, hoverStyle?: OverlayRenderStyle, popup?: PopupContentConfig, popupSourcePath?: string, beforeId?: string): void {
    const overlayColor = style?.color ?? style?.strokeColor;
    const overlayWidth = zoomScaledNumberToExpression(style?.width);
    const overlayOpacity = zoomScaledNumberToExpression(style?.opacity);
    const linePaint: Record<string, unknown> = {
      'line-color': ['coalesce', ['get', 'stroke'], overlayColor ?? defaultColor],
      'line-width': ['coalesce', ['get', 'stroke-width'], overlayWidth ?? TRACK_STYLE_DEFAULTS.weight],
      'line-opacity': ['coalesce', ['get', 'stroke-opacity'], overlayOpacity ?? TRACK_STYLE_DEFAULTS.opacity]
    };

    if (dashArray?.length) {
      linePaint['line-dasharray'] = dashArray;
    }

    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-line`,
      type: 'line',
      source: sourceId,
      filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: linePaint
    }, zoom), beforeId);

    map.addLayer(this.applyZoomRange({
      id: `${sourceId}-line-hitarea`,
      type: 'line',
      source: sourceId,
      filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
      paint: {
        'line-color': 'transparent',
        'line-width': 15,
        'line-opacity': 0
      }
    }, zoom), beforeId);

    this.addGeoJsonPopupHandler(map, `${sourceId}-line-hitarea`, sourcePath, popup, popupSourcePath);
    this.addHoverOverlay(map, `${sourceId}-line-hitarea`, `${sourceId}-line-hover`, 'line', this.createHoverPaint('line', style, hoverStyle), beforeId);
  }

  private addRouteLabelLayer(map: maplibregl.Map, sourceId: string, zoom?: ZoomRange, beforeId?: string): void {
    map.addLayer(this.applyZoomRange(createRouteLabelLayerConfig({ sourceId }) as maplibregl.LayerSpecification, zoom), beforeId);
    map.addLayer(this.applyZoomRange(createRouteEndpointLabelLayerConfig({ sourceId }) as maplibregl.LayerSpecification, zoom), beforeId);
  }

  private addGeoJsonPopupHandler(map: maplibregl.Map, layerId: string, sourcePath?: string, popup?: PopupContentConfig, popupSourcePath?: string): void {
    map.on('click', layerId, (e) => {
      if (this.isInteractionEnabled?.() === false) return;
      if (e.defaultPrevented || !e.features || e.features.length === 0) return;
      if (this.hasOverlayPointAtEvent(map, e, layerId)) return;

      e.preventDefault();
      e.originalEvent.stopPropagation();
      this.showGeoJsonFeaturePopup(map, e.features[0], e.lngLat, sourcePath, popup, popupSourcePath);
    });

    MapLibreHelper.addPointerCursor(map, layerId);
  }

  private static hoverFeatureKeyFor(feature: maplibregl.MapGeoJSONFeature): string {
    if (feature.id !== undefined && feature.id !== null) return `id:${String(feature.id)}`;
    const geometry = feature.geometry;
    let coordinate: unknown = 'coordinates' in geometry ? geometry.coordinates : undefined;

    while (Array.isArray(coordinate) && Array.isArray(coordinate[0])) coordinate = coordinate[0];
    const position = Array.isArray(coordinate) ? coordinate.slice(0, 2).join(',') : '';

    return `${feature.layer?.id ?? ''}:${geometry.type}:${position}`;
  }

  private addHoverOverlay(map: maplibregl.Map, targetLayerId: string, hoverId: string, layerType: 'line' | 'fill' | 'circle', paint: Record<string, unknown> | undefined, beforeId?: string): void {
    if (!paint) return;
    const sourceId = `${hoverId}-source`;

    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: hoverId,
      type: layerType,
      source: sourceId,
      paint,
      ...(layerType === 'line' ? { layout: { 'line-join': 'round', 'line-cap': 'round' } } : {}),
    } as maplibregl.LayerSpecification, beforeId);

    let hoveredKey: string | null = null;

    const clear = () => {
      if (hoveredKey === null) return;
      hoveredKey = null;
      const source = map.getSource<maplibregl.GeoJSONSource>(sourceId);

      void source?.setData({ type: 'FeatureCollection', features: [] });
    };
    const move = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const source = map.getSource<maplibregl.GeoJSONSource>(sourceId);

      if (!feature || !source) return;
      const key = MapLibreOverlayHandler.hoverFeatureKeyFor(feature);

      if (key === hoveredKey) return;
      hoveredKey = key;
      void source.setData({
        type: 'Feature',
        // MapLibre feature properties have a null prototype; the worker serializer reads constructor.
        properties: { ...feature.properties },
        geometry: feature.geometry,
      });
    };

    this.removeHoverListeners(map, targetLayerId);
    map.on('mousemove', targetLayerId, move);
    map.on('mouseleave', targetLayerId, clear);
    let listeners = this.hoverListeners.get(map);

    if (!listeners) {
      listeners = new Map();
      this.hoverListeners.set(map, listeners);
    }

    listeners.set(targetLayerId, { move, leave: clear });
  }

  private removeHoverListeners(map: maplibregl.Map, targetLayerId: string): void {
    const listeners = this.hoverListeners.get(map);
    const handlers = listeners?.get(targetLayerId);

    if (!handlers) return;
    map.off('mousemove', targetLayerId, handlers.move);
    map.off('mouseleave', targetLayerId, handlers.leave);
    listeners!.delete(targetLayerId);
  }

  private createHoverPaint(layerType: 'line' | 'fill' | 'circle', style: OverlayRenderStyle | undefined, hover: OverlayRenderStyle | undefined): Record<string, unknown> | undefined {
    if (!hover) return undefined;
    const merged = { ...style, ...hover };

    if (layerType === 'fill') {
      return {
        'fill-color': hover.fillColor ?? hover.color ?? ['coalesce', ['get', 'fill'], merged.fillColor ?? merged.color ?? TRACK_STYLE_DEFAULTS.color],
        'fill-opacity': hover.fillOpacity ?? ['coalesce', ['get', 'fill-opacity'], merged.fillOpacity ?? 0.3],
        'fill-outline-color': hover.strokeColor ?? hover.color ?? ['coalesce', ['get', 'stroke'], merged.strokeColor ?? merged.color ?? TRACK_STYLE_DEFAULTS.color],
      };
    }

    if (layerType === 'circle') {
      return {
        'circle-radius': hover.circleRadius ?? ['coalesce', ['get', 'circle-radius'], merged.circleRadius ?? 5],
        'circle-color': hover.color ?? hover.fillColor ?? ['coalesce', ['get', 'marker-color'], merged.color ?? merged.fillColor ?? TRACK_STYLE_DEFAULTS.color],
        'circle-opacity': zoomScaledNumberToExpression(hover.opacity) ?? ['coalesce', ['get', 'fill-opacity'], zoomScaledNumberToExpression(merged.opacity) ?? 0.7],
        'circle-stroke-color': hover.strokeColor ?? ['coalesce', ['get', 'stroke'], merged.strokeColor ?? '#fff'],
        'circle-stroke-width': hover.strokeWidth ?? ['coalesce', ['get', 'stroke-width'], merged.strokeWidth ?? 1],
        'circle-stroke-opacity': hover.strokeOpacity ?? ['coalesce', ['get', 'stroke-opacity'], merged.strokeOpacity ?? 1],
      };
    }

    return {
      'line-color': hover.color ?? ['coalesce', ['get', 'stroke'], merged.color ?? TRACK_STYLE_DEFAULTS.color],
      'line-width': zoomScaledNumberToExpression(hover.width) ?? ['coalesce', ['get', 'stroke-width'], zoomScaledNumberToExpression(merged.width) ?? TRACK_STYLE_DEFAULTS.weight],
      'line-opacity': zoomScaledNumberToExpression(hover.opacity) ?? ['coalesce', ['get', 'stroke-opacity'], zoomScaledNumberToExpression(merged.opacity) ?? TRACK_STYLE_DEFAULTS.opacity],
      ...((hover.dashArray ?? merged.dashArray) ? { 'line-dasharray': (hover.dashArray ?? merged.dashArray)!.split(',').map(Number) } : {}),
    };
  }

  private hasOverlayPointAtEvent(map: maplibregl.Map, event: maplibregl.MapLayerMouseEvent, layerId: string): boolean {
    const sourceId = layerId.match(/^(.*)-(?:line-hitarea|fill|circle)$/)?.[1];

    if (!sourceId) return false;
    const pointLayerIds = [`${sourceId}-circle`, `${sourceId}-circle-emoji`]
      .filter(pointLayerId => pointLayerId !== layerId && map.getLayer(pointLayerId));

    return pointLayerIds.length > 0 && map.queryRenderedFeatures(event.point, { layers: pointLayerIds }).length > 0;
  }

  addImageOverlays(map: maplibregl.Map, overlays: ImageOverlayConfig[]): void {
    overlays.forEach((overlay, index) => {
      try {
        const overlayIndex = overlay.index ?? index;
        const sourceId = createImageOverlaySourceId(overlayIndex);
        const layerId = createImageOverlayLayerId(overlayIndex);
        const beforeId = getRenderBandBeforeId(map, overlay.renderBand);

        let coordinates: [[number, number], [number, number], [number, number], [number, number]];

        if (overlay.corners) {
          coordinates = [
            [overlay.corners.nwLng, overlay.corners.nwLat],
            [overlay.corners.neLng, overlay.corners.neLat],
            [overlay.corners.seLng, overlay.corners.seLat],
            [overlay.corners.swLng, overlay.corners.swLat]
          ];
        } else if (overlay.bounds) {
          coordinates = [
            [overlay.bounds.west, overlay.bounds.north],
            [overlay.bounds.east, overlay.bounds.north],
            [overlay.bounds.east, overlay.bounds.south],
            [overlay.bounds.west, overlay.bounds.south]
          ];
        } else {
          throw new Error('Image overlay must have either bounds or corners');
        }

        map.addSource(sourceId, {
          type: 'image',
          url: overlay.url,
          coordinates
        });

        map.addLayer(this.applyZoomRange({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': overlay.opacity ?? 1.0,
            'raster-opacity-transition': {
              duration: 100,
              delay: 0
            }
          }
        }, overlay.zoom), beforeId);
        logger.scope('Places').debug(`[MapLibre] Added image overlay ${index + 1}/${overlays.length} from ${String(overlay.sourcePath || overlay.url)}`);
      } catch (error) {
        logger.scope('Places').warn(`[MapLibre] Failed to add image overlay ${index + 1}:`, error);

        const imageName = String(overlay.sourcePath || overlay.url || `image ${index + 1}`);
        let errorMessage = `Failed to add image overlay: ${imageName}`;

        const err = error as Error;

        if (err.message?.includes('non-convex')) {
          errorMessage = `Image overlay error: The 4 corners must form a proper quadrilateral without crossing sides.\n\nImage: ${imageName}\n\nTip: Corners must be in clockwise order (NW, NE, SE, SW) and form a convex shape.`;
        } else if (err.message) {
          errorMessage = `Image overlay error: ${err.message}\n\nImage: ${imageName}`;
        }

        renderMapSupplementalError(map.getContainer(), {
          icon: '⚠️',
          title: 'Image Overlay Error',
          message: errorMessage,
          className: 'overlay-render-error',
        });
      }
    });
  }

  private static readonly tileJsonLoader = createTileJsonResolver(async url => (await requestUrl({ url })).text);
  private static readonly resolvedTileJson = new Map<string, ResolvedTileJson>();

  private static async resolveTileJson(url: string): Promise<ResolvedTileJson> {
    const tileJson = await MapLibreOverlayHandler.tileJsonLoader(url);

    MapLibreOverlayHandler.resolvedTileJson.set(url, tileJson);

    return tileJson;
  }

  static getResolvedVectorLayers(url: string): TileJsonVectorLayer[] | undefined {
    return MapLibreOverlayHandler.resolvedTileJson.get(url)?.vectorLayers;
  }

  async addVectorTileOverlays(map: maplibregl.Map, overlays: VectorTileOverlayConfig[]): Promise<void> {
    for (const [index, overlay] of overlays.entries()) {
      try {
        const overlayIndex = overlay.index ?? index;
        const sourceId = createVectorTileOverlaySourceId(overlay);
        const layerId = createVectorTileOverlayLayerId(overlayIndex);
        const beforeId = getRenderBandBeforeId(map, overlay.renderBand);

        if (overlay.url && isPmtilesUrl(overlay.url)) await this.registerPmtilesArchive?.(overlay.url);
        const tileJson = overlay.url && !isPmtilesUrl(overlay.url) ? await MapLibreOverlayHandler.resolveTileJson(overlay.url) : undefined;

        if ((map as unknown as { _removed?: boolean })._removed === true) return;

        if (overlay.tileProvider) registerOverlayTileProvider(tileJson?.tiles ?? overlay.tiles ?? [], overlay.tileProvider);

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, createVectorTileSourceSpec(overlay, tileJson) as maplibregl.SourceSpecification);
        }

        const filter = overlay.filter;
        const layout = this.createVectorTileLayout(overlay, this.resolveVectorTileIconImage(map, overlay), resolveStyleTextFont(map));

        this.addVectorTileLayer(map, this.applyZoomRange({
          id: layerId,
          type: overlay.layerType,
          source: sourceId,
          'source-layer': overlay.sourceLayer,
          ...(filter ? { filter } : {}),
          paint: this.createVectorTilePaint(overlay),
          ...(layout ? { layout } : {}),
        } as maplibregl.LayerSpecification, overlay.zoom), layerId, overlay.source, beforeId);

        if (overlay.layerType === 'line' || overlay.layerType === 'fill' || overlay.layerType === 'circle') {
          let hoverTargetLayerId = layerId;

          if (overlay.layerType === 'line' && overlay.hoverStyle) {
            hoverTargetLayerId = `${layerId}-hitarea`;
            map.addLayer(this.applyZoomRange({
              id: hoverTargetLayerId,
              type: 'line',
              source: sourceId,
              'source-layer': overlay.sourceLayer,
              ...(filter ? { filter } : {}),
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': 'transparent',
                'line-width': 15,
                'line-opacity': 0,
              },
            } as maplibregl.LayerSpecification, overlay.zoom), beforeId);
          }

          this.addHoverOverlay(
            map,
            hoverTargetLayerId,
            `${layerId}-hover`,
            overlay.layerType,
            this.createHoverPaint(overlay.layerType, overlay.style, overlay.hoverStyle),
            beforeId,
          );
        }

        if (overlay.popup) {
          let layers = this.featureHitLayers.get(map);

          if (!layers) {
            layers = new Map();
            this.featureHitLayers.set(map, layers);
          }

          layers.set(layerId, {
            popup: overlay.popup,
            ...(overlay.popupSourcePath ? { popupSourcePath: overlay.popupSourcePath } : {}),
            label: overlay.hitLabel ?? overlay.sourceLayer,
            ...(overlay.textField ? { textField: overlay.textField } : {}),
          });
          this.onFeatureHitLayer?.(map, layerId);
        }

        logger.scope('Places').debug(`[MapLibre] Added vector tile overlay ${overlayIndex + 1} from ${redactUrl(String(overlay.source))}`, {
          sourceId,
          layerId,
          sourceLayer: overlay.sourceLayer,
          layerType: overlay.layerType,
          mapSources: Object.keys(map.getStyle().sources ?? {}).length,
          mapLayers: map.getStyle().layers?.length ?? 0,
        });
        this.logVectorTileOverlayFeatureCounts(map, overlay, sourceId, layerId);
      } catch (error) {
        logger.scope('Places').warn(`[MapLibre] Failed to add vector tile overlay ${index + 1}:`, error);
        const err = error as Error;

        renderMapSupplementalError(map.getContainer(), {
          icon: '⚠️',
          title: 'Vector Tile Overlay Error',
          message: `${err.message || String(error)} Overlay: ${redactUrl(String(overlay.source))}`,
          className: 'overlay-render-error',
        });
      }
    }
  }

  private logVectorTileOverlayFeatureCounts(map: maplibregl.Map, overlay: VectorTileOverlayConfig, sourceId: string, layerId: string): void {
    let logged = false;
    const logCounts = () => {
      if (logged || !map.getSource(sourceId) || !map.getLayer(layerId)) return;

      try {
        const sourceFeatures = map.querySourceFeatures(sourceId, { sourceLayer: overlay.sourceLayer });
        const renderedFeatures = map.queryRenderedFeatures({ layers: [layerId] });
        const sample = sourceFeatures[0];

        logger.scope('Places').debug(`[MapLibre] Vector tile overlay feature check for ${redactUrl(String(overlay.source))}`, {
          sourceId,
          layerId,
          sourceLayer: overlay.sourceLayer,
          layerType: overlay.layerType,
          zoom: map.getZoom(),
          sourceFeatures: sourceFeatures.length,
          renderedFeatures: renderedFeatures.length,
          sampleGeometry: sample?.geometry?.type,
          sampleProperties: sample?.properties ? Object.keys(sample.properties).slice(0, 12) : [],
        });
        logged = true;
      } catch (error) {
        logger.scope('Places').debug(`[MapLibre] Vector tile overlay feature check failed for ${redactUrl(String(overlay.source))}`, {
          sourceId,
          layerId,
          sourceLayer: overlay.sourceLayer,
          error: getErrorMessage(error),
        });
      }
    };

    void map.once('idle', logCounts);
    window.setTimeout(logCounts, 1500);
  }

  private addVectorTileLayer(map: maplibregl.Map, layer: maplibregl.LayerSpecification, layerId: string, source: unknown, beforeId?: string): void {
    let captured: { message: string } | undefined;
    const onError = (event: { error?: { message: string } }): void => { captured = event.error ?? captured; };

    map.on('error', onError);

    try {
      map.addLayer(layer, beforeId);
    } catch (error) {
      captured = error instanceof Error ? error : new Error(String(error));
    } finally {
      map.off('error', onError);
    }

    if (!map.getLayer(layerId)) {
      throw new Error(captured?.message ?? `MapLibre rejected the vector tile overlay layer for ${String(source)}.`);
    }
  }

  private createVectorTilePaint(overlay: VectorTileOverlayConfig): Record<string, unknown> {
    const style = overlay.style;

    switch (overlay.layerType) {
      case 'fill':
        return {
          'fill-color': style?.fillColor || style?.color || TRACK_STYLE_DEFAULTS.color,
          'fill-opacity': style?.fillOpacity ?? zoomScaledNumberToExpression(style?.opacity) ?? 0.3,
          ...(style?.strokeColor || style?.color ? { 'fill-outline-color': style.strokeColor || style.color } : {}),
        };
      case 'circle':
        return {
          'circle-radius': style?.circleRadius ?? 4,
          'circle-color': style?.color || style?.fillColor || TRACK_STYLE_DEFAULTS.color,
          'circle-opacity': zoomScaledNumberToExpression(style?.opacity) ?? 0.8,
          'circle-stroke-color': style?.strokeColor || '#fff',
          'circle-stroke-width': style?.strokeWidth ?? 1,
          'circle-stroke-opacity': style?.strokeOpacity ?? 1,
        };
      case 'symbol':
        return {
          'text-color': style?.textColor || style?.color || TRACK_STYLE_DEFAULTS.color,
          ...(style?.opacity !== undefined ? { 'text-opacity': zoomScaledNumberToExpression(style.opacity) } : {}),
          ...(style?.textHaloColor ? { 'text-halo-color': style.textHaloColor } : {}),
          'text-halo-width': style?.textHaloWidth ?? 1,
        };
      case 'line':
      default:
        return {
          'line-color': style?.color || TRACK_STYLE_DEFAULTS.color,
          'line-width': zoomScaledNumberToExpression(style?.width) ?? TRACK_STYLE_DEFAULTS.weight,
          'line-opacity': zoomScaledNumberToExpression(style?.opacity) ?? TRACK_STYLE_DEFAULTS.opacity,
          ...(style?.dashArray ? { 'line-dasharray': style.dashArray.split(',').map(Number) } : {}),
        };
    }
  }

  private createVectorTileLayout(overlay: VectorTileOverlayConfig, iconImage: string | undefined, textFont: string[]): Record<string, unknown> | undefined {
    if (overlay.layerType === 'line') {
      return { 'line-join': 'round', 'line-cap': 'round' };
    }

    if (overlay.layerType === 'symbol' && (overlay.textField || iconImage)) {
      const placement = overlay.symbolPlacement ?? 'line';

      return {
        ...(overlay.textField ? {
          'text-field': ['to-string', ['get', overlay.textField]],
          'text-font': textFont,
          'text-size': zoomScaledNumberToExpression(overlay.style?.textSize) ?? 11,
        } : {}),
        ...(iconImage ? {
          'icon-image': iconImage,
          ...(overlay.style?.iconSize !== undefined ? { 'icon-size': overlay.style.iconSize } : {}),
        } : {}),
        'symbol-placement': placement,
        ...(placement !== 'point' ? { 'symbol-spacing': 300 } : {}),
      };
    }

    return undefined;
  }

  private resolveVectorTileIconImage(map: maplibregl.Map, overlay: VectorTileOverlayConfig): string | undefined {
    if (!overlay.icon) return undefined;
    if (!overlay.sprite) return overlay.icon;

    if (typeof map.addSprite !== 'function') {
      logger.scope('Places').debug(`[MapLibre] Sprite ${overlay.sprite} skipped for ${redactUrl(String(overlay.source))}: engine does not support addSprite`);

      return undefined;
    }

    const spriteId = `places-sprite-${hashString36(overlay.sprite)}`;
    const registered = typeof map.getSprite === 'function' && map.getSprite().some(entry => entry.id === spriteId);

    if (!registered) {
      map.addSprite(spriteId, overlay.sprite);
    }

    return `${spriteId}:${overlay.icon}`;
  }

  private showGeoJsonFeaturePopup(map: maplibregl.Map, feature: GeoJSON.Feature, lngLat: maplibregl.LngLat, sourcePath?: string, popup?: PopupContentConfig, popupSourcePath?: string): void {
    MapLibreHelper.closeAllPopups();

    const properties = feature.properties || {};
    const geometryType = feature.geometry?.type || 'Feature';
    const popupContent = buildGeoJsonFeaturePopupContent({
      properties,
      geometryType,
      sourcePath,
      includeProperties: !popup,
      onSourceLinkClick: createSourceLinkClickHandler(sourcePath, (linkPath) => openLocalFile(this.app, linkPath))
    });

    const mapPopup = MapLibreHelper.openPopup(map, lngLat, popupContent);

    if (popup) {
      renderFeaturePopupContentAsync(this.app, {
        kind: 'feature',
        feature,
        sourcePath,
        presentation: 'feature',
        markdownSourcePath: popupSourcePath,
      }, popup, popupContent, {
        markdownSourcePath: popupSourcePath,
        popupRenderers: MapState.for(map).getCurrentRenderRequest()?.runtime.popupRenderers,
        onRendered: () => mapPopup.setDOMContent(popupContent),
      });
    }
  }
}
