import { logger } from '../utils/logger';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { MapPlace } from '../Place';
import { getPlaceId } from '../track/TrackVisibilityResolver';
import { shouldClusterCount } from './ClusteringDecision';

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
  // Omit when individual markers are rendered by native layers (symbol renderer) -
  // the manager then only toggles layer visibility and reports viewport-visible
  // place ids.
  markerFactory?: MarkerFactory<TMarker>;
  // For logging.
  providerName: string;
  // Default: "clusters".
  clusterLayerId?: string;
  // Default: "cluster-count".
  clusterCountLayerId?: string;
  // Hidden while clustering. Default: ["places-markers"].
  markersLayerIds?: string[];
  // Included in the visible point count.
  overlayPointCoordinates?: Coordinate[];
  // Shown when not clustering. Default: none.
  overlayPointsLayerId?: string;
  onClusteringModeChange?: ClusteringModeChangeCallback;
}

const EMPTY_SET = new Set<string>();

export class ViewportClusteringManager<TMarker> {
  private readonly map: ClusteringMap;
  private places: MapPlace[];
  private readonly clusterThreshold: number;
  private readonly markerFactory: MarkerFactory<TMarker> | undefined;
  private readonly providerName: string;
  private readonly clusterLayerId: string;
  private readonly clusterCountLayerId: string;
  private readonly markersLayerIds: string[];
  private overlayPointCoordinates: Coordinate[];
  private readonly overlayPointsLayerId: string | undefined;
  private readonly onClusteringModeChange: ClusteringModeChangeCallback | undefined;
  private readonly markerMap = new Map<string, TMarker>();
  private lastVisiblePlaceIds = new Set<string>();

  private clustersVisible = true;
  private pendingMarkerCreation = 0;
  private pendingClusterCheck = 0;
  private clusterCheckTimer: number | null = null;
  private markerUpdateTimer: number | null = null;
  private destroyed = false;

  private readonly zoomHandler: () => void;
  private readonly moveHandler: () => void;
  private readonly moveEndHandler: () => void;

  constructor(options: ViewportClusteringOptions<TMarker>) {
    this.map = options.map;
    this.places = options.places;
    this.clusterThreshold = options.clusterThreshold;
    this.markerFactory = options.markerFactory;
    this.providerName = options.providerName;
    this.clusterLayerId = options.clusterLayerId ?? 'clusters';
    this.clusterCountLayerId = options.clusterCountLayerId ?? 'cluster-count';
    this.markersLayerIds = options.markersLayerIds ?? ['places-markers'];
    this.overlayPointCoordinates = options.overlayPointCoordinates ?? [];
    this.overlayPointsLayerId = options.overlayPointsLayerId;
    this.onClusteringModeChange = options.onClusteringModeChange;

    this.zoomHandler = () => {
      if (this.pendingClusterCheck) return;
      this.pendingClusterCheck = window.requestAnimationFrame(() => {
        this.pendingClusterCheck = 0;
        this.immediateClusterCheck();
      });
    };
    this.moveHandler = () => this.debouncedClusterCheck();
    this.moveEndHandler = () => this.debouncedClusterCheck();

    this.setupEventListeners();
    this.hideMarkersLayerIfExists();
  }

  getMarkerMap(): Map<string, TMarker> {
    return this.markerMap;
  }

  isClustering(): boolean {
    return this.clustersVisible;
  }

  getVisiblePlaceIds(): Set<string> {
    return this.markerFactory ? new Set(this.markerMap.keys()) : new Set(this.lastVisiblePlaceIds);
  }

  update(): void {
    this.updateClusteringMode();
  }

  updatePlaces(places: MapPlace[], overlayPointCoordinates: Coordinate[] = this.overlayPointCoordinates): void {
    if (this.destroyed) return;
    this.removeAllMarkers();
    this.places = places;
    this.overlayPointCoordinates = overlayPointCoordinates;
    this.updateClusteringMode();
  }

  destroy(): void {
    this.destroyed = true;

    try {
      this.map.off('zoom', this.zoomHandler);
      this.map.off('move', this.moveHandler);
      this.map.off('moveend', this.moveEndHandler);
    } catch (error) {
      this.reportMapStateError('detach map listeners', error);
    }

    if (this.pendingClusterCheck) {
      window.cancelAnimationFrame(this.pendingClusterCheck);
      this.pendingClusterCheck = 0;
    }
    if (this.pendingMarkerCreation) {
      window.cancelAnimationFrame(this.pendingMarkerCreation);
      this.pendingMarkerCreation = 0;
    }
    if (this.clusterCheckTimer) {
      window.clearTimeout(this.clusterCheckTimer);
      this.clusterCheckTimer = null;
    }
    if (this.markerUpdateTimer) {
      window.clearTimeout(this.markerUpdateTimer);
      this.markerUpdateTimer = null;
    }
    this.removeAllMarkers();
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (data) {
      logger.debug(`[${this.providerName} Perf] ${message}`, data);
    } else {
      logger.debug(`[${this.providerName} Perf] ${message}`);
    }
  }

  private setupEventListeners(): void {
    this.map.on('zoom', this.zoomHandler);
    this.map.on('move', this.moveHandler);
    this.map.on('moveend', this.moveEndHandler);
  }

  private hideMarkersLayerIfExists(): void {
    if (this.destroyed) return;
    try {
      this.setMarkersLayersVisibility('none');
    } catch (error) {
      this.reportMapStateError('hide marker layers', error);
    }
  }

  private setMarkersLayersVisibility(visibility: 'visible' | 'none'): void {
    for (const layerId of this.markersLayerIds) {
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }

  private countVisiblePoints(): number {
    const bounds = this.map.getBounds();
    let count = 0;

    for (let i = 0; i < this.places.length; i++) {
      const place = this.places[i];
      if (bounds.contains([place.longitude, place.latitude])) count++;
    }

    for (let i = 0; i < this.overlayPointCoordinates.length; i++) {
      const coord = this.overlayPointCoordinates[i];
      if (bounds.contains([coord.longitude, coord.latitude])) count++;
    }

    return count;
  }

  private switchToClusteringMode(): void {
    this.clustersVisible = true;
    this.map.setLayoutProperty(this.clusterLayerId, 'visibility', 'visible');
    this.map.setLayoutProperty(this.clusterCountLayerId, 'visibility', 'visible');
    this.setMarkersLayersVisibility('none');
    if (this.overlayPointsLayerId && this.map.getLayer(this.overlayPointsLayerId)) {
      this.map.setLayoutProperty(this.overlayPointsLayerId, 'visibility', 'none');
    }
    this.removeAllMarkers();
    this.lastVisiblePlaceIds = new Set();
    if (this.onClusteringModeChange) {
      this.onClusteringModeChange(true, EMPTY_SET);
    }
  }

  private immediateClusterCheck(): void {
    if (this.destroyed) return;
    try {
      const visibleCount = this.countVisiblePoints();
      if (shouldClusterCount(visibleCount, this.clusterThreshold) && !this.clustersVisible) {
        this.switchToClusteringMode();
      }
    } catch (error) {
      this.reportMapStateError('run immediate cluster check', error);
    }
  }

  private debouncedClusterCheck(): void {
    if (this.clusterCheckTimer) window.clearTimeout(this.clusterCheckTimer);
    this.clusterCheckTimer = window.setTimeout(() => this.updateClusteringMode(), 100);
  }

  private updateClusteringMode(): void {
    if (this.destroyed) return;
    try {
      const visibleCount = this.countVisiblePoints();
      const shouldShowClusters = shouldClusterCount(visibleCount, this.clusterThreshold);

      if (shouldShowClusters !== this.clustersVisible) {
        if (shouldShowClusters) {
          this.switchToClusteringMode();
        } else {
          this.clustersVisible = false;

          this.map.setLayoutProperty(this.clusterLayerId, 'visibility', 'none');
          this.map.setLayoutProperty(this.clusterCountLayerId, 'visibility', 'none');

          this.setMarkersLayersVisibility('visible');
          if (this.overlayPointsLayerId && this.map.getLayer(this.overlayPointsLayerId)) {
            this.map.setLayoutProperty(this.overlayPointsLayerId, 'visibility', 'visible');
          }

          this.updateVisibleMarkers();
        }
      } else if (!this.clustersVisible) {
        this.debouncedMarkerUpdate();
      }
    } catch (error) {
      this.reportMapStateError('update clustering mode', error);
    }
  }

  private debouncedMarkerUpdate(): void {
    if (this.markerUpdateTimer) window.clearTimeout(this.markerUpdateTimer);
    this.markerUpdateTimer = window.setTimeout(() => this.updateVisibleMarkers(), 150);
  }

  private updateVisibleMarkers(): void {
    if (this.destroyed || this.clustersVisible) return;

    if (this.pendingMarkerCreation) {
      window.cancelAnimationFrame(this.pendingMarkerCreation);
      this.pendingMarkerCreation = 0;
    }

    const markerFactory = this.markerFactory;

    try {
      const startTime = performance.now();
      const bounds = this.map.getBounds();

      const BUFFER = 0.1;
      const latBuffer = (bounds.getNorth() - bounds.getSouth()) * BUFFER;
      const lngBuffer = (bounds.getEast() - bounds.getWest()) * BUFFER;

      const visiblePlaceIds = new Set<string>();
      const placesToCreate: Array<{ place: MapPlace; placeId: string; index: number }> = [];

      for (let i = 0; i < this.places.length; i++) {
        const place = this.places[i];
        const placeId = getPlaceId(place);

        const inBufferedViewport =
          place.longitude >= bounds.getWest() - lngBuffer &&
          place.longitude <= bounds.getEast() + lngBuffer &&
          place.latitude >= bounds.getSouth() - latBuffer &&
          place.latitude <= bounds.getNorth() + latBuffer;

        if (inBufferedViewport) {
          // Hidden icons never become markers and are not reported as visible
          // (track auto-show follows visible markers).
          const iconStyle = place?.iconStyle;
          const isHidden = iconStyle?.opacity === 0 ||
            iconStyle?.inlineCss?.toLowerCase().includes('display: none');
          if (isHidden) continue;

          visiblePlaceIds.add(placeId);

          if (markerFactory && !this.markerMap.has(placeId)) {
            placesToCreate.push({ place, placeId, index: i });
          }
        }
      }

      // No factory: the native layer already shows every marker; track visibility follows the in-view report.
      if (!markerFactory) {
        this.lastVisiblePlaceIds = visiblePlaceIds;
        if (this.onClusteringModeChange) {
          this.onClusteringModeChange(false, this.getVisiblePlaceIds());
        }
        return;
      }

      let removedCount = 0;
      for (const [placeId, marker] of this.markerMap) {
        if (!visiblePlaceIds.has(placeId)) {
          markerFactory.removeMarker(marker);
          this.markerMap.delete(placeId);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        this.log(`updateVisibleMarkers: removed ${removedCount} markers, total: ${this.markerMap.size}`);
      }

      if (placesToCreate.length > 0) {
        this.log(`Scheduling ${placesToCreate.length} markers for creation (removed: ${removedCount})`);

        const BATCH_SIZE = 20;
        let createIndex = 0;

        const createBatch = () => {
          if (this.destroyed || this.clustersVisible) {
            this.pendingMarkerCreation = 0;
            return;
          }

          const batchEnd = Math.min(createIndex + BATCH_SIZE, placesToCreate.length);
          try {
            for (let i = createIndex; i < batchEnd; i++) {
              const { place, placeId, index } = placesToCreate[i];
              if (!this.markerMap.has(placeId)) {
                const marker = markerFactory.createMarker(place, index);
                this.markerMap.set(placeId, marker);
              }
            }
          } catch (error) {
            // Later ticks run outside the caller's try/catch; if the map was
            // torn down mid-batch, stop the chain instead of crashing each frame.
            this.log(`Marker creation failed mid-batch, stopping: ${String(error)}`);
            this.pendingMarkerCreation = 0;
            return;
          }
          createIndex = batchEnd;

          if (createIndex < placesToCreate.length) {
            this.pendingMarkerCreation = window.requestAnimationFrame(createBatch);
          } else {
            this.pendingMarkerCreation = 0;
            const elapsed = performance.now() - startTime;
            this.log(`updateVisibleMarkers complete: ${elapsed.toFixed(2)}ms (created: ${placesToCreate.length}, removed: ${removedCount}, total: ${this.markerMap.size})`);
            if (this.onClusteringModeChange) {
              this.onClusteringModeChange(false, this.getVisiblePlaceIds());
            }
          }
        };

        this.pendingMarkerCreation = window.requestAnimationFrame(createBatch);
      } else if (removedCount > 0 || !this.clustersVisible) {
        if (this.onClusteringModeChange) {
          this.onClusteringModeChange(false, this.getVisiblePlaceIds());
        }
      }
    } catch (error) {
      this.reportMapStateError('update visible markers', error);
    }
  }

  private reportMapStateError(operation: string, error: unknown): void {
    if (!this.destroyed) {
      logger.warn(`[${this.providerName}] Failed to ${operation}`, error);
    }
  }

  private removeAllMarkers(): void {
    if (this.pendingMarkerCreation) {
      window.cancelAnimationFrame(this.pendingMarkerCreation);
      this.pendingMarkerCreation = 0;
    }

    const count = this.markerMap.size;
    if (count > 0 && this.markerFactory) {
      for (const marker of this.markerMap.values()) {
        this.markerFactory.removeMarker(marker);
      }
      this.markerMap.clear();
      this.log(`removeAllMarkers: removed ${count} markers`);
    }
  }
}
