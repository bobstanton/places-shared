import type { ConsoleLogLevel } from 'obsidian-debug-logger';
export type PlacesConsoleLogLevel = ConsoleLogLevel;
export interface IPlacesExtensionHostSettings {
    readonly units: "imperial" | "metric";
    readonly developerMode: boolean;
    readonly poiFilterPatterns: readonly string[];
}
export interface IPlacesPluginSettings {
    noteNameFormat: string;
    gpxNoteNameFormat: string;
    units: "imperial" | "metric";
    extensionSettings: Record<string, IPlaceExtensionSettings>;
    apiStats: Record<string, unknown>;
    gpxImportMode: 'disabled' | 'single-note' | 'one-per-track';
    geoJsonImportMode: 'disabled' | 'single-note' | 'one-per-feature';
    csvImportMode: 'disabled' | 'single-note';
    importDropOnNote: 'create-new' | 'update';
    defaultElevationService: string;
    poiDiscovery: boolean;
    defaultLabelTemplate: string;
    defaultRouteLabelTemplate: string;
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
    tileCacheEnabledProviders: Record<string, boolean>;
    consoleLogLevel: PlacesConsoleLogLevel;
    developerMode: boolean;
    markerIconRules: string[];
}
export interface IPlaceExtensionSettings {
    [key: string]: string;
}
export declare const DEFAULT_SETTINGS: IPlacesPluginSettings;
