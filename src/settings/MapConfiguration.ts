import type { CachePolicy } from './CachePolicy';
import type { MetricWindow } from './MetricWindow';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { MapPlace } from '../Place';
import type { Overlay } from '../overlay/OverlaySystem';
import type { TrackColorBy } from '../track/TrackRenderer';
import type { TrackVisibilityResult } from '../track/TrackVisibilityResolver';
import type { MapCameraIntent } from '../render/MapRenderPlan';
import type { TerrainDemSpec, TerrainExaggeration, HillshadeMethod, ColorReliefStop } from '../map/TerrainDem';
import type { PlaceNoteHost } from '../map/PlaceNoteRequest';
import type { } from '../Units';
import type { TrackData } from '../geo/TrackTypes';
import type { MapTrackSelection } from '../map/TrackSelection';

export type MapLegendPosition = 'hidden' | 'top' | 'bottom';
export type MarkerRendererKind = 'native' | 'html';
export type RouteTravelModeName = 'drive' | 'walk' | 'bike';
export type RouteMetricLabelMode = 'total' | 'legs' | 'both' | 'none';
export type TrackDetailsDisplay = 'popup' | 'panel';

export interface TrackBuilderConfig {
  readonly id?: string;
  readonly name?: string;
  // Existing track files or track notes used to seed this builder, in export order.
  readonly tracks: readonly string[];
  // Maximum distance each input point may move to the routing network.
  readonly snapRadiusMeters?: number;
  // Prevent connections between features whose bridge, tunnel, layer, or level metadata differ.
  readonly respectGradeSeparation: boolean;
  readonly selectableLayers: readonly string[];
}

// Authored under the group's nested `style:` node.
export interface DirectionsStyle {
  readonly color?: string;
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
}

export interface DirectionsDefinition {
  readonly kind: 'directions';
  readonly name?: string;
  readonly provider?: string;
  // false skips this group (no route request). Takes {parameter.*}. Default true.
  readonly visible: boolean;
  readonly mode: RouteTravelModeName;
  readonly routes: readonly DirectionsRouteDefinition[];
  readonly optimize: boolean;
  readonly traffic: boolean;
  readonly cache: CachePolicy;
  readonly metricLabels: RouteMetricLabelMode;
  readonly labelTemplate?: string;
  readonly legLabelTemplate?: string;
  readonly waypointLabelTemplate?: string;
  readonly style?: DirectionsStyle;
}

export type DirectionsRouteDefinition =
  | { readonly kind: 'waypoints'; readonly waypoints: readonly string[] }
  | { readonly kind: 'query'; readonly query: string };

export interface IsochroneRange {
  // Normalized value: minutes for time ranges, meters for distance ranges.
  readonly value: number;
  readonly type: 'time' | 'distance';
}

// Authored under the group's nested `style:` node.
export interface IsochroneStyle {
  readonly colors?: readonly string[];
  readonly strokeWidth?: number;
  readonly strokeOpacity?: number;
  readonly fillOpacity?: number;
}

export interface IsochroneDefinition {
  readonly kind: 'isochrone';
  readonly name?: string;
  readonly provider?: string;
  // false skips this group (no isochrone request). Takes {parameter.*}. Default true.
  readonly visible: boolean;
  readonly mode: RouteTravelModeName;
  readonly centers: readonly string[];
  readonly ranges: readonly IsochroneRange[];
  readonly polygons: boolean;
  readonly traffic: boolean;
  readonly cache: CachePolicy;
  readonly style?: IsochroneStyle;
  readonly minZoom?: number;
  readonly maxZoom?: number;
}

// Validated values supplied by a user-facing or programmatic configuration layer.
export interface MapConfigPatch {
  readonly height?: string;
  readonly width?: string;
  readonly mapProvider?: string;
  readonly style?: string;
  readonly initialZoom?: number;
  readonly initialCenter?: readonly [number, number];
  readonly minZoom?: number;
  readonly showLabels?: boolean;
  readonly trackDirectionArrows?: number;
  readonly labelTemplate?: string;
  // Marker rotation: a number of degrees, or a per-place template resolving to one.
  readonly iconRotation?: string;
  readonly trackColorBy?: TrackColorBy;
  readonly trackOutline?: boolean;
  readonly trackDefaultVisibility?: 'visible' | 'hidden';
  readonly trackGradeWindow?: MetricWindow;
  readonly trackSpeedWindow?: MetricWindow;
  readonly legend?: MapLegendPosition;
  readonly query?: string;
  readonly dataview?: string;
  readonly embeddedPlaces?: string;
  readonly linkedPlaces?: string;
  readonly radius?: string;
  readonly routeProvider?: string;
  readonly directions?: readonly DirectionsDefinition[];
  readonly isochrones?: readonly IsochroneDefinition[];
  readonly routeLabelTemplate?: string;
  readonly metricLabels?: RouteMetricLabelMode;
  readonly legLabelTemplate?: string;
  readonly waypointLabelTemplate?: string;
  readonly trackLabelsStart?: string;
  readonly trackLabelsMidpoint?: string;
  readonly trackLabelsEnd?: string;
  readonly trackLabelsVisibility?: string;
  readonly trackDetails?: TrackDetailsDisplay;
  readonly css?: string;
  readonly iconStyles?: string | readonly string[];
  readonly labelStyles?: string | readonly string[];
  readonly poiDiscovery?: boolean;
  readonly pitch?: boolean;
  // DEM source for 3D terrain: a provider name (mapbox, maptiler), `aws`, or a tile URL template. Set = terrain on.
  readonly terrainProvider?: string;
  // DEM source for the hillshade and color-relief layers only, never the 3D mesh.
  // Same accepted forms as terrainProvider. Overrides terrainProvider's DEM for relief.
  readonly reliefProvider?: string;
  // 3D-terrain vertical exaggeration: a constant factor or a zoom curve of `@z` stops.
  readonly terrainExaggeration?: TerrainExaggeration;
  // Hillshade (shaded relief) strength, 0-1. On automatically with terrainProvider; 0 disables. DEM from terrainProvider, else the map provider's own.
  readonly hillshadeIntensity?: number;
  // Color-relief (elevation tint) opacity, 0-1. On automatically with terrainProvider; 0 disables. DEM from terrainProvider, else the map provider's own.
  readonly colorReliefOpacity?: number;
  // Color-relief elevation->color ramp. Unset uses the default hypsometric tint.
  readonly colorReliefColors?: readonly ColorReliefStop[];
  readonly hillshadeMethod?: HillshadeMethod;
  // Hillshade illumination (light) direction in degrees, 0-359.
  readonly hillshadeDirection?: number;
  // Hillshade shadow color (slopes facing away from the light).
  readonly hillshadeShadowColor?: string;
  // Hillshade highlight color (slopes facing the light).
  readonly hillshadeHighlightColor?: string;
  // Hillshade accent color (steep slopes).
  readonly hillshadeAccentColor?: string;
  readonly debug?: boolean;
  readonly poiFilterPatterns?: readonly string[];
  readonly heatmapLayer?: boolean;
  readonly heatmapColorScheme?: string;
  readonly markerRenderer?: MarkerRendererKind;
  readonly clusteringEnabled?: boolean;
  readonly clusterThreshold?: number;
  readonly clusterGeoJsonOverlays?: boolean;
  readonly trackBuilder?: TrackBuilderConfig;
  // Extension-owned map tool configuration, keyed by registered tool id.
  readonly tools?: Readonly<Record<string, unknown>>;
  // Block-only fields (read from blockSettings, not layered from global/provider).
  readonly location?: string;
  readonly selectionParameter?: string;
  readonly selectionPointParameter?: string;
  readonly selectionChannel?: string;
  readonly showHelpWithEmptyMap?: boolean;
}

// A block's own settings: the parsed block-layer `MapConfigPatch` with coded defaults applied.
// Mutable because badge CSS is appended to `css` in place during style processing.
export type MapBlockSettings = { -readonly [K in keyof MapConfigPatch]: MapConfigPatch[K] };

// No raw YAML or runtime state is permitted here.
export interface ResolvedMapConfig {
  readonly height: string;
  readonly width: string;
  readonly mapProvider: string;
  readonly style: string;
  readonly initialZoom?: number;
  readonly initialCenter?: readonly [number, number];
  readonly minZoom?: number;
  readonly showLabels: boolean;
  readonly trackDirectionArrows: number;
  readonly labelTemplate?: string;
  // Marker rotation: a number of degrees, or a per-place template resolving to one.
  readonly iconRotation?: string;
  readonly trackColorBy?: TrackColorBy;
  readonly trackOutline?: boolean;
  readonly trackDefaultVisibility?: 'visible' | 'hidden';
  readonly trackGradeWindow: MetricWindow;
  readonly trackSpeedWindow: MetricWindow;
  readonly legend: MapLegendPosition;
  readonly query?: string;
  readonly dataview?: string;
  readonly embeddedPlaces?: string;
  readonly linkedPlaces?: string;
  readonly radius?: string;
  readonly routeProvider?: string;
  readonly directions: readonly DirectionsDefinition[];
  readonly isochrones: readonly IsochroneDefinition[];
  readonly routeLabelTemplate?: string;
  readonly metricLabels?: RouteMetricLabelMode;
  readonly legLabelTemplate?: string;
  readonly waypointLabelTemplate?: string;
  readonly trackLabelsStart?: string;
  readonly trackLabelsMidpoint?: string;
  readonly trackLabelsEnd?: string;
  readonly trackLabelsVisibility?: string;
  readonly trackDetails: TrackDetailsDisplay;
  readonly css: string;
  readonly iconStyles?: string | readonly string[];
  readonly labelStyles?: string | readonly string[];
  readonly poiDiscovery: boolean;
  readonly pitch: boolean;
  // DEM source for 3D terrain: a provider name (mapbox, maptiler), `aws`, or a tile URL template. Set = terrain on.
  readonly terrainProvider: string;
  // DEM source for the hillshade and color-relief layers only, never the 3D mesh.
  // Same accepted forms as terrainProvider. Overrides terrainProvider's DEM for relief.
  readonly reliefProvider: string;
  // 3D-terrain vertical exaggeration: a constant factor or a zoom curve of `@z` stops.
  readonly terrainExaggeration: TerrainExaggeration;
  // Hillshade (shaded relief) strength, 0-1. On automatically with terrainProvider or reliefProvider; 0 disables.
  readonly hillshadeIntensity: number;
  // Color-relief (elevation tint) opacity, 0-1. On automatically with terrainProvider or reliefProvider; 0 disables.
  readonly colorReliefOpacity: number;
  // Color-relief elevation->color ramp. Unset uses the default hypsometric tint.
  readonly colorReliefColors?: readonly ColorReliefStop[];
  readonly hillshadeMethod: HillshadeMethod;
  // Hillshade illumination (light) direction in degrees, 0-359.
  readonly hillshadeDirection?: number;
  // Hillshade shadow color (slopes facing away from the light).
  readonly hillshadeShadowColor?: string;
  // Hillshade highlight color (slopes facing the light).
  readonly hillshadeHighlightColor?: string;
  // Hillshade accent color (steep slopes).
  readonly hillshadeAccentColor?: string;
  readonly debug: boolean;
  readonly poiFilterPatterns: readonly string[];
  readonly heatmapLayer: boolean;
  readonly heatmapColorScheme?: string;
  readonly markerRenderer: MarkerRendererKind;
  readonly clusteringEnabled: boolean;
  readonly clusterThreshold: number;
  readonly clusterGeoJsonOverlays: boolean;
  readonly trackBuilder: TrackBuilderConfig;
  readonly tools: Readonly<Record<string, unknown>>;
  // Block-only fields (read from blockSettings, not layered from global/provider).
  readonly location?: string;
  readonly selectionParameter?: string;
  readonly selectionPointParameter?: string;
  readonly selectionChannel?: string;
  readonly showHelpWithEmptyMap?: boolean;
}

export interface MapSourceContext {
  readonly path?: string;
  readonly lineStart?: number;
}

export interface MapContextAction {
  readonly text: string;
  readonly icon: string;
  // Receives the map coordinate the context menu opened at.
  readonly onClick: (coordinate?: Coordinate) => void | Promise<void>;
}

// Main-plugin track loading, for provider-owned map tools.
export interface MapTrackLoader {
  loadTrackFromPath(pathSetting: string, sourcePath: string, options?: { skipCache?: boolean }): Promise<TrackData>;
  // Load a track note as the same styled map place used by ordinary Places queries.
  loadTrackPlaceFromPath?(pathSetting: string, sourcePath: string): Promise<MapPlace | null>;
}

export interface MapToolAttachment {
  // Apply changed tool configuration without recreating the map. Return false when the change is
  // structural and requires the provider to rebuild the surface.
  update?(options: { config: ResolvedMapConfig; toolConfig: unknown }): boolean;
  destroy(): void;
}

export interface MapToolPositionHandle {
  setLngLat(coordinate: [longitude: number, latitude: number]): void;
}

export type MapToolTrackSelection = MapTrackSelection;

export interface MapToolFactory {
  readonly id: string;
  readonly engine: 'maplibre';
  readonly suppressEmptyMapHelp?: boolean;
  // Reject an invalid `tools.<id>` mapping before the map is built. A throw inside
  // `attach` is only an unhandled rejection and the tool silently fails to appear.
  // Throw with a message naming the offending key.
  validateToolConfig?(toolConfig: unknown): void;
  // Contribute ordinary map places before rendering, preserving native track styling.
  contributePlaces?(options: {
    source: MapSourceContext;
    config: ResolvedMapConfig;
    toolConfig: unknown;
    trackLoader: MapTrackLoader;
  }): Promise<readonly MapPlace[]>;
  attach(options: {
    app: unknown;
    map: unknown;
    engineApi: {
      Marker: unknown;
      // Keeps synchronous tool camera moves out of user-gesture persistence.
      runProgrammaticCamera(move: () => void): void;
      // Move an existing native Places marker without replacing its renderer.
      getPlacePositionHandle(placeId: string): MapToolPositionHandle | undefined;
      // Return the rendered tracks that map tools may select without requiring a map click.
      getSelectableTracks(): readonly MapPlace[];
      // Subscribe to ordinary rendered-track clicks.
      onTrackSelected(handler: (selection: MapToolTrackSelection) => void): () => void;
    };
    container: HTMLElement;
    source: MapSourceContext;
    config: ResolvedMapConfig;
    // Configuration declared under tools.<factory id>.
    toolConfig: unknown;
    trackLoader?: MapTrackLoader;
  }): MapToolAttachment | undefined;
}

// One place source's contribution to the collect phase (VaultQuery, Dataview, current note, ...).
export interface MapPrepareSourceTiming {
  readonly id: string;
  readonly durationMs: number;
  readonly places: number;
}

// Wall-clock breakdown of everything that runs before a provider starts rendering.
export interface MapPrepareTimings {
  // Date.now() when the block began preparing, i.e. when the loading indicator went up.
  readonly startTime: number;
  // Collecting places from every source, including any wait for VaultQuery/Dataview readiness.
  readonly collectMs: number;
  // Sources run concurrently: these overlap rather than sum to collectMs.
  readonly sources: readonly MapPrepareSourceTiming[];
  readonly fingerprintMs: number;
  readonly stylesMs: number;
  // Label templates plus path-label injection.
  readonly labelsMs: number;
  // The whole prepare phase: collect through label injection.
  readonly totalMs: number;
}

export interface MapRuntimeContext {
  readonly source: MapSourceContext;
  readonly camera: MapCameraIntent;
  readonly overlays: readonly Overlay[];
  readonly trackVisibility: TrackVisibilityResult;
  readonly unifiedClusteringActive: boolean;
  readonly contextMenuActions: readonly MapContextAction[];
  readonly onPlaceAction?: (place: MapPlace, actionId: string, state: { checked?: boolean }) => void;
  // Host-owned place-note creation. Providers submit requests; absent = omit create-note affordances.
  readonly placeNoteHost?: PlaceNoteHost;
  // Host-owned "search for a place at this coordinate". Absent = omit the affordance.
  readonly reverseGeocodeHost?: (coordinate: Coordinate) => void;
  // Lazily resolves source-backed details for the nearest point on a clicked track.
  readonly inspectTrack?: (place: MapPlace, coordinate: { latitude: number; longitude: number }) => Promise<TrackInspection | null>;
  // Provider tools must not parse vault track data themselves.
  readonly trackLoader?: MapTrackLoader;
  readonly mapTools: readonly MapToolFactory[];
  // Resolved 3D-terrain DEM source (main-plugin resolves `terrainProvider` with keys). Absent = no terrain / AWS default.
  readonly terrainDem?: TerrainDemSpec;
  // Resolved DEM for the hillshade / color-relief layers (terrainProvider's DEM, else the map provider's own). Absent = neither on.
  readonly reliefDem?: TerrainDemSpec;
  // Deny-list of placeIds hidden by a parameter-driven `markerFilter:` on the live path.
  // All places stay in the source; these are excluded from the construction fit-data
  // bounds. Live toggles preserve the camera and never re-fit.
  readonly markerVisibilityHiddenIds?: readonly string[];
  // Present when a `debug:` mode is on: providers append a debug section to
  // marker popups showing the metadata fields exactly as condition evaluation
  // sees them, plus a per-rule verdict for the (already substituted)
  // markerFilter rules.
  readonly popupDebug?: { readonly markerFilter: readonly string[] };
  // Pre-render timing breakdown for the `debug: true` overlay. Absent on surfaces that never run the prepare pipeline.
  readonly prepareTimings?: MapPrepareTimings;
}

export interface TrackInspectionField { readonly label: string; readonly value: string; }
export interface TrackInspection { readonly fields: readonly TrackInspectionField[]; }

export interface MapRenderRequest {
  readonly config: ResolvedMapConfig;
  readonly runtime: MapRuntimeContext;
}

export type MapConfigSource = 'coded' | 'global' | 'provider' | 'block';
export type MapConfigProvenance = Readonly<Partial<Record<keyof ResolvedMapConfig, MapConfigSource>>>;

export interface ResolvedMapConfiguration {
  readonly config: ResolvedMapConfig;
  readonly provenance: MapConfigProvenance;
}
