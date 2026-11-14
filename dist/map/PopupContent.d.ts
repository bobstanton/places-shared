import type * as GeoJSON from 'geojson';
import type { MapPlace } from '../Place';
import type { PopupRendererOptions } from '../settings/PopupConfiguration';
export declare const KNOWN_PLACE_CONTEXT_KEYS: Set<string>;
export interface PlacePopupTarget {
    readonly kind: 'place';
    readonly place: MapPlace;
    readonly markdownSourcePath?: string;
}
export interface FeaturePopupTarget {
    readonly kind: 'feature';
    readonly feature: GeoJSON.Feature;
    readonly sourcePath?: string;
    readonly index?: number;
    readonly presentation?: 'feature' | 'point';
    readonly markdownSourcePath?: string;
}
export type PopupTarget = PlacePopupTarget | FeaturePopupTarget;
export interface ResolvedPopupField {
    readonly label: string;
    readonly value: string;
}
export type PopupRendererOutputSection = {
    readonly type: 'fields';
    readonly fields: readonly ResolvedPopupField[];
} | {
    readonly type: 'markdown';
    readonly markdown: string;
} | {
    readonly type: 'note';
};
export interface PopupRendererRequest {
    readonly target: PopupTarget;
    readonly context: Readonly<Record<string, unknown>>;
    readonly markdownSourcePath?: string;
    readonly options?: PopupRendererOptions;
}
export interface PopupRendererMetadata {
    readonly id: string;
    readonly description?: string;
}
export interface PortablePopupRenderer extends PopupRendererMetadata {
    readonly kind: 'sections';
    render(request: PopupRendererRequest): readonly PopupRendererOutputSection[] | Promise<readonly PopupRendererOutputSection[]>;
}
export interface PopupDomRendererRequest extends PopupRendererRequest {
    readonly container: HTMLElement;
    readonly renderMarkdown: (markdown: string, container?: HTMLElement) => Promise<void>;
    readonly onDispose: (cleanup: () => void) => void;
}
export interface PopupDomRenderer extends PopupRendererMetadata {
    readonly kind: 'dom';
    render(request: PopupDomRendererRequest): void | (() => void) | Promise<void | (() => void)>;
}
export type PopupRenderer = PortablePopupRenderer | PopupDomRenderer;
export declare function toTitleCaseFrontmatterKey(key: string): string;
export declare function buildPlaceTemplateContext(place: MapPlace): Record<string, unknown>;
export declare function buildFeatureTemplateContext(feature: GeoJSON.Feature, index?: number, source?: string): Record<string, unknown>;
export declare function buildPopupTemplateContext(target: PopupTarget): Record<string, unknown>;
export declare function getPopupTargetSourcePath(target: PopupTarget): string | undefined;
export declare function getPopupMarkdownSourcePath(target: PopupTarget): string | undefined;
export declare function formatPopupFieldValue(value: unknown): string;
