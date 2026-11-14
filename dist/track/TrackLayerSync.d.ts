import type { MapPlace } from '../Place';
import { type PlaceTrackState, type TrackVisibilityResult } from './TrackVisibilityResolver';
export declare function getTrackRenderSignature(place: MapPlace, visibility?: TrackVisibilityResult): string;
export interface VisibleTrackEntry<TSettings> {
    place: MapPlace;
    settings: TSettings;
    renderSignature: string;
}
export interface VisibleTrackEngine<TSettings, TEntry extends VisibleTrackEntry<TSettings>> {
    isVisible?(state: PlaceTrackState): boolean;
    remove(placeId: string, entry: TEntry): void;
    add(state: PlaceTrackState): void;
}
export declare function syncVisibleTrackEntries<TSettings, TEntry extends VisibleTrackEntry<TSettings>>(visible: Map<string, TEntry>, nextVisibility: TrackVisibilityResult, nextSettings: TSettings, engine: VisibleTrackEngine<TSettings, TEntry>): void;
export interface GeoBounds {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
}
export interface ViewportTrackCandidate {
    place: MapPlace;
    placeId: string;
    bounds: GeoBounds;
}
export declare function collectViewportTrackCandidates(places: readonly MapPlace[]): ViewportTrackCandidate[];
export interface ViewportTrackSelection<T extends ViewportTrackCandidate> {
    desired: T[];
    add: T[];
    remove: T[];
}
export interface ViewportTrackMargins {
    enter: number;
    retain: number;
}
export declare function selectViewportTracks<T extends ViewportTrackCandidate>(candidates: readonly T[], view: GeoBounds, options: {
    margins?: Readonly<ViewportTrackMargins>;
    minimumMarginDegrees?: number;
    worldCopies?: boolean;
    isHidden?: (placeId: string) => boolean;
    isActive: (candidate: T) => boolean;
}): ViewportTrackSelection<T>;
