export interface FrequencyPopupOptions {
    frequency: number;
    contributingFiles: string[];
    onLinkClick?: (linkPath: string) => void;
}
export declare function buildFrequencyPopupContent(options: FrequencyPopupOptions): HTMLElement;
