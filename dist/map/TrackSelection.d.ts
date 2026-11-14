import type { MapPlace } from '../Place';
export declare const MAP_TRACK_SELECTION_EVENT = "places-map-track-selection";
export type MapTrackSelectionIntent = 'preview' | 'commit';
export type MapTrackSelectionSource = 'map-click' | 'popup-action';
export interface MapTrackSelection {
    readonly place: MapPlace;
    readonly coordinate?: {
        readonly latitude: number;
        readonly longitude: number;
    };
    readonly intent: MapTrackSelectionIntent;
    readonly source: MapTrackSelectionSource;
}
export declare function dispatchMapTrackSelection(target: HTMLElement, selection: MapTrackSelection): void;
export declare function onMapTrackSelection(target: HTMLElement, handler: (selection: MapTrackSelection) => void): () => void;
