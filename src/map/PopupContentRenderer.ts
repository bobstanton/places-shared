import { logger } from '../utils/logger';
import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { MapPlace } from "../Place";

export const POPUP_DISABLE_MAPS_ATTRIBUTE = 'data-places-disable-maps';

export interface RenderedPopupContent {
  component: Component;
  dispose(): void;
}

export function mapsAreDisabledForRender(element: HTMLElement): boolean {
  return element.closest(`[${POPUP_DISABLE_MAPS_ATTRIBUTE}="true"]`) !== null;
}

export function renderSuppressedMapPlaceholder(element: HTMLElement): void {
  element.empty();
  element.addClass('places-popup-map-suppressed');
  element.style.removeProperty('--places-map-height');
  element.setCssProps({ height: 'auto', minHeight: '0' });
  element.createDiv({
    cls: 'places-popup-map-placeholder',
    text: 'Map omitted from popup preview.',
  });
}

export async function renderPopupContentCore(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null> {
  const file = app.vault.getAbstractFileByPath(place.filePath!);
  if (!(file instanceof TFile)) return null;

  const content = await app.vault.cachedRead(file);
  const component = new Component();
  component.load();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    component.unload();
  };

  const noteElement = containerElement.createDiv({ cls: 'places-popup-note' });
  noteElement.setAttribute(POPUP_DISABLE_MAPS_ATTRIBUTE, 'true');

  try {
    await MarkdownRenderer.render(app, content, noteElement, place.filePath!, component);
    return { component, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

export async function renderPopupContent(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null> {
  if (!place.filePath) return null;
  try {
    return await renderPopupContentCore(app, place, containerElement);
  } catch (error) {
    logger.error(`Failed to load content for ${place.filePath}:`, error);
    return null;
  }
}

// Leaflet builds popup content before attaching it and does not expose the
// popup object here. Keep the component alive after first attachment, then
// unload it when the rendered content leaves the document.
export function renderPopupContentAsync(app: App, place: MapPlace, containerElement: HTMLElement): void {
  if (!place.filePath) return;

  const loadingEl = containerElement.createDiv({
    text: "Loading...",
    cls: "places-popup-loading"
  });

  void (async () => {
    try {
      const rendered = await renderPopupContentCore(app, place, containerElement);
      loadingEl.remove();
      if (!rendered) return;

      let wasConnected = containerElement.isConnected;
      const Observer = (containerElement.ownerDocument.defaultView)?.MutationObserver ?? MutationObserver;
      const observer = new Observer(() => {
        wasConnected ||= containerElement.isConnected;
        if (wasConnected && !containerElement.isConnected) {
          observer.disconnect();
          rendered.dispose();
        }
      });
      // Parent scope: observing the whole document wakes this fallback on every unrelated mutation.
      observer.observe(containerElement.parentNode ?? activeDocument, { childList: true, subtree: true });
    } catch (error) {
      loadingEl.textContent = "Error loading content";
      logger.error(`Failed to load content for ${place.filePath}:`, error);
    }
  })();
}
