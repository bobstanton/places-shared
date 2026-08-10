import type { MapPlace } from '../Place';
import type { TrackInspection } from '../settings/MapConfiguration';
export declare function renderTrackInspectionFields(container: HTMLElement, fields: TrackInspection['fields']): void;
export interface TrackInspectionSectionOptions {
    readonly host: HTMLElement;
    readonly place: MapPlace;
    readonly coordinate: {
        readonly latitude: number;
        readonly longitude: number;
    };
    readonly inspectTrack: (place: MapPlace, coordinate: {
        latitude: number;
        longitude: number;
    }) => Promise<TrackInspection | null>;
    readonly onRendered?: () => void;
}
export declare function appendTrackInspectionSection(options: TrackInspectionSectionOptions): void;
