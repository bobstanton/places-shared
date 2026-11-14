import { App, Component } from 'obsidian';
import type { MapPlace } from '../../place/index';
import { mapsAreDisabledForRender, POPUP_DISABLE_MAPS_ATTRIBUTE, renderSuppressedMapPlaceholder, type PopupRenderer, type PopupTarget, type RenderedNoteContent } from '../../map/index';
import { type PopupContentConfig } from '../../settings/index';
export { mapsAreDisabledForRender, POPUP_DISABLE_MAPS_ATTRIBUTE, renderSuppressedMapPlaceholder };
export declare function popupContentSignal(content: Node): AbortSignal;
export declare function ownPopupContent(content: Node, onClose: (dispose: () => void) => void): void;
export interface RenderedPopupContent extends RenderedNoteContent {
    component: Component;
}
export interface AsyncPopupRenderOptions {
    readonly onRendered?: () => void;
    readonly markdownSourcePath?: string;
    readonly popupRenderers?: readonly PopupRenderer[];
}
export declare function renderPopupTargetContentCore(app: App, target: PopupTarget, config: PopupContentConfig | undefined, containerElement: HTMLElement, popupRenderers?: readonly PopupRenderer[]): Promise<RenderedPopupContent | null>;
export declare function renderPopupContentCore(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null>;
export declare function renderPopupContent(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null>;
export declare function renderPopupContentAsync(app: App, place: MapPlace, containerElement: HTMLElement, config?: PopupContentConfig, options?: AsyncPopupRenderOptions): void;
export declare function renderFeaturePopupContentAsync(app: App, target: Extract<PopupTarget, {
    kind: 'feature';
}>, config: PopupContentConfig | undefined, containerElement: HTMLElement, options?: AsyncPopupRenderOptions): void;
