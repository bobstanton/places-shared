import { App, Editor, MarkdownView, MarkdownFileInfo, MarkdownPostProcessorContext, Plugin } from "obsidian";
import type { SettingGroupItem } from "obsidian";
import { IMapBlockProcessor } from "./IMapBlockProcessor";
import { IPlacesService } from "./IPlacesService";
import { IElevationService } from "./IElevationService";
import { ITrackMatchService } from "./ITrackMatchService";
import { IPlacesHostServices } from "./IPlacesHostServices";
import { RouteOverlayService } from "./IRouteOverlayService";
import { ISnapService } from "./ISnapService";
import { ITerrainDemProvider } from "./ITerrainDemProvider";
import { IPlaceExtensionSettings, IPlacesExtensionHostSettings } from "../settings/PlacesPluginSettings";
export declare const PLACES_EXTENSION_API_VERSION = 0;
export interface IPlacePluginExtension {
    placesExtensionApiVersion?: number;
    getPlaceExports(app: App, extensionSettings: IPlaceExtensionSettings, hostSettings: IPlacesExtensionHostSettings, host: IPlacesHostServices): IPlacePluginExtensionExports;
}
export declare const PLACES_EXTENSION_READY_EVENT = "places:extension-ready";
export declare const PLACES_EXTENSION_UNLOADED_EVENT = "places:extension-unloaded";
export interface PlaceExtensionReadyEvent {
    pluginId: string;
    extension: IPlacePluginExtension;
}
export interface PlaceExtensionUnloadedEvent {
    pluginId: string;
}
export declare function registerPlaceExtensionLifecycle(plugin: Plugin & IPlacePluginExtension): void;
export interface PlacePluginCommand {
    id: string;
    name: string;
    description?: string;
    editorCallback?: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => void | Promise<void>;
    callback?: () => void | Promise<void>;
    checkCallback?: (checking: boolean) => boolean | void;
}
export interface ParameterDefinition {
    name: string;
    description?: string;
    values: string;
}
export interface CodeBlockDefinition {
    type: string;
    description: string;
    parameters: ParameterDefinition[];
}
export interface NestedKeyDefinition {
    name: string;
    description?: string;
    apply?: string;
}
export interface ListItemTemplate {
    label: string;
    insert: string;
    description?: string;
}
export interface CodeBlockHighlightConfig {
    blockType: string;
    extendsBlockType?: string;
    validKeys: string[];
    rootKeys?: string[];
    knownValues?: Record<string, string[]>;
    multiValueKeys?: string[];
    contextualKnownValues?: Array<{
        key: string;
        dependsOn: string;
        valuesByContext: Record<string, string[]>;
    }>;
    nestedKeys?: Record<string, NestedKeyDefinition[]>;
    listItemTemplates?: Record<string, ListItemTemplate[]>;
}
export interface ExtensionSettingsGroup {
    heading: string;
    items: SettingGroupItem[];
    getValue?: (key: string) => unknown;
    setValue?: (key: string, value: unknown) => void | Promise<void>;
    updateOn?: readonly string[];
}
export type ImageAlignmentProcessor = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;
export interface PlaceProviderFeatures {
    poiDiscovery?: boolean;
    raster?: boolean;
    vector?: boolean;
    tileCache?: boolean;
    tileCacheUnsupportedReason?: string;
}
export interface PlaceProviderExport {
    name: string;
    mapDefaults?: import('../settings/MapConfiguration').MapConfigPatch;
    styles?: string[];
    features?: PlaceProviderFeatures;
    map?: IMapBlockProcessor;
    imageAlignment?: ImageAlignmentProcessor;
    geocoding?: {
        service: IPlacesService;
        icon: string;
    };
    elevation?: IElevationService;
    trackMatch?: ITrackMatchService;
    routeOverlay?: RouteOverlayService;
    snap?: ISnapService;
    terrain?: ITerrainDemProvider;
}
export interface IPlacePluginExtensionExports {
    apiVersion: number;
    providers?: PlaceProviderExport[];
    mapTools?: import('../settings/MapConfiguration').MapToolFactory[];
    codeBlockProcessors?: Array<{
        blockType: string;
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;
        colonTextKeys?: readonly string[];
    }>;
    commands?: PlacePluginCommand[];
    codeBlockDefinitions?: CodeBlockDefinition[];
    highlightConfigs?: CodeBlockHighlightConfig[];
    settingsGroup?: ExtensionSettingsGroup;
    dispose?: () => void | Promise<void>;
}
