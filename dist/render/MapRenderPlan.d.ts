import type { MapPlace } from '../Place';
import type { Overlay } from '../overlay/OverlaySystem';
import type { MapContextAction, MapRuntimeContext, MapSourceContext, ResolvedMapConfig } from '../settings/MapConfiguration';
import { type PerformanceMonitor } from '../utils/PerformanceMonitor';
import { type ZoomRange } from '../ZoomVisibility';
export type MapSurfaceKind = 'places-block' | 'bases-view' | 'track-preview' | 'other';
export type MapCameraIntent = {
    kind: 'fit-data';
    padding?: number;
    maxZoom?: number;
} | {
    kind: 'explicit';
    center?: [number, number];
    zoom?: number;
} | {
    kind: 'preserve';
};
export declare function resolveFitDataCamera(camera?: {
    padding?: number;
    maxZoom?: number;
}): {
    kind: 'fit-data';
    padding: number;
    maxZoom: number;
};
export type RenderableKind = 'marker' | 'label' | 'note-track' | 'geojson-overlay' | 'image-overlay' | 'vector-tile-overlay';
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
    errors: Array<{
        path: string;
        error: string;
    }>;
}
export interface MapRenderPlan {
    dataState?: 'loading';
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
    errors: Array<{
        path: string;
        error: string;
    }>;
}
export interface MapRenderPlanDiff {
    added: MapRenderable[];
    removed: MapRenderable[];
    updated: Array<{
        previous: MapRenderable;
        next: MapRenderable;
    }>;
    unchanged: MapRenderable[];
}
export type MapIncrementalChangeKind = 'places' | 'overlays' | 'styles' | 'tools' | 'clustering' | 'terrain';
export interface CreateMapRenderPlanOptions {
    dataState?: 'loading';
    perf?: PerformanceMonitor;
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
    popupRenderers?: MapRuntimeContext['popupRenderers'];
    terrainDem?: MapRuntimeContext['terrainDem'];
    reliefDem?: MapRuntimeContext['reliefDem'];
    markerVisibilityHiddenIds?: readonly string[];
    popupDebug?: MapRuntimeContext['popupDebug'];
    prepareTimings?: MapRuntimeContext['prepareTimings'];
    isStale?: MapRuntimeContext['isStale'];
}
export type RememberedFitPolicy = 'use' | 'ignore';
export declare function resolveCameraIntent(config: ResolvedMapConfig, source?: MapSourceContext, options?: {
    rememberedFit?: RememberedFitPolicy;
}): MapCameraIntent;
export declare function prepareMapOverlays(places: MapPlace[], overlays?: Overlay[], generatedOverlays?: Overlay[]): OverlayPreparationResult;
export declare function createMapRenderPlan(options: CreateMapRenderPlanOptions): MapRenderPlan;
export declare function withPlanCamera(plan: MapRenderPlan, camera: MapCameraIntent): MapRenderPlan;
export declare function getRenderPlanRenderableSignatures(plan: MapRenderPlan): Map<string, string>;
export declare function hasRenderableSignatureChanges(previous: MapRenderPlan | null | undefined, next: MapRenderPlan): boolean;
export declare function diffMapRenderPlans(previous: MapRenderPlan | null | undefined, next: MapRenderPlan): MapRenderPlanDiff;
export declare function summarizeMapRenderPlanDiff(diff: MapRenderPlanDiff): Record<string, number>;
export declare function classifyMapRenderPlanChanges(previous: MapRenderPlan, next: MapRenderPlan, diff?: MapRenderPlanDiff): Set<MapIncrementalChangeKind>;
export declare function hasRenderableChanges(diff: MapRenderPlanDiff | null | undefined, predicate: (renderable: MapRenderable) => boolean): boolean;
export declare function hasOverlayRenderableChanges(diff: MapRenderPlanDiff | null | undefined): boolean;
export declare function hasTrackRenderableChanges(diff: MapRenderPlanDiff | null | undefined): boolean;
export declare function resolveRenderedPlaces(places: MapPlace[], overlays: Overlay[]): MapPlace[];
export declare function extractEmbeddedOverlays(places: MapPlace[]): {
    overlays: Overlay[];
    errors: Array<{
        path: string;
        error: string;
    }>;
};
