import { sharedRegistryValue } from '../utils/CrossBundleRegistry';
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

const inert: HostPrimitives = {
  setIcon: () => undefined,
  notify: () => undefined,
  isMobile: false,
  renderNoteContent: () => Promise.resolve(null),
  renderMarkdown: (markdown, element) => { element.textContent = markdown;

 return Promise.resolve(); },
  prepareCodeHighlighting: () => Promise.resolve(),
};

const PRIMITIVES_KEY = Symbol.for('places.host.primitives');

interface PrimitivesState {
  primitives: HostPrimitives;
}

const state = sharedRegistryValue<PrimitivesState>(PRIMITIVES_KEY, () => ({ primitives: inert }));

export function configureHostPrimitives(primitives: Partial<HostPrimitives>): void {
  state.primitives = { ...state.primitives, ...primitives };
}

export function hostPrimitives(): HostPrimitives {
  return state.primitives;
}

export function setIcon(element: HTMLElement, iconName: string): void {
  state.primitives.setIcon(element, iconName);
}

export function notify(message: string): void {
  state.primitives.notify(message);
}

export function isMobileHost(): boolean {
  return state.primitives.isMobile;
}

export function resetHostPrimitives(): void {
  state.primitives = inert;
}

export function renderMarkdown(markdown: string, element: HTMLElement, sourcePath: string, owner: RenderOwner): Promise<void> {
  return state.primitives.renderMarkdown(markdown, element, sourcePath, owner);
}

export function prepareCodeHighlighting(): Promise<unknown> {
  return state.primitives.prepareCodeHighlighting();
}
