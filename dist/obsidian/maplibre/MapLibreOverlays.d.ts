import { App } from 'obsidian';
import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { type OverlayRenderBand, type OverlayRenderStyle, type VectorTileLayerType } from "../../overlay/index";
import { type ZoomRange } from "../../map/index";
import type { Overlay, TileJsonVectorLayer } from "../../overlay/index";
import type { PopupContentConfig } from "../../settings/index";
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
    bounds?: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    corners?: {
        nwLng: number;
        nwLat: number;
        neLng: number;
        neLat: number;
        seLng: number;
        seLat: number;
        swLng: number;
        swLat: number;
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
export declare class MapLibreOverlayHandler {
    private app;
    private isInteractionEnabled?;
    private registerPmtilesArchive?;
    private onFeatureHitLayer?;
    private readonly featureHitLayers;
    private readonly hoverListeners;
    constructor(app: App, options?: MapLibreOverlayHandlerOptions);
    getVectorFeatureHitLayers(map: maplibregl.Map): ReadonlyMap<string, VectorFeatureHitLayer>;
    buildVectorFeaturePopupContent(map: maplibregl.Map, feature: GeoJSON.Feature, layer: VectorFeatureHitLayer, label: string, onRendered: () => void): HTMLElement;
    processOverlays(map: maplibregl.Map, overlays: readonly Overlay[], showLabels: boolean, clusteringConfig?: OverlayClusteringConfig, popupSourcePath?: string): Promise<void>;
    syncOverlays(map: maplibregl.Map, previousOverlays: readonly Overlay[], nextOverlays: readonly Overlay[], showLabels: boolean, clusteringConfig?: OverlayClusteringConfig, popupSourcePath?: string): Promise<void>;
    private applyImageOpacityOnlyUpdate;
    private removeGeoJsonOverlay;
    private removeImageOverlay;
    private removeVectorTileOverlayLayer;
    private removeUnusedVectorTileOverlaySources;
    private getOverlayDashArray;
    addGeoJSONOverlays(map: maplibregl.Map, overlays: GeoJSONOverlayConfig[], clusteringConfig?: OverlayClusteringConfig, showLabels?: boolean): void;
    private filterOutPointFeatures;
    private countPointFeatures;
    private hasPointGeometry;
    private addClusteredPointSource;
    private extractPointFeatures;
    private applyZoomRange;
    private addPointLayers;
    private addPolygonLayers;
    private addLineLayers;
    private addRouteLabelLayer;
    private addGeoJsonPopupHandler;
    private static hoverFeatureKeyFor;
    private addHoverOverlay;
    private removeHoverListeners;
    private createHoverPaint;
    private hasOverlayPointAtEvent;
    addImageOverlays(map: maplibregl.Map, overlays: ImageOverlayConfig[]): void;
    private static readonly tileJsonLoader;
    private static readonly resolvedTileJson;
    private static resolveTileJson;
    static getResolvedVectorLayers(url: string): TileJsonVectorLayer[] | undefined;
    addVectorTileOverlays(map: maplibregl.Map, overlays: VectorTileOverlayConfig[]): Promise<void>;
    private logVectorTileOverlayFeatureCounts;
    private addVectorTileLayer;
    private createVectorTilePaint;
    private createVectorTileLayout;
    private resolveVectorTileIconImage;
    private showGeoJsonFeaturePopup;
}
