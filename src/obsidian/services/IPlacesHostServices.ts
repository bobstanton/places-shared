import type { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TrackData } from '../../geo/index';
import type { MapRenderPlan } from "../../render/index";
import type { MapConfigPatch, ResolvedMapConfig } from "../../settings/index";
import type { ConfigWarning } from "../../settings/index";
import { ITrackMatchService, type ApiUsageOrigin, type ApiUsageRecorder } from '../../services/index';
import type { PlaceNoteHost } from '../../map/index';

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

export interface IPlacesHostServices {
  placeNotes?: PlaceNoteHost;
  parameters: {
    getNoteValue(sourcePath: string, name: string): SharedParameterValue | undefined;
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
    loadTrackFromPath(pathSetting: string, sourcePath: string, options?: { skipCache?: boolean }): Promise<TrackData>;
    resolveMarkdownTrackFile(pathSetting: string, sourcePath: string): TFile | null;
  };
  maps: {
    resolveMapProvider(explicitProvider?: string): string;
    getMapProviderDefaults?(providerName: string): MapConfigPatch;
    resolveMapConfig?(request: {
      providerName: string;
      blockSettings: Readonly<Record<string, unknown>>;
      placeCount: number;
      warnings?: ConfigWarning[];
    }): { config: ResolvedMapConfig; clusteringEnabled: boolean };
    renderMapSurface(request: HostMapSurfaceRequest): Promise<HostMapSurfaceHandle | null>;
    disposeMapSurfaces(element: HTMLElement): void;
  };
  trackMatch: {
    get(providerName: string, origin?: ApiUsageOrigin): ITrackMatchService | undefined;
    getFirst(origin?: ApiUsageOrigin): ITrackMatchService | undefined;
    getNames(): string[];
  };
  apiUsage?: ApiUsageRecorder;
}

export interface HostMapSurfaceRequest {
  host: HTMLElement;
  mapContainer?: HTMLElement;
  mapContainerClass?: string;
  height?: string;
  providerName: string;
  ctx?: MarkdownPostProcessorContext;
  renderPlan: MapRenderPlan;
  isStale?: () => boolean;
  onRerenderRequested?: (reason: string) => Promise<void>;
}

export interface HostMapSurfaceHandle {
  readonly mapContainer: HTMLElement;
  update(plan: MapRenderPlan): Promise<boolean>;
  dispose(): void;
}
