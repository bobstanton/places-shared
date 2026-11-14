import type { MarkdownPostProcessorContext } from 'obsidian';
import { createFloatingRefreshButton as createPortableRefreshButton, type FloatingRefreshButtonOptions as PortableOptions } from '../../ui/FloatingRefreshButton';
import { registerCodeBlockActions } from './CodeBlockActions';

export interface FloatingRefreshButtonOptions extends PortableOptions {
  ctx?: MarkdownPostProcessorContext;
}

export function createFloatingRefreshButton(options: FloatingRefreshButtonOptions): HTMLElement {
  return createPortableRefreshButton({
    ...options,
    registerActions: options.registerActions ?? (options.ctx ? container => registerCodeBlockActions(container, options.ctx!) : undefined),
  });
}
