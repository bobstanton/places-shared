import type * as maplibregl from 'maplibre-gl';
import { hasTrackData } from "../place/index";
import { getPlaceId } from "../track/index";
import { MapPlace } from "../overlay/index";
import { ViewportClusteringManager, createMapCameraGuard, type MapCameraGuard } from "../map/index";
import { type MapRenderRequest, type ResolvedMapConfig } from "../settings/index";
import { CommonMapSettings } from "../services/index";

export interface TrackState {
  place: MapPlace;
  settings: CommonMapSettings;
  trackIndex: number;
  renderSignature: string;
  renderMode?: 'dynamic' | 'indexed' | 'viewport-batch';
}

export class MapState {
  private static instances = new Map<maplibregl.Map, MapState>();

  private visibleTracks = new Map<string, TrackState>();
  private trackCounter = 0;
  private placeMarkers = new Map<string, maplibregl.Marker>();
  private placeMarkerSignatures = new Map<string, string>();
  private currentPlaces: MapPlace[] = [];
  private currentSettings: CommonMapSettings | null = null;
  private currentBlockSettings: ResolvedMapConfig | null = null;
  private currentRenderRequest: MapRenderRequest | null = null;
  private overlaysReady: Promise<void> = Promise.resolve();
  private symbolIconPlaces = new Map<string, MapPlace>();
  private clusteringManager: ViewportClusteringManager<maplibregl.Marker> | null = null;
  private defaultTrackState: 'visible' | 'hidden' = 'hidden';
  private overlayLineLayerCount = 0;
  private embeddedTrackOverlayIndices: number[] = [];
  private placeFilePathToOverlayIndex = new Map<string, number>();
  private visibleGeoJsonOverlays = new Set<number>();
  private cameraGuard: MapCameraGuard | null = null;

  private constructor() {}

  static for(map: maplibregl.Map): MapState {
    let state = MapState.instances.get(map);

    if (!state) {
      state = new MapState();
      MapState.instances.set(map, state);
    }

    return state;
  }

  static cleanup(map: maplibregl.Map): void {
    MapState.instances.delete(map);
  }

  getCameraGuard(): MapCameraGuard {
    if (!this.cameraGuard) {
      this.cameraGuard = createMapCameraGuard();
    }

    return this.cameraGuard;
  }

  getVisibleTracks(): Map<string, TrackState> {
    return this.visibleTracks;
  }

  hasTrack(placeId: string): boolean {
    return this.visibleTracks.has(placeId);
  }

  getTrack(placeId: string): TrackState | undefined {
    return this.visibleTracks.get(placeId);
  }

  setTrack(placeId: string, state: TrackState): void {
    this.visibleTracks.set(placeId, state);
  }

  removeTrack(placeId: string): boolean {
    return this.visibleTracks.delete(placeId);
  }

  getNextTrackIndex(): number {
    return this.trackCounter++;
  }

  getPlaceMarkers(): Map<string, maplibregl.Marker> {
    return this.placeMarkers;
  }

  setPlaceMarker(placeId: string, marker: maplibregl.Marker): void {
    this.placeMarkers.set(placeId, marker);
  }

  getPlaceMarker(placeId: string): maplibregl.Marker | undefined {
    return this.placeMarkers.get(placeId);
  }

  getPlaceMarkerRenderSignature(placeId: string): string | undefined {
    return this.placeMarkerSignatures.get(placeId);
  }

  setPlaceMarkerSignature(placeId: string, signature: string): void {
    this.placeMarkerSignatures.set(placeId, signature);
  }

  deletePlaceMarkerSignature(placeId: string): void {
    this.placeMarkerSignatures.delete(placeId);
  }

  setPlaceMarkerWithSignature(placeId: string, marker: maplibregl.Marker, markerSignature: string): void {
    this.placeMarkers.set(placeId, marker);
    this.placeMarkerSignatures.set(placeId, markerSignature);
  }

  deletePlaceMarkerWithSignature(placeId: string): maplibregl.Marker | undefined {
    const marker = this.placeMarkers.get(placeId);

    this.placeMarkers.delete(placeId);
    this.placeMarkerSignatures.delete(placeId);

    return marker;
  }

  setCurrentPlaces(places: MapPlace[]): void {
    this.currentPlaces = places;
    this.placesById = null;
  }

  getCurrentPlaces(): MapPlace[] {
    return this.currentPlaces;
  }

  private placesById: Map<string, MapPlace> | null = null;

  getPlaceById(placeId: string): MapPlace | undefined {
    if (!this.placesById) {
      this.placesById = new Map(this.currentPlaces.map(place => [getPlaceId(place), place]));
    }

    return this.placesById.get(placeId);
  }

  setCurrentSettings(settings: CommonMapSettings): void {
    this.currentSettings = settings;
  }

  getCurrentSettings(): CommonMapSettings | null {
    return this.currentSettings;
  }

  setCurrentBlockSettings(settings: ResolvedMapConfig): void {
    this.currentBlockSettings = settings;
  }

  getCurrentBlockSettings(): ResolvedMapConfig | null {
    return this.currentBlockSettings;
  }

  setCurrentRenderRequest(request: MapRenderRequest): void { this.currentRenderRequest = request; }
  getCurrentRenderRequest(): MapRenderRequest | null { return this.currentRenderRequest; }

  setOverlaysReady(ready: Promise<void>): void { this.overlaysReady = ready; }
  whenOverlaysReady(): Promise<void> { return this.overlaysReady; }

  setSymbolIconPlaces(entries: Iterable<[string, MapPlace]>): void { this.symbolIconPlaces = new Map(entries); }
  getSymbolIconPlace(imageId: string): MapPlace | undefined { return this.symbolIconPlaces.get(imageId); }

  setClusteringManager(manager: ViewportClusteringManager<maplibregl.Marker> | null): void {
    this.clusteringManager = manager;
  }

  getClusteringManager(): ViewportClusteringManager<maplibregl.Marker> | null {
    return this.clusteringManager;
  }

  setDefaultTrackState(state: 'visible' | 'hidden'): void {
    this.defaultTrackState = state;
  }

  getDefaultTrackState(): 'visible' | 'hidden' {
    return this.defaultTrackState;
  }

  setOverlayLineLayerCount(count: number): void {
    this.overlayLineLayerCount = count;
  }

  getOverlayLineLayerCount(): number {
    return this.overlayLineLayerCount;
  }

  setEmbeddedTrackOverlayIndices(indices: number[]): void {
    this.embeddedTrackOverlayIndices = indices;
  }

  getEmbeddedTrackOverlayIndices(): number[] {
    return this.embeddedTrackOverlayIndices;
  }

  setPlaceFilePathToOverlayIndex(filePath: string, overlayIndex: number): void {
    this.placeFilePathToOverlayIndex.set(filePath, overlayIndex);
  }

  getOverlayIndexForPlace(filePath: string): number | undefined {
    return this.placeFilePathToOverlayIndex.get(filePath);
  }

  isGeoJsonOverlayVisible(overlayIndex: number): boolean {
    return this.visibleGeoJsonOverlays.has(overlayIndex);
  }

  setGeoJsonOverlayVisible(overlayIndex: number, visible: boolean): void {
    if (visible) {
      this.visibleGeoJsonOverlays.add(overlayIndex);
    } else {
      this.visibleGeoJsonOverlays.delete(overlayIndex);
    }
  }
}

export function hasDisplayableContent(place: MapPlace | undefined): place is MapPlace {
  if (!place) return false;

  return !!(place.name || place.icon || place.filePath || hasTrackData(place));
}
