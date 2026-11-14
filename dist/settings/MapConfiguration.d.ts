import type { IconImageDetail } from '../map/IconImageQuality';
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
import type { TrackData } from '../geo/TrackTypes';
import type { MapTrackSelection } from '../map/TrackSelection';
import type { PopupContentConfig } from './PopupConfiguration';
import type { PopupRenderer } from '../map/PopupContent';
import type { PlaceSource } from './PlaceSources';
export type MapLegendPosition = 'hidden' | 'top' | 'bottom';
export type MarkerRendererKind = 'native' | 'html';
export type ClusterStyleKind = 'circles' | 'heatmap';
export type RouteTravelModeName = 'drive' | 'walk' | 'bike';
export type RouteMetricLabelMode = 'total' | 'legs' | 'both' | 'none';
export type TrackDetailsDisplay = 'popup' | 'panel';
export interface TrackBuilderConfig {
    readonly id?: string;
    readonly name?: string;
    readonly tracks: readonly string[];
    readonly snapRadiusMeters?: number;
    readonly respectGradeSeparation: boolean;
    readonly selectableLayers: readonly string[];
}
export interface DirectionsStyle {
    readonly color?: string;
    readonly strokeWidth?: number;
    readonly strokeOpacity?: number;
}
export interface DirectionsDefinition {
    readonly kind: 'directions';
    readonly name?: string;
    readonly provider?: string;
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
export type DirectionsRouteDefinition = {
    readonly kind: 'waypoints';
    readonly waypoints: readonly string[];
} | {
    readonly kind: 'query';
    readonly query: string;
};
export interface IsochroneRange {
    readonly value: number;
    readonly type: 'time' | 'distance';
}
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
export interface MapConfigPatch {
    readonly height?: string;
    readonly width?: string;
    readonly mapProvider?: string;
    readonly style?: string;
    readonly initialZoom?: number;
    readonly initialCenter?: readonly [number, number];
    readonly minZoom?: number;
    readonly showLabels?: boolean;
    readonly showCurrentDevicePosition?: boolean;
    readonly trackDirectionArrows?: number;
    readonly labelTemplate?: string;
    readonly iconRotation?: string;
    readonly iconImage?: string;
    readonly trackColorBy?: TrackColorBy;
    readonly trackStyle?: string;
    readonly markerMinZoom?: number;
    readonly markerMaxZoom?: number;
    readonly labelMinZoom?: number;
    readonly labelMaxZoom?: number;
    readonly trackMinZoom?: number;
    readonly trackMaxZoom?: number;
    readonly overlayMinZoom?: number;
    readonly overlayMaxZoom?: number;
    readonly trackOutline?: boolean;
    readonly trackDefaultVisibility?: 'visible' | 'hidden';
    readonly trackGradeWindow?: MetricWindow;
    readonly trackSpeedWindow?: MetricWindow;
    readonly legend?: MapLegendPosition;
    readonly query?: string;
    readonly dataview?: string;
    readonly places?: readonly PlaceSource[];
    readonly radius?: string;
    readonly routeProvider?: string;
    readonly directions?: readonly DirectionsDefinition[];
    readonly isochrones?: readonly IsochroneDefinition[];
    readonly routeLabelTemplate?: string;
    readonly metricLabels?: RouteMetricLabelMode;
    readonly legLabelTemplate?: string;
    readonly waypointLabelTemplate?: string;
    readonly popup?: PopupContentConfig;
    readonly trackLabelsStart?: string;
    readonly trackLabelsMidpoint?: string;
    readonly trackLabelsEnd?: string;
    readonly trackLabelsVisibility?: string;
    readonly trackDetails?: TrackDetailsDisplay;
    readonly css?: string;
    readonly iconStyles?: string | readonly string[];
    readonly iconImageStyles?: string | readonly string[];
    readonly labelStyles?: string | readonly string[];
    readonly poiDiscovery?: boolean;
    readonly pitch?: boolean;
    readonly terrainProvider?: string;
    readonly reliefProvider?: string;
    readonly terrainExaggeration?: TerrainExaggeration;
    readonly hillshadeIntensity?: number;
    readonly colorReliefOpacity?: number;
    readonly colorReliefColors?: readonly ColorReliefStop[];
    readonly hillshadeMethod?: HillshadeMethod;
    readonly hillshadeDirection?: number;
    readonly hillshadeShadowColor?: string;
    readonly hillshadeHighlightColor?: string;
    readonly hillshadeAccentColor?: string;
    readonly debug?: boolean;
    readonly poiFilterPatterns?: readonly string[];
    readonly heatmapLayer?: boolean;
    readonly heatmapColorScheme?: string;
    readonly markerRenderer?: MarkerRendererKind;
    readonly clusteringEnabled?: boolean;
    readonly clusterThreshold?: number;
    readonly clusterGeoJsonOverlays?: boolean;
    readonly clusterStyle?: ClusterStyleKind;
    readonly iconImageDetail?: IconImageDetail;
    readonly trackBuilder?: TrackBuilderConfig;
    readonly tools?: Readonly<Record<string, unknown>>;
    readonly location?: string;
    readonly selectionParameter?: string;
    readonly selectionPointParameter?: string;
    readonly selectionChannel?: string;
    readonly viewportParameter?: string;
    readonly showHelpWithEmptyMap?: boolean;
}
export type MapBlockSettings = {
    -readonly [K in keyof MapConfigPatch]: MapConfigPatch[K];
};
export interface ResolvedMapConfig {
    readonly height: string;
    readonly width: string;
    readonly mapProvider: string;
    readonly style: string;
    readonly initialZoom?: number;
    readonly initialCenter?: readonly [number, number];
    readonly minZoom?: number;
    readonly showLabels: boolean;
    readonly showCurrentDevicePosition: boolean;
    readonly trackDirectionArrows: number;
    readonly labelTemplate?: string;
    readonly iconRotation?: string;
    readonly iconImage?: string;
    readonly trackColorBy?: TrackColorBy;
    readonly trackStyle?: string;
    readonly markerMinZoom?: number;
    readonly markerMaxZoom?: number;
    readonly labelMinZoom?: number;
    readonly labelMaxZoom?: number;
    readonly trackMinZoom?: number;
    readonly trackMaxZoom?: number;
    readonly overlayMinZoom?: number;
    readonly overlayMaxZoom?: number;
    readonly trackOutline?: boolean;
    readonly trackDefaultVisibility?: 'visible' | 'hidden';
    readonly trackGradeWindow: MetricWindow;
    readonly trackSpeedWindow: MetricWindow;
    readonly legend: MapLegendPosition;
    readonly query?: string;
    readonly dataview?: string;
    readonly places?: readonly PlaceSource[];
    readonly radius?: string;
    readonly routeProvider?: string;
    readonly directions: readonly DirectionsDefinition[];
    readonly isochrones: readonly IsochroneDefinition[];
    readonly routeLabelTemplate?: string;
    readonly metricLabels?: RouteMetricLabelMode;
    readonly legLabelTemplate?: string;
    readonly waypointLabelTemplate?: string;
    readonly popup?: PopupContentConfig;
    readonly trackLabelsStart?: string;
    readonly trackLabelsMidpoint?: string;
    readonly trackLabelsEnd?: string;
    readonly trackLabelsVisibility?: string;
    readonly trackDetails: TrackDetailsDisplay;
    readonly css: string;
    readonly iconStyles?: string | readonly string[];
    readonly iconImageStyles?: string | readonly string[];
    readonly labelStyles?: string | readonly string[];
    readonly poiDiscovery: boolean;
    readonly pitch: boolean;
    readonly terrainProvider: string;
    readonly reliefProvider: string;
    readonly terrainExaggeration: TerrainExaggeration;
    readonly hillshadeIntensity: number;
    readonly colorReliefOpacity: number;
    readonly colorReliefColors?: readonly ColorReliefStop[];
    readonly hillshadeMethod: HillshadeMethod;
    readonly hillshadeDirection?: number;
    readonly hillshadeShadowColor?: string;
    readonly hillshadeHighlightColor?: string;
    readonly hillshadeAccentColor?: string;
    readonly debug: boolean;
    readonly poiFilterPatterns: readonly string[];
    readonly heatmapLayer: boolean;
    readonly heatmapColorScheme?: string;
    readonly markerRenderer: MarkerRendererKind;
    readonly clusteringEnabled: boolean;
    readonly clusterThreshold: number;
    readonly clusterGeoJsonOverlays: boolean;
    readonly clusterStyle: ClusterStyleKind;
    readonly iconImageDetail: IconImageDetail;
    readonly trackBuilder: TrackBuilderConfig;
    readonly tools: Readonly<Record<string, unknown>>;
    readonly location?: string;
    readonly selectionParameter?: string;
    readonly selectionPointParameter?: string;
    readonly selectionChannel?: string;
    readonly viewportParameter?: string;
    readonly showHelpWithEmptyMap?: boolean;
}
export interface MapSourceContext {
    readonly path?: string;
    readonly lineStart?: number;
}
export interface MapContextAction {
    readonly text: string;
    readonly icon: string;
    readonly onClick: (coordinate?: Coordinate) => void | Promise<void>;
}
export interface MapTrackLoader {
    loadTrackFromPath(pathSetting: string, sourcePath: string, options?: {
        skipCache?: boolean;
        signal?: AbortSignal;
    }): Promise<TrackData>;
    loadTrackPlaceFromPath?(pathSetting: string, sourcePath: string): Promise<MapPlace | null>;
}
export interface MapToolAttachment {
    update?(options: {
        config: ResolvedMapConfig;
        toolConfig: unknown;
    }): boolean;
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
    validateToolConfig?(toolConfig: unknown): void;
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
            runProgrammaticCamera(move: () => void): void;
            getPlacePositionHandle(placeId: string): MapToolPositionHandle | undefined;
            getSelectableTracks(): readonly MapPlace[];
            onTrackSelected(handler: (selection: MapToolTrackSelection) => void): () => void;
        };
        container: HTMLElement;
        source: MapSourceContext;
        config: ResolvedMapConfig;
        toolConfig: unknown;
        trackLoader?: MapTrackLoader;
        placeNoteHost?: PlaceNoteHost;
    }): MapToolAttachment | undefined;
}
export interface MapPrepareSourceTiming {
    readonly id: string;
    readonly durationMs: number;
    readonly places: number;
}
export interface MapPrepareTimings {
    readonly startTime: number;
    readonly collectMs: number;
    readonly sources: readonly MapPrepareSourceTiming[];
    readonly fingerprintMs: number;
    readonly stylesMs: number;
    readonly labelsMs: number;
    readonly totalMs: number;
}
export interface MapRuntimeContext {
    readonly source: MapSourceContext;
    readonly camera: MapCameraIntent;
    readonly overlays: readonly Overlay[];
    readonly trackVisibility: TrackVisibilityResult;
    readonly unifiedClusteringActive: boolean;
    readonly contextMenuActions: readonly MapContextAction[];
    readonly onPlaceAction?: (place: MapPlace, actionId: string, state: {
        checked?: boolean;
    }) => void;
    readonly placeNoteHost?: PlaceNoteHost;
    readonly reverseGeocodeHost?: (coordinate: Coordinate, sourcePath?: string) => void;
    readonly inspectTrack?: (place: MapPlace, coordinate: {
        latitude: number;
        longitude: number;
    }, signal?: AbortSignal) => Promise<TrackInspection | null>;
    readonly trackLoader?: MapTrackLoader;
    readonly mapTools: readonly MapToolFactory[];
    readonly popupRenderers: readonly PopupRenderer[];
    readonly terrainDem?: TerrainDemSpec;
    readonly reliefDem?: TerrainDemSpec;
    readonly markerVisibilityHiddenIds?: readonly string[];
    readonly popupDebug?: {
        readonly markerFilter: readonly string[];
    };
    readonly prepareTimings?: MapPrepareTimings;
    readonly isStale?: () => boolean;
}
export interface TrackInspectionField {
    readonly label: string;
    readonly value: string;
}
export interface TrackInspection {
    readonly fields: readonly TrackInspectionField[];
}
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
