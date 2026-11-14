import { MapPlace } from "../Place";
import { createDiv, emptyElement, setCssProperties } from "../utils/Dom";

export const POPUP_DISABLE_MAPS_ATTRIBUTE = 'data-places-disable-maps';

export function mapsAreDisabledForRender(element: HTMLElement): boolean {
  return element.closest(`[${POPUP_DISABLE_MAPS_ATTRIBUTE}="true"]`) !== null;
}

export function renderSuppressedMapPlaceholder(element: HTMLElement): void {
  emptyElement(element);
  element.classList.add('places-popup-map-suppressed');
  element.style.removeProperty('--places-map-height');
  setCssProperties(element, { height: 'auto', minHeight: '0' });
  createDiv(element, {
    cls: 'places-popup-map-placeholder',
    text: 'Map omitted from popup preview.',
  });
}

export interface RenderedNoteContent {
  dispose(): void;
}

export type NoteContentRenderer = (
  place: MapPlace,
  container: HTMLElement,
) => Promise<RenderedNoteContent | null>;
