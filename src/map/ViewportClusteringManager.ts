import { logger } from '../utils/logger';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { MapPlace } from '../Place';
import { getPlaceId } from '../track/TrackVisibilityResolver';
import { hasPlaceMarker } from './NonInteractivePlace';
import { shouldClusterCount } from './ClusteringDecision';

const SLOW_VIEWPORT_MS = 8;
const MAXIMUM_ZOOM_TOLERANCE = 1e-6;

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

const EMPTY_SET = new Set<string>();

export class ViewportClusteringManager<TMarker> {
  private readonly map: ClusteringMap;
  private places: MapPlace[];
  private readonly clusterThreshold: number;
  private readonly markerFactory: MarkerFactory<TMarker> | undefined;
  private readonly providerName: string;
  private readonly clusterLayerIds: string[];
  private readonly markersLayerIds: string[];
  private overlayPointCoordinates: Coordinate[];
  private readonly overlayPointsLayerId: string | undefined;
  private readonly onClusteringModeChange: ClusteringModeChangeCallback | undefined;
  private readonly getPlaceSignature: ((place: MapPlace) => string) | undefined;
  private readonly markerMap = new Map<string, TMarker>();
  private readonly markerSignatures = new Map<string, string>();
  private lastVisiblePlaceIds = new Set<string>();

  private clustersVisible = true;
  private modeInitialized = false;
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
    const clusterCountLayerId = options.clusterCountLayerId === undefined ? 'cluster-count' : options.clusterCountLayerId;

    this.clusterLayerIds = [options.clusterLayerId ?? 'clusters', ...(clusterCountLayerId ? [clusterCountLayerId] : [])];
    this.markersLayerIds = options.markersLayerIds ?? ['places-markers'];
    this.overlayPointCoordinates = options.overlayPointCoordinates ?? [];
    this.overlayPointsLayerId = options.overlayPointsLayerId;
    this.getPlaceSignature = options.getPlaceSignature;
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
    this.retireMarkers(places);
    this.places = places;
    this.overlayPointCoordinates = overlayPointCoordinates;
    this.updateClusteringMode();
  }

  private retireMarkers(places: MapPlace[]): void {
    const signature = this.getPlaceSignature;
    const markerFactory = this.markerFactory;

    if (!signature || !markerFactory) {
      this.removeAllMarkers();

      return;
    }

    if (this.pendingMarkerCreation) {
      window.cancelAnimationFrame(this.pendingMarkerCreation);
      this.pendingMarkerCreation = 0;
    }

    const next = new Map<string, string>();

    for (const place of places) {
      if (hasPlaceMarker(place)) next.set(getPlaceId(place), signature(place));
    }

    let removed = 0;

    for (const [placeId, marker] of [...this.markerMap]) {
      if (next.get(placeId) !== undefined && next.get(placeId) === this.markerSignatures.get(placeId)) continue;
      markerFactory.removeMarker(marker);
      this.markerMap.delete(placeId);
      this.markerSignatures.delete(placeId);
      removed++;
    }

    if (removed > 0) this.log(`retireMarkers: removed ${removed} changed markers, kept ${this.markerMap.size}`);
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
    this.setLayersVisibility(this.markersLayerIds, visibility);
  }

  private setLayersVisibility(layerIds: readonly string[], visibility: 'visible' | 'none'): void {
    for (const layerId of layerIds) {
      if (this.map.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  }

  private countVisiblePoints(): number {
    const bounds = this.map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const wrapped = west > east;
    let count = 0;

    for (let i = 0; i < this.places.length; i++) {
      const place = this.places[i];

      if (!hasPlaceMarker(place)) continue;

      if (wrapped ? bounds.contains([place.longitude, place.latitude])
        : place.longitude >= west && place.longitude <= east && place.latitude >= south && place.latitude <= north) count++;
    }

    for (let i = 0; i < this.overlayPointCoordinates.length; i++) {
      const coord = this.overlayPointCoordinates[i];

      if (wrapped ? bounds.contains([coord.longitude, coord.latitude])
        : coord.longitude >= west && coord.longitude <= east && coord.latitude >= south && coord.latitude <= north) count++;
    }

    return count;
  }

  private switchToClusteringMode(): void {
    this.modeInitialized = true;
    this.clustersVisible = true;
    this.setLayersVisibility(this.clusterLayerIds, 'visible');
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

      if (this.shouldCluster(visibleCount) && (!this.modeInitialized || !this.clustersVisible)) {
        this.switchToClusteringMode();
      }
    } catch (error) {
      this.reportMapStateError('run immediate cluster check', error);
    }
  }

  private shouldCluster(visibleCount: number): boolean {
    return shouldClusterCount(visibleCount, this.clusterThreshold) && !this.atMaximumZoom();
  }

  private atMaximumZoom(): boolean {
    const zoom = this.map.getZoom?.();
    const maxZoom = this.map.getMaxZoom?.();

    return zoom !== undefined && maxZoom !== undefined && Number.isFinite(maxZoom) && zoom >= maxZoom - MAXIMUM_ZOOM_TOLERANCE;
  }

  private debouncedClusterCheck(): void {
    if (this.clusterCheckTimer) window.clearTimeout(this.clusterCheckTimer);
    this.clusterCheckTimer = window.setTimeout(() => this.updateClusteringMode(), 100);
  }

  private updateClusteringMode(): void {
    if (this.destroyed) return;

    try {
      const countStarted = performance.now();
      const visibleCount = this.countVisiblePoints();
      const countMs = performance.now() - countStarted;

      if (countMs >= SLOW_VIEWPORT_MS) {
        this.log('viewport count slow', { countMs: Math.round(countMs * 10) / 10, places: this.places.length, overlayPoints: this.overlayPointCoordinates.length, visibleCount });
      }

      const shouldShowClusters = this.shouldCluster(visibleCount);

      if (!this.modeInitialized || shouldShowClusters !== this.clustersVisible) {
        this.log('clustering mode resolved', {
          mode: shouldShowClusters ? 'cluster' : 'marker',
          visibleCount,
          clusterThreshold: this.clusterThreshold,
          places: this.places.length,
          overlayPoints: this.overlayPointCoordinates.length,
          atMaximumZoom: this.atMaximumZoom(),
          initial: !this.modeInitialized,
        });
      }

      if (!this.modeInitialized || shouldShowClusters !== this.clustersVisible) {
        if (shouldShowClusters) {
          this.switchToClusteringMode();
        } else {
          this.modeInitialized = true;
          this.clustersVisible = false;

          this.setLayersVisibility(this.clusterLayerIds, 'none');
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
      const west = bounds.getWest() - lngBuffer;
      const east = bounds.getEast() + lngBuffer;
      const south = bounds.getSouth() - latBuffer;
      const north = bounds.getNorth() + latBuffer;

      const visiblePlaceIds = new Set<string>();
      const placesToCreate: Array<{ place: MapPlace; placeId: string; index: number }> = [];

      for (let i = 0; i < this.places.length; i++) {
        const place = this.places[i];

        if (!hasPlaceMarker(place)) continue;
        if (place.longitude < west || place.longitude > east || place.latitude < south || place.latitude > north) continue;

        const iconStyle = place?.iconStyle;
        const isHidden = iconStyle?.opacity === 0 ||
          iconStyle?.inlineCss?.toLowerCase().includes('display: none');

        if (isHidden) continue;

        const placeId = getPlaceId(place);

        visiblePlaceIds.add(placeId);

        if (markerFactory && !this.markerMap.has(placeId)) {
          placesToCreate.push({ place, placeId, index: i });
        }
      }

      if (!markerFactory) {
        const selectMs = performance.now() - startTime;

        if (selectMs >= SLOW_VIEWPORT_MS) {
          this.log('viewport marker selection slow', { selectMs: Math.round(selectMs * 10) / 10, places: this.places.length, visible: visiblePlaceIds.size });
        }

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
          this.markerSignatures.delete(placeId);
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
                if (this.getPlaceSignature) this.markerSignatures.set(placeId, this.getPlaceSignature(place));
              }
            }
          } catch (error) {
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
      this.markerSignatures.clear();
      this.log(`removeAllMarkers: removed ${count} markers`);
    }
  }
}
