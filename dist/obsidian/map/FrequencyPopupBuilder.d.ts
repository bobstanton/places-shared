import type { App } from 'obsidian';
export interface FrequencyPopupOptions {
    frequency: number;
    contributingFiles: string[];
    app?: App;
}
export declare function createFrequencyPopup(options: FrequencyPopupOptions): HTMLElement;
