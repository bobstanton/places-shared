import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { TrackData } from '../geo/TrackTypes';
import type { MapRenderPlan } from "../render/MapRenderPlan";
import type { MapConfigPatch, ResolvedMapConfig } from "../settings/MapConfiguration";
import type { ConfigWarning } from "../settings/MapConfigResolver";
import { ITrackMatchService } from './ITrackMatchService';
export type SharedParameterValue = string | number | boolean | string[] | {
    min: number;
    max: number;
} | null;
export interface SharedSelection {
    kind: string;
    id?: string;
    label?: string;
    path?: string;
    coordinate?: {
        latitude: number;
        longitude: number;
    };
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
export declare const SHARED_PARAMETER_NAMES: {
    readonly startDate: "startDate";
    readonly endDate: "endDate";
    readonly selectedItem: "selectedItem";
    readonly selectedPoint: "selectedPoint";
};
export interface IPlacesHostServices {
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
        loadTrackFromPath(pathSetting: string, sourcePath: string, options?: {
            skipCache?: boolean;
        }): Promise<TrackData>;
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
        }): {
            config: ResolvedMapConfig;
            clusteringEnabled: boolean;
        };
        renderMapSurface(request: HostMapSurfaceRequest): Promise<boolean>;
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
    renderPlan: MapRenderPlan;
}
