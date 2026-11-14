import type { ConsoleLogLevel } from 'obsidian-debug-logger';
import { DEFAULT_ROUTE_LABEL_TEMPLATE } from './CodeBlockSettings';
import { defaultMarkerIconRules } from '../map/MarkerIcon';
import { defaultWaypointIconMappings } from '../map/WaypointIcon';
import { DEFAULT_OVERLAY_COMPRESSION_LEVEL } from '../utils/StringCompressor';
import type { ClusterStyleKind } from './MapConfiguration';

export type PlacesConsoleLogLevel = ConsoleLogLevel;

export interface IPlacesExtensionHostSettings {
    readonly units: "imperial" | "metric";
    readonly developerMode: boolean;
    readonly poiFilterPatterns: readonly string[];
}

export interface IPlacesCoreSettings {
    noteNameFormat: string;
    newPlaceTemplate: string;
    gpxNoteNameFormat: string;
    units: "imperial" | "metric";
    gpxImportMode: 'disabled' | 'single-note' | 'one-per-track';
    fitImportMode: 'disabled' | 'single-note';
    geoJsonImportMode: 'disabled' | 'single-note' | 'one-per-feature';
    csvImportMode: 'disabled' | 'single-note';
    importDropOnNote: 'create-new' | 'update';
    poiDiscovery: boolean;
    showCurrentDevicePosition: boolean;
    defaultLabelTemplate: string;
    defaultRouteLabelTemplate: string;
    defaultTemplate: string;
    defaultIconStyles: string;
    defaultLabelStyles: string;
    pathStartLabelTemplate: string;
    pathMidpointLabelTemplate: string;
    pathEndLabelTemplate: string;
    waypointLabelTemplate: string;
    speedWindow: string;
    gradeWindow: string;
    clusterThresholdDesktop: number;
    clusterThresholdMobile: number;
    clusterGeoJsonOverlays: boolean;
    clusterStyle: ClusterStyleKind;
    defaultMapProvider: string;
    precomputeOverlayCache: boolean;
    overlayCompressionLevel: number;
    poiFilterPatterns: string[];
    newPlaceTagFilterPatterns: string[];
    showHelpWithEmptyMap: boolean;
    tileCacheDurationHoursDesktop: number;
    tileCacheDurationHoursMobile: number;
    tileCacheMaxSizeMBDesktop: number;
    tileCacheMaxSizeMBMobile: number;
    overlayCacheMaxSizeMBDesktop: number;
    overlayCacheMaxSizeMBMobile: number;
    tileCacheEnabledProviders: Record<string, boolean>;
    consoleLogLevel: PlacesConsoleLogLevel;
    developerMode: boolean;
    markerIconRules: string[];
    waypointIconMappings: string[];
}

export interface IPlacesExtensionConfiguration {
    extensionSettings: Record<string, IPlaceExtensionSettings>;
}

export interface IPlacesOperationalState {
    apiStats: Record<string, unknown>;
    apiOrigins: Record<string, unknown>;
    markerIconRulesRevision: number;
    waypointIconMappingsRevision: number;
}

export type IPlacesPluginSettings = IPlacesCoreSettings & IPlacesExtensionConfiguration & IPlacesOperationalState;

export interface IPlaceExtensionSettings {
    [key: string]: string;
}

export const DEFAULT_TILE_CACHE_DURATION_HOURS = 168;

export const DEFAULT_CORE_SETTINGS: IPlacesCoreSettings = {
    noteNameFormat: "${name} (${city})",
    newPlaceTemplate: "",
    gpxNoteNameFormat: "{yyyymmdd} - {TrackName}",
    units: "imperial",
    gpxImportMode: 'single-note',
    fitImportMode: 'single-note',
    geoJsonImportMode: 'one-per-feature',
    csvImportMode: 'single-note',
    importDropOnNote: 'create-new',
    poiDiscovery: true,
    showCurrentDevicePosition: false,
    defaultLabelTemplate: "",
    defaultRouteLabelTemplate: DEFAULT_ROUTE_LABEL_TEMPLATE,
    defaultTemplate: "",
    defaultIconStyles: "",
    defaultLabelStyles: "",
    pathStartLabelTemplate: "",
    pathMidpointLabelTemplate: "",
    pathEndLabelTemplate: "",
    waypointLabelTemplate: "",
    speedWindow: '200m',
    gradeWindow: '100ft',
    clusterThresholdDesktop: 500,
    clusterThresholdMobile: 200,
    clusterGeoJsonOverlays: true,
    clusterStyle: 'circles',
    defaultMapProvider: "",
    precomputeOverlayCache: true,
    overlayCompressionLevel: DEFAULT_OVERLAY_COMPRESSION_LEVEL,
    poiFilterPatterns: [],
    newPlaceTagFilterPatterns: ['foursquare', 'amenity', 'address', 'bus-stop', 'commercial', 'building', 'street', 'boundary', 'place'],
    showHelpWithEmptyMap: true,
    tileCacheDurationHoursDesktop: DEFAULT_TILE_CACHE_DURATION_HOURS,
    tileCacheDurationHoursMobile: DEFAULT_TILE_CACHE_DURATION_HOURS,
    tileCacheMaxSizeMBDesktop: 250,
    tileCacheMaxSizeMBMobile: 250,
    overlayCacheMaxSizeMBDesktop: 192,
    overlayCacheMaxSizeMBMobile: 64,
    tileCacheEnabledProviders: {},
    consoleLogLevel: 'warn',
    developerMode: false,
    markerIconRules: defaultMarkerIconRules(),
    waypointIconMappings: defaultWaypointIconMappings(),
};

export const DEFAULT_EXTENSION_CONFIGURATION: IPlacesExtensionConfiguration = {
    extensionSettings: {},
};

export const DEFAULT_OPERATIONAL_STATE: IPlacesOperationalState = {
    apiStats: {},
    apiOrigins: {},
    markerIconRulesRevision: 0,
    waypointIconMappingsRevision: 0,
};

export const DEFAULT_SETTINGS: IPlacesPluginSettings = {
    ...DEFAULT_CORE_SETTINGS,
    ...DEFAULT_EXTENSION_CONFIGURATION,
    ...DEFAULT_OPERATIONAL_STATE,
};
