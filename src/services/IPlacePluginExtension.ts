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
    // e.g. "places-tide-table".
    blockType: string;
    // Optional block whose syntax schema is inherited before this block's keys are added.
    extendsBlockType?: string;
    // Every key the highlighter accepts anywhere in the block (root plus nested sub-keys).
    validKeys: string[];
    // Keys valid at the TOP LEVEL only; drives root key completion. Nested-only sub-keys are excluded. Default validKeys.
    rootKeys?: string[];
    // Known valid values for specific parameters.
    knownValues?: Record<string, string[]>;
    // Keys whose values are parsed as comma-separated lists.
    multiValueKeys?: string[];
    // Values for a key that depend on another key in the same block.
    contextualKnownValues?: Array<{
        key: string;
        dependsOn: string;
        valuesByContext: Record<string, string[]>;
    }>;
    // Parent key -> sub-keys completable on lines nested under it.
    nestedKeys?: Record<string, NestedKeyDefinition[]>;
    // Parent key -> value templates offered on bare "- " list entries under it.
    listItemTemplates?: Record<string, ListItemTemplate[]>;
}

// Declarative settings contributed by an extension, rendered as a group in the
// main Places settings tab through the Obsidian 1.13 settings-definition API.
//
// Control keys are extension-local property names of the extension's settings
// object; the host namespaces them, routes reads and writes to that object,
// and persists after every write. Extension settings values are stored as
// strings: a control whose value is not the stored string (a toggle, a
// number, a value that needs coercion) supplies `getValue`/`setValue`.
// `render` and `action` items remain available inside `items` for rows no
// control definition can express.
export interface ExtensionSettingsGroup {
    // Group heading shown in the main settings tab, e.g. "Mapbox".
    heading: string;
    items: SettingGroupItem[];
    // Maps a stored value to a control value. The plain stored string is used when omitted (or when undefined is returned, falling back to the control's defaultValue).
    getValue?: (key: string) => unknown;
    // Persists a control value onto the extension's settings object. The plain string write is used when omitted; the host saves settings after either path.
    setValue?: (key: string, value: unknown) => void | Promise<void>;
    // Keys whose change re-renders the settings tab, re-evaluating conditional `visible`/`disabled` callbacks.
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
    // Map-only defaults contributed by this provider. Credentials and service settings do not belong here.
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
    // Raster-DEM source for 3D terrain, selectable via `terrainProvider: <name>`.
    terrain?: ITerrainDemProvider;
}

export interface IPlacePluginExtensionExports {
    apiVersion: number;

    providers?: PlaceProviderExport[];
    mapTools?: import('../settings/MapConfiguration').MapToolFactory[];

    codeBlockProcessors?: Array<{
        blockType: string;
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>;
        // Settings whose value is text that may itself contain `": "`, such as a
        // named coordinate (`location: Scranton: 41.408, -75.662`). The host
        // parses the block before the processor sees it (to substitute
        // parameters), and plain YAML rejects that second colon: without this
        // list the block fails to render even though the processor's own reader
        // accepts the syntax. Must match the `colonTextKeys` the processor
        // passes to its own CodeBlockReader.
        colonTextKeys?: readonly string[];
    }>;

    commands?: PlacePluginCommand[];

    // For places-reference documentation.
    codeBlockDefinitions?: CodeBlockDefinition[];

    highlightConfigs?: CodeBlockHighlightConfig[];

    // Declarative settings group rendered (and made searchable) by the main plugin's settings tab.
    settingsGroup?: ExtensionSettingsGroup;

    dispose?: () => void | Promise<void>;
}
