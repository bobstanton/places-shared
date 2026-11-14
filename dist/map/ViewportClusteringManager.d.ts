import type { Coordinate } from '../geo/DistanceCalculator';
import type { MapPlace } from '../Place';
export interface ClusteringBounds {
    getNorth(): number;
    getSouth(): number;
    getEast(): number;
    getWest(): number;
    contains(lngLat: [number, number]): boolean;
}
export interface ClusteringMap {
    getBounds(): ClusteringBounds;
    setLayoutProperty(layerId: string, property: string, value: string): void;
    getLayer(layerId: string): unknown;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler: (...args: unknown[]) => void): void;
    getZoom?(): number;
    getMaxZoom?(): number;
}
export interface MarkerFactory<TMarker> {
    createMarker(place: MapPlace, index: number): TMarker;
    removeMarker(marker: TMarker): void;
}
export type ClusteringModeChangeCallback = (isClustering: boolean, visiblePlaceIds: Set<string>) => void;
export interface ViewportClusteringOptions<TMarker> {
    map: ClusteringMap;
    places: MapPlace[];
    clusterThreshold: number;
    markerFactory?: MarkerFactory<TMarker>;
    providerName: string;
    clusterLayerId?: string;
    clusterCountLayerId?: string | null;
    markersLayerIds?: string[];
    overlayPointCoordinates?: Coordinate[];
    overlayPointsLayerId?: string;
    getPlaceSignature?: (place: MapPlace) => string;
    onClusteringModeChange?: ClusteringModeChangeCallback;
}
export declare class ViewportClusteringManager<TMarker> {
    private readonly map;
    private places;
    private readonly clusterThreshold;
    private readonly markerFactory;
    private readonly providerName;
    private readonly clusterLayerIds;
    private readonly markersLayerIds;
    private overlayPointCoordinates;
    private readonly overlayPointsLayerId;
    private readonly onClusteringModeChange;
    private readonly getPlaceSignature;
    private readonly markerMap;
    private readonly markerSignatures;
    private lastVisiblePlaceIds;
    private clustersVisible;
    private modeInitialized;
    private pendingMarkerCreation;
    private pendingClusterCheck;
    private clusterCheckTimer;
    private markerUpdateTimer;
    private destroyed;
    private readonly zoomHandler;
    private readonly moveHandler;
    private readonly moveEndHandler;
    constructor(options: ViewportClusteringOptions<TMarker>);
    getMarkerMap(): Map<string, TMarker>;
    isClustering(): boolean;
    getVisiblePlaceIds(): Set<string>;
    update(): void;
    updatePlaces(places: MapPlace[], overlayPointCoordinates?: Coordinate[]): void;
    private retireMarkers;
    destroy(): void;
    private log;
    private setupEventListeners;
    private hideMarkersLayerIfExists;
    private setMarkersLayersVisibility;
    private setLayersVisibility;
    private countVisiblePoints;
    private switchToClusteringMode;
    private immediateClusterCheck;
    private shouldCluster;
    private atMaximumZoom;
    private debouncedClusterCheck;
    private updateClusteringMode;
    private debouncedMarkerUpdate;
    private updateVisibleMarkers;
    private reportMapStateError;
    private removeAllMarkers;
}
