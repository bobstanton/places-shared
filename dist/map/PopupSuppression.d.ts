import { MapPlace } from "../Place";
export declare const POPUP_DISABLE_MAPS_ATTRIBUTE = "data-places-disable-maps";
export declare function mapsAreDisabledForRender(element: HTMLElement): boolean;
export declare function renderSuppressedMapPlaceholder(element: HTMLElement): void;
export interface RenderedNoteContent {
    dispose(): void;
}
export type NoteContentRenderer = (place: MapPlace, container: HTMLElement) => Promise<RenderedNoteContent | null>;
