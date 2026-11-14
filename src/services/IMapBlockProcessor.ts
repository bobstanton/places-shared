import { MapPlace } from "../Place";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";
import type { MapCameraIntent, MapRenderPlan, MapRenderPlanDiff } from "../render/MapRenderPlan";
import type { MapRenderRequest } from "../settings/MapConfiguration";
import type { Coordinate } from "../geo/DistanceCalculator";

export type MapCameraApplyResult =
  | { applied: true }
  | { applied: false; reason: string };

export type MapDataUpdateResult =
  | { updated: true }
  | { updated: false; status: 'requires-rebuild' | 'temporarily-unavailable'; reason: string };

export interface MapIncrementalUpdateCapabilities {
  places: boolean;
  overlays: boolean;
  styles: boolean;
  tools: boolean;
  clustering: boolean;
  terrain: boolean;
}

export interface MapDataUpdateContext {
  previousPlan?: MapRenderPlan | null;
  nextPlan?: MapRenderPlan | null;
  planDiff?: MapRenderPlanDiff | null;
}

export interface IMapBlockProcessor {
  // Once this resolves, any supported control handle must be available synchronously through getMapControlHandle().
  processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): void | Promise<void>;
  cleanup(): void;
  updateMapData(container: HTMLElement, places: MapPlace[], request: MapRenderRequest, context?: MapDataUpdateContext): Promise<MapDataUpdateResult>;
  // Declares which semantic plan changes this provider can apply without rebuilding its map instance.
  getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities>;
  getCurrentPlaces(container: HTMLElement): MapPlace[] | null;
  // Stable identity for one live map and its control capabilities. A replacement
  // map returns a new handle so surfaces can dispose and rebind their controls.
  getMapControlHandle?(container: HTMLElement): MapControlHandle | null;
  // An empty array clears the markers and exits focus mode.
  setGeocodingSearchMarkers?(places: MapPlace[], container: HTMLElement): void;
  // Apply a camera intent to the live map post-creation. 'fit-data' fits the
  // provider's current data bounds (places + overlays); 'preserve' restores the
  // saved viewport if one exists, otherwise no-ops; 'explicit' jumps. Absent on
  // providers that predate the reconciler.
  applyCamera?(container: HTMLElement, camera: MapCameraIntent, request: MapRenderRequest): MapCameraApplyResult;
  // True when this provider can toggle whole-marker visibility on the live map
  // via a filter, without rebuilding markers. Native GL symbol markers support
  // this; HTML markers and Leaflet do not.
  readonly supportsLiveMarkerVisibility?: boolean;
  // Hide the given placeIds on the live map (empty array shows all). Composed
  // over the base marker/label filters: icon and label hide together. A no-op
  // when the native symbol layer is not the active renderer.
  applyMarkerVisibility?(container: HTMLElement, hiddenPlaceIds: readonly string[]): void;
}

export interface MapViewState {
  bounds: PlacesBoundingBox;
  center: Coordinate;
  zoom: number;
  bearing: number;
  pitch: number;
  width: number;
  height: number;
}

export interface MapControlHandle {
  getBounds?: () => PlacesBoundingBox;
  getViewState?: () => MapViewState;
  onBoundsChanged?: (listener: () => void) => () => void;
  centerOnPlace?: (place: MapPlace) => void;
  highlightPlace?: (place: MapPlace) => void;
  clearHighlight?: () => void;
  setGeocodingSearchMarkers?: (places: MapPlace[]) => void;
  setDevicePositionControl?: (button: HTMLButtonElement | null) => void;
}
