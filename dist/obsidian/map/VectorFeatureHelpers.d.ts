import type * as GeoJSON from 'geojson';
import { type MetricWindow } from '../../settings/index';
import type { App } from 'obsidian';
import type { MapPlace } from '../../place/index';
import { type Overlay } from '../../overlay/index';
import { TrackColorBy } from '../../track/index';
import type { MapRenderRequest } from '../../settings/index';
import { MapContextMenu } from './MapContextMenu';
export { classifyRouteOverlayFeature, isDirectionsRouteLineFeature, isIsochroneFeature, type RouteOverlayFeatureMatch } from '../../map/index';
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
    clickPoint: {
        x: number;
        y: number;
    };
    thresholdPx?: number;
}
export declare function createGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow?: MetricWindow): GeoJSON.FeatureCollection | null;
export declare function prepareGradientColoredGeoJson(place: MapPlace, colorBy: TrackColorBy, gradeWindow: MetricWindow, speedWindow: MetricWindow | undefined, signal: AbortSignal): Promise<GeoJSON.FeatureCollection | null>;
export declare function getDirectionsRouteFeatureAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.Feature | null;
export declare function getIsochroneOverlayAtEvent(options: DirectionsRouteLookupOptions): GeoJSON.FeatureCollection | null;
export declare function queryPoiGeometry(options: PoiGeometryQuery): GeoJSON.Geometry | undefined;
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
export declare function createMapContextMenu(options: MapContextMenuItemsOptions): MapContextMenu;
export declare function setupVectorContextMenu<TMap extends ContextMenuMap>(options: VectorContextMenuOptions<TMap>): void;
export declare function setupHeatmapInteractions<TMap extends HeatmapInteractionMap>(options: HeatmapInteractionOptions<TMap>): void;
export declare function findPointFeaturesWithin<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike[];
export declare function findClosestPointFeature<TMap extends Pick<HeatmapInteractionMap, 'project'>>(options: ClosestPointFeatureOptions<TMap>): FeatureLike | null;
