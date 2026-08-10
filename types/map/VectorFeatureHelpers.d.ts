import type * as GeoJSON from 'geojson';
import type { MetricWindow } from '../settings/MetricWindow';
import type { App } from 'obsidian';
import type { MapPlace } from '../Place';
import { type Overlay } from '../overlay/OverlaySystem';
import { TrackColorBy } from '../track/TrackRenderer';
import type { MapRenderRequest } from '../settings/MapConfiguration';
interface QueryRenderedFeaturesMap {
    queryRenderedFeatures(pointOrOptions?: unknown): unknown[];
}
interface MapPointerEvent {
    lngLat: {
        lat: number;
        lng: number;
    };
    point: {
        x: number;
        y: number;
    };
    originalEvent: MouseEvent;
    preventDefault(): void;
}
interface ContextMenuMap extends QueryRenderedFeaturesMap {
    unproject(point: [number, number]): {
        lat: number;
        lng: number;
    };
    jumpTo(options: {
        center: [number, number];
        zoom: number;
    }): void;
    getBounds(): {
        contains(coordinates: [number, number]): boolean;
    } | null | undefined;
    on(event: 'contextmenu', handler: (event: MapPointerEvent) => void): void;
    on(event: 'remove', handler: () => void): void;
}
interface HeatmapInteractionMap {
    querySourceFeatures(sourceId: string, options?: unknown): FeatureLike[];
    project(coordinates: [number, number]): {
        x: number;
        y: number;
    };
    on(event: string, layerId: string, handler: (event: HeatmapClickEvent) => void): void;
    getLayer?(layerId: string): unknown;
    getCanvas(): HTMLCanvasElement;
    fitBounds(bounds: [[number, number], [number, number]], options: {
        padding: number;
        animate: boolean;
    }): void;
}
interface HeatmapClickEvent {
    point: {
        x: number;
        y: number;
    };
    lngLat: unknown;
    originalEvent?: Event & {
        _heatmapClicked?: boolean;
    };
    preventDefault(): void;
}
interface FeatureLike {
    properties?: GeoJSON.GeoJsonProperties;
    geometry?: GeoJSON.Geometry | null;
    layer?: {
        id?: string;
    };
}
export interface DirectionsRouteLookupOptions {
    map: QueryRenderedFeaturesMap;
    container: HTMLElement;
    event: MouseEvent;
    overlays: Overlay[];
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
    clickPoint: {
        x: number;
        y: number;
    };
    thresholdPx?: number;
}
export declare function createGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): GeoJSON.FeatureCollection | null;
export declare function getDirectionsRouteFeatureAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.Feature | null;
export declare function getIsochroneOverlayAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.FeatureCollection | null;
export declare function queryPoiGeometry(options: PoiGeometryQuery): GeoJSON.Geometry | undefined;
export declare function setupVectorContextMenu<TMap extends ContextMenuMap>(options: VectorContextMenuOptions<TMap>): void;
export declare function setupHeatmapInteractions<TMap extends HeatmapInteractionMap>(options: HeatmapInteractionOptions<TMap>): void;
export declare function findClosestPointFeature<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike | null;
export type RouteOverlayFeatureMatch = {
    readonly kind: 'directions';
    readonly feature: GeoJSON.Feature;
} | {
    readonly kind: 'isochrone';
    readonly collection: GeoJSON.FeatureCollection;
};
export declare function classifyRouteOverlayFeature(feature: GeoJSON.Feature, overlayGeoJson?: GeoJSON.GeoJSON): RouteOverlayFeatureMatch | null;
export {};
