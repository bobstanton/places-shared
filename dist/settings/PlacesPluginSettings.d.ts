import type { ConsoleLogLevel } from 'obsidian-debug-logger';
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
export declare const DEFAULT_TILE_CACHE_DURATION_HOURS = 168;
export declare const DEFAULT_CORE_SETTINGS: IPlacesCoreSettings;
export declare const DEFAULT_EXTENSION_CONFIGURATION: IPlacesExtensionConfiguration;
export declare const DEFAULT_OPERATIONAL_STATE: IPlacesOperationalState;
export declare const DEFAULT_SETTINGS: IPlacesPluginSettings;
