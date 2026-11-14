import type { MarkdownPostProcessorContext } from 'obsidian';
import { type FloatingRefreshButtonOptions as PortableOptions } from '../../ui/FloatingRefreshButton';
export interface FloatingRefreshButtonOptions extends PortableOptions {
    ctx?: MarkdownPostProcessorContext;
}
export declare function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement;
