import { App } from "obsidian";
import type { MetricWindow } from '../settings/MetricWindow';
import { MapPlace } from "../Place";
import type { } from "../Units";
import type { TrackColorBy } from "../track/TrackRenderer";
import { renderMapSupplementalError } from "../utils/Utilities";
import type { PerformanceMonitor } from "../utils/PerformanceMonitor";
import { type Coordinate } from "../geo/DistanceCalculator";
import type { MapRenderRequest, ResolvedMapConfig } from "../settings/MapConfiguration";
import type { TrackVisibilityResult } from "../track/TrackVisibilityResolver";
import { createFrequencyPopup as createFrequencyPopupImpl } from "../map/FrequencyPopupBuilder";
import { IMapBlockProcessor, MapControlHandle, MapDataUpdateContext, MapDataUpdateResult, type MapIncrementalUpdateCapabilities } from "./IMapBlockProcessor";

export interface CommonMapSettings {
  trackColorBy?: TrackColorBy;
  trackOutline?: boolean; // Show outline around track lines (undefined = auto based on coloring)
  trackGradeWindow: MetricWindow;
  trackSpeedWindow: MetricWindow;
  showLabels: boolean;
  trackDefaultVisibility?: 'visible' | 'hidden';
  poiDiscovery?: boolean; // Enable clicking on base map POIs (vector tiles only)
  // Handler for declarative per-place popup actions (MapPlace.actions).
  onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void;
  // Host-owned place-note creation; absent = omit create-note affordances.
  placeNoteHost?: MapRenderRequest['runtime']['placeNoteHost'];
  // Host-owned reverse geocoding; absent = omit the affordance.
  reverseGeocodeHost?: MapRenderRequest['runtime']['reverseGeocodeHost'];
  inspectTrack?: MapRenderRequest['runtime']['inspectTrack'];
  trackDetails: ResolvedMapConfig['trackDetails'];
  // Pre-computed track visibility and styling (set by main processor, used by providers)
  trackVisibility: TrackVisibilityResult;
  // Present when a `debug:` mode is on: append the popup debug section.
  popupDebug?: MapRenderRequest['runtime']['popupDebug'];
}

// No library dependencies.
export abstract class MapBlockProcessorBase implements IMapBlockProcessor {
  protected app?: App;
  protected developerMode = false;

  abstract processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): void | Promise<void>;

  cleanup(): void {
  }

  updateMapData(_container: HTMLElement, _places: MapPlace[], _request: MapRenderRequest, _context?: MapDataUpdateContext): Promise<MapDataUpdateResult> {
    return Promise.resolve({ updated: false, status: 'requires-rebuild', reason: 'provider does not support in-place map data updates' });
  }

  getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities> {
    return {
      places: false,
      overlays: false,
      styles: false,
      tools: false,
      clustering: false,
      terrain: false };
  }

  protected getMapDataUpdateIneligibleReason(blockSettings: ResolvedMapConfig): string | null {
    if (blockSettings.heatmapLayer) {
      return 'heatmap enabled';
    }

    return null;
  }

  getCurrentPlaces(_container: HTMLElement): MapPlace[] | null {
    return null;
  }

  getMapControlHandle(_container: HTMLElement): MapControlHandle | null {
    return null;
  }

  protected createFrequencyPopup(frequency: number, contributingFiles: string[]): HTMLElement {
    return createFrequencyPopupImpl({ frequency, contributingFiles, app: this.app });
  }

  protected measureIf<T>(perf: PerformanceMonitor | undefined, event: string, work: () => T, details?: Record<string, unknown>, options?: { slowOnly?: boolean; thresholdMs?: number }): T {
    return perf ? perf.measure(event, work, details, options) : work();
  }

  protected getMinZoom(blockSettings: ResolvedMapConfig): number {
    const value = blockSettings.minZoom;
    return typeof value === 'number' && Number.isFinite(value) ? value : 3;
  }

  protected extractCommonSettings(blockSettings: ResolvedMapConfig, runtime: MapRenderRequest['runtime']): CommonMapSettings {
    return {
      trackColorBy: blockSettings.trackColorBy,
      trackOutline: blockSettings.trackOutline,
      trackGradeWindow: blockSettings.trackGradeWindow,
      trackSpeedWindow: blockSettings.trackSpeedWindow,
      showLabels: blockSettings.showLabels,
      trackDefaultVisibility: blockSettings.trackDefaultVisibility,
      poiDiscovery: blockSettings.poiDiscovery,
      trackVisibility: runtime.trackVisibility,
      onPlaceAction: runtime.onPlaceAction,
      placeNoteHost: runtime.placeNoteHost,
      reverseGeocodeHost: runtime.reverseGeocodeHost,
      inspectTrack: runtime.inspectTrack,
      trackDetails: blockSettings.trackDetails,
      popupDebug: runtime.popupDebug };
  }

  // Individual providers (like MapLibreProviderBase) implement their own overlay logic.
  protected async processOverlays(_map: unknown, _mapContainer: HTMLElement, _request: MapRenderRequest, _places: MapPlace[]): Promise<void> {
  }

  protected getOverlayLocation(places: MapPlace[]): Coordinate | null {
    if (places.length === 0) return null;

    return {
      latitude: places[0].latitude,
      longitude: places[0].longitude
    };
  }

  protected showOverlayError(container: HTMLElement, message: string): void {
    renderMapSupplementalError(container, {
      icon: "\u26A0\uFE0F",
      title: message,
      className: "overlay-error-inline"
    });
  }

}
