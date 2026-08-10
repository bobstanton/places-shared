import type { MapPlace } from '../Place';

export const MAP_TRACK_SELECTION_EVENT = 'places-map-track-selection';

export type MapTrackSelectionIntent = 'preview' | 'commit';
export type MapTrackSelectionSource = 'map-click' | 'popup-action';

// Shared selection contract used by map tools and parameter-backed actions.
export interface MapTrackSelection {
  readonly place: MapPlace;
  readonly coordinate?: { readonly latitude: number; readonly longitude: number };
  readonly intent: MapTrackSelectionIntent;
  readonly source: MapTrackSelectionSource;
}

export function dispatchMapTrackSelection(target: HTMLElement, selection: MapTrackSelection): void {
  const EventConstructor = target.ownerDocument.defaultView?.CustomEvent ?? CustomEvent;
  target.dispatchEvent(new EventConstructor<MapTrackSelection>(MAP_TRACK_SELECTION_EVENT, {
    detail: selection,
    bubbles: true,
  }));
}

export function onMapTrackSelection(target: HTMLElement, handler: (selection: MapTrackSelection) => void): () => void {
  const listener = (event: Event): void => {
    const selection = (event as CustomEvent<MapTrackSelection>).detail;
    if (selection?.place) handler(selection);
  };
  target.addEventListener(MAP_TRACK_SELECTION_EVENT, listener);
  return () => target.removeEventListener(MAP_TRACK_SELECTION_EVENT, listener);
}
