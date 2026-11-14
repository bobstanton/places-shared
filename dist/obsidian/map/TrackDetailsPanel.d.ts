import type { MapPlace } from '../../place/index';
import type { TrackInspection } from '../../settings/index';
export type InspectTrack = (place: MapPlace, coordinate: {
    latitude: number;
    longitude: number;
}, signal?: AbortSignal) => Promise<TrackInspection | null>;
export interface TrackDetailsPanelOptions {
    readonly container: HTMLElement;
    readonly openLink: (linkPath: string) => void;
    readonly onDispose?: () => void;
}
export declare class TrackDetailsPanel {
    private readonly options;
    private readonly element;
    private readonly titleEl;
    private readonly bodyEl;
    private readonly listener;
    private place?;
    private inspect?;
    private requestVersion;
    private inspectionController;
    private timer?;
    private pendingCoordinate?;
    private disposed;
    constructor(options: TrackDetailsPanelOptions);
    show(place: MapPlace, coordinate: {
        latitude: number;
        longitude: number;
    }, inspect: InspectTrack | undefined): void;
    dispose(): void;
    private scheduleUpdate;
    private update;
}
