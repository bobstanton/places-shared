export interface PopupNoteSectionConfig {
    readonly type: 'note';
}
export interface PopupRendererSectionConfig {
    readonly type: 'renderer';
    readonly rendererId: string;
    readonly options?: PopupRendererOptions;
}
export type PopupRendererOptions = Readonly<Record<string, unknown>>;
export type PopupContentSectionConfig = PopupNoteSectionConfig | PopupRendererSectionConfig;
export interface PopupContentConfig {
    readonly content?: readonly PopupContentSectionConfig[];
    readonly rendererOptions?: Readonly<Record<number, PopupRendererOptions>>;
}
export declare function parsePopupContentConfig(value: unknown, path?: string): PopupContentConfig | undefined;
export declare function parsePopupRendererOptions(value: unknown, path?: string): PopupRendererOptions;
export declare function mergePopupContentConfig(lower: PopupContentConfig | undefined, higher: PopupContentConfig | undefined): PopupContentConfig | undefined;
export declare function resolvePopupSections(config: PopupContentConfig): readonly PopupContentSectionConfig[];
export declare function isPopupRendererId(value: string): boolean;
