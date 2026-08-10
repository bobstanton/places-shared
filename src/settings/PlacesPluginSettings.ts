import type { ConsoleLogLevel } from 'obsidian-debug-logger';
import { DEFAULT_ROUTE_LABEL_TEMPLATE } from './CodeBlockSettings';
import { defaultMarkerIconRules } from '../map/MarkerIcon';
import { DEFAULT_OVERLAY_COMPRESSION_LEVEL } from '../utils/StringCompressor';

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
    // Global icon style rules prepended to every map. Empty = no global rules.
    defaultIconStyles: string;
    // Global label style rules prepended to every map. Empty = no global rules.
    defaultLabelStyles: string;
    // Global default templates for GPX/path overlay labels. Empty = use the coded default.
    pathStartLabelTemplate: string;
    pathMidpointLabelTemplate: string;
    pathEndLabelTemplate: string;
    // Global default template for directions waypoint labels. Empty = use the coded default.
    waypointLabelTemplate: string;
    // Span speed and pace are averaged over: a distance (200m, 0.25mi) or a time (30s, 5min).
    speedWindow: string;
    // Span the rolling grade is measured over: a distance (100ft, 50m) or a time (10min).
    gradeWindow: string;
    clusterThresholdDesktop: number;
    clusterThresholdMobile: number;
    clusterGeoJsonOverlays: boolean;
    defaultMapProvider: string;
    precomputeOverlayCache: boolean;
    // Zstandard level (1-19) for Overlay Source / Overlay Cache writes. Decode speed is level-independent.
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
    // Ordered marker-icon rules ("tag:regex => 🍕" / "name:regex => 🎿"); first match wins. Defaults to the built-in tag emojis.
    markerIconRules: string[];
}

export interface IPlaceExtensionSettings {
    [key: string]: string;
}

export const DEFAULT_SETTINGS: IPlacesPluginSettings = {
    noteNameFormat: "${name} (${city})",
    gpxNoteNameFormat: "{yyyymmdd} - {TrackName}",
    units: "imperial",
    extensionSettings: {},
    apiStats: {},
    gpxImportMode: 'single-note',
    geoJsonImportMode: 'one-per-feature',
    csvImportMode: 'single-note',
    importDropOnNote: 'create-new',
    defaultElevationService: "mapbox",
    poiDiscovery: true,
    defaultLabelTemplate: "",
    defaultRouteLabelTemplate: DEFAULT_ROUTE_LABEL_TEMPLATE,
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
    defaultMapProvider: "",
    precomputeOverlayCache: true,
    overlayCompressionLevel: DEFAULT_OVERLAY_COMPRESSION_LEVEL,
    poiFilterPatterns: [],
    newPlaceTagFilterPatterns: ['foursquare', 'amenity', 'address', 'bus-stop', 'commercial', 'building', 'street', 'boundary', 'place'],
    showHelpWithEmptyMap: true,
    tileCacheDurationHoursDesktop: 0,
    tileCacheDurationHoursMobile: 0,
    tileCacheMaxSizeMBDesktop: 250,
    tileCacheMaxSizeMBMobile: 250,
    tileCacheEnabledProviders: {},
    consoleLogLevel: 'warn',
    developerMode: false,
    markerIconRules: defaultMarkerIconRules(),
};
