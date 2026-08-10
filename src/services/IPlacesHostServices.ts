import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TrackData } from '../geo/TrackTypes';
import type { MapRenderPlan } from "../render/MapRenderPlan";
import type { MapConfigPatch, ResolvedMapConfig } from "../settings/MapConfiguration";
import type { ConfigWarning } from "../settings/MapConfigResolver";
import { ITrackMatchService } from './ITrackMatchService';

export type SharedParameterValue = string | number | boolean | string[] | { min: number; max: number } | null;

export interface SharedSelection {
  // Extensible semantic kind, such as place, track, track-point, tide-station, or weather-cell.
  kind: string;
  // Identifier within the kind, when the item has one.
  id?: string;
  label?: string;
  path?: string;
  coordinate?: { latitude: number; longitude: number };
  // Small JSON-safe extension payload.
  data?: Record<string, string | number | boolean | null>;
}

export interface SharedDateRange {
  start?: string;
  end?: string;
}

export interface SharedDateRangeBinding {
  startParameter?: string;
  endParameter?: string;
}

// Conventional note-scoped names, usable without coordinating private plugin APIs.
export const SHARED_PARAMETER_NAMES = {
  startDate: 'startDate',
  endDate: 'endDate',
  selectedItem: 'selectedItem',
  selectedPoint: 'selectedPoint',
} as const;

// Capabilities the main Places plugin provides to sub-plugin code blocks,
// passed as the optional fourth argument of getPlaceExports. Sub-plugins must
// not import the main plugin (plugin independence); anything they need from it
// flows through this facade. Absent when the main plugin predates the facade.
//
// This interface is extended additively - existing members keep their shape
// across plugin versions. Removing or retyping a member is a breaking change
// and must bump PLACES_EXTENSION_API_VERSION.
export interface IPlacesHostServices {
  parameters: {
    // The value a consuming query would use: reconciled against the parameter's declared definition (coerced, clamped, defaulted). The raw stored value when no places-parameters block declares the name.
    getNoteValue(sourcePath: string, name: string): SharedParameterValue | undefined;
    // Set a note-scoped parameter value. `null` clears it to the declared default. Writing a name no places-parameters block declares has no effect on any query (and warns in developer mode).
    setNoteValue(sourcePath: string, name: string, value: SharedParameterValue): void;
    subscribeNoteValue(sourcePath: string, name: string, handler: (value: SharedParameterValue | undefined) => void): () => void;
  };
  dateRanges: {
    get(sourcePath: string, binding?: SharedDateRangeBinding): SharedDateRange;
    set(sourcePath: string, range: SharedDateRange, binding?: SharedDateRangeBinding): void;
    subscribe(sourcePath: string, handler: (range: SharedDateRange) => void, binding?: SharedDateRangeBinding): () => void;
  };
  selections: {
    get(sourcePath: string, channel?: string): SharedSelection | undefined;
    publish(sourcePath: string, selection: SharedSelection | undefined, channel?: string): void;
    subscribe(sourcePath: string, handler: (selection: SharedSelection | undefined) => void, channel?: string): () => void;
  };
  tracks: {
    // Load track data from a wiki-link, quoted path, or direct path (md/gpx/csv/geojson).
    loadTrackFromPath(pathSetting: string, sourcePath: string, options?: { skipCache?: boolean }): Promise<TrackData>;
    // Resolve the markdown note behind a track input, or null for non-markdown tracks.
    resolveMarkdownTrackFile(pathSetting: string, sourcePath: string): TFile | null;
  };
  maps: {
    // Resolve a map provider name: explicit > global default > first available.
    resolveMapProvider(explicitProvider?: string): string;
    // Return defaults registered by the selected map provider (for example its default style).
    getMapProviderDefaults?(providerName: string): MapConfigPatch;
    // Resolve a map config with the host's global settings layered beneath the
    // caller's block settings, and decide clustering the same way a places
    // block does.
    //
    // Provider-authored map surfaces cannot reach global settings themselves -
    // those live in the main plugin's bundle - and a surface that calls
    // `resolveMapConfiguration` directly silently falls back to the CODED
    // defaults for every one of them: `clusterThreshold` (clustering off),
    // label templates, icon and label styles, grade and speed windows.
    //
    // Optional, letting a provider built against a newer places-shared load on
    // an older host: feature-detect and fall back to block-only resolution.
    resolveMapConfig?(request: {
      providerName: string;
      // The surface's own settings, as a places block would express them.
      blockSettings: Readonly<Record<string, unknown>>;
      placeCount: number;
      // Collector for non-fatal parse warnings; omit for strict (throwing) parsing.
      warnings?: ConfigWarning[];
    }): { config: ResolvedMapConfig; clusteringEnabled: boolean };
    // Render a map surface with markers/overlays into the given container. Returns whether it rendered.
    renderMapSurface(request: HostMapSurfaceRequest): Promise<boolean>;
    // Update places on an already-rendered map surface in place (no re-render). Returns whether it updated.
    updateMapSurface(request: HostMapSurfaceRequest): Promise<boolean>;
  };
  trackMatch: {
    get(providerName: string): ITrackMatchService | undefined;
    getFirst(): ITrackMatchService | undefined;
    getNames(): string[];
  };
}

export interface HostMapSurfaceRequest {
  host: HTMLElement;
  mapContainer: HTMLElement;
  providerName: string;
  ctx?: MarkdownPostProcessorContext;
  // Complete desired state for both the initial render and every subsequent update.
  renderPlan: MapRenderPlan;
}
