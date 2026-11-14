import type { RenderOwner } from '../ui/RenderLifetime';
import type { NoteContentRenderer } from '../map/PopupSuppression';
export type IconRenderer = (element: HTMLElement, iconName: string) => void;
export type Notifier = (message: string) => void;
export interface HostPrimitives {
    setIcon: IconRenderer;
    notify: Notifier;
    isMobile: boolean;
    renderNoteContent: NoteContentRenderer;
    renderMarkdown: (markdown: string, element: HTMLElement, sourcePath: string, owner: RenderOwner) => Promise<void>;
    prepareCodeHighlighting: () => Promise<unknown>;
}
export declare function configureHostPrimitives(primitives: Partial<HostPrimitives>): void;
export declare function hostPrimitives(): HostPrimitives;
export declare function setIcon(element: HTMLElement, iconName: string): void;
export declare function notify(message: string): void;
export declare function isMobileHost(): boolean;
export declare function resetHostPrimitives(): void;
export declare function renderMarkdown(markdown: string, element: HTMLElement, sourcePath: string, owner: RenderOwner): Promise<void>;
export declare function prepareCodeHighlighting(): Promise<unknown>;
