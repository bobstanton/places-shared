import type { App, Editor, MarkdownView, MarkdownFileInfo, MarkdownPostProcessorContext, Plugin } from 'obsidian';
import type { SettingDefinitionItem, SettingGroupItem } from "obsidian";
import type { ParameterDefinition, NestedKeyDefinition } from "../../services/index";
import { IMapBlockProcessor } from "../../services/index";
import { IPlacesService } from "../../services/index";
import { IElevationService } from "../../services/index";
import { ITrackMatchService } from "../../services/index";
import { IPlacesHostServices } from "./IPlacesHostServices";
import { RouteOverlayService } from "../../services/index";
import { ISnapService } from "../../services/index";
import { ITerrainDemProvider } from "../../services/index";
import { IPlaceExtensionSettings, IPlacesExtensionHostSettings } from "../../settings/index";
import type { OverlayResult } from "../../overlay/index";

// Contract version between the main Places plugin and extension plugins.
// Each plugin bundles its own copy of places-shared. Version represents
// what the plugin was built against. The main plugin skips extensions
// whose exports carry a different version.
export const PLACES_EXTENSION_API_VERSION = 0;

export interface IPlacePluginExtension {
    placesExtensionApiVersion?: number;
    getPlaceExports(app: App, extensionSettings: IPlaceExtensionSettings, hostSettings: IPlacesExtensionHostSettings, host: IPlacesHostServices) : IPlacePluginExtensionExports;
}

export const PLACES_EXTENSION_READY_EVENT = 'places:extension-ready';
export const PLACES_EXTENSION_UNLOADED_EVENT = 'places:extension-unloaded';

export interface PlaceExtensionReadyEvent {
    pluginId: string;
    extension: IPlacePluginExtension;
}

export interface PlaceExtensionUnloadedEvent {
    pluginId: string;
}

export function registerPlaceExtensionLifecycle(plugin: Plugin & IPlacePluginExtension): void {
    plugin.placesExtensionApiVersion = PLACES_EXTENSION_API_VERSION;
    plugin.app.workspace.trigger(PLACES_EXTENSION_READY_EVENT, {
        pluginId: plugin.manifest.id,
        extension: plugin,
    } satisfies PlaceExtensionReadyEvent);
    plugin.register(() => plugin.app.workspace.trigger(PLACES_EXTENSION_UNLOADED_EVENT, {
        pluginId: plugin.manifest.id,
    } satisfies PlaceExtensionUnloadedEvent));
}

export interface PlacePluginCommand {
    id: string;
    name: string;
    description?: string;
    editorCallback?: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => void | Promise<void>;
    callback?: () => void | Promise<void>;
    checkCallback?: (checking: boolean) => boolean | void;
}

export interface CodeBlockDefinition {
    type: string;
    description: string;
    parameters: ParameterDefinition[];
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
    valueDetails?: Record<string, Record<string, string>>;
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
    category?: 'provider' | 'feature';
    desc?: string | DocumentFragment;
    displayValue?: string | (() => string);
    status?: 'warning' | null | (() => 'warning' | null);
    items: SettingGroupItem[];
    pageItems?: SettingDefinitionItem[];
    getValue?: (key: string) => unknown;
    setValue?: (key: string, value: unknown) => void | Promise<void>;
    updateOn?: readonly string[];
    reloadOn?: readonly string[];
}

export interface ImageAlignmentServices {
    formatDistance?: (meters: number) => string;
    loadOverlays(definitions: unknown): Promise<OverlayResult>;
}

export type ImageAlignmentProcessor = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext, services?: ImageAlignmentServices) => void | Promise<void>;

export interface PlaceProviderFeatures {
    poiDiscovery?: boolean;
    raster?: boolean;
    vector?: boolean;
    tileCache?: boolean;
}

export interface PlaceProviderExport {
    name: string;
    mapDefaults?: import('../../settings/index').MapConfigPatch;
    styles?: string[];
    styleKinds?: Readonly<Record<string, import('../../map/index').MapStyleKind>>;
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
    mapTools?: import('../../settings/index').MapToolFactory[];
    popupRenderers?: import('../../map/index').PopupRenderer[];
    overlayPresets?: import('../../overlay/index').VectorTileOverlayPreset[];

    codeBlockProcessors?: Array<{
        blockType: string;
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;
        colonTextKeys?: readonly string[];
        sourceFormat?: 'yaml' | 'yaml-template';
        indexDependencies?: 'notes';
    }>;

    commands?: PlacePluginCommand[];

    codeBlockDefinitions?: CodeBlockDefinition[];

    highlightConfigs?: CodeBlockHighlightConfig[];

    settingsGroup?: ExtensionSettingsGroup;

    dispose?: () => void | Promise<void>;
}
