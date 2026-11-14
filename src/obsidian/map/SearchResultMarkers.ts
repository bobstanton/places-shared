import type { MapPlace } from '../../place/index';
import { getMapContainerState, setMapContainerState } from '../../map/MapContainerState';

export interface RemovableMapMarker {
  remove: () => void;
}

const SEARCH_RESULT_MARKER_CLASS = 'places-marker-search-result';

export function getStoredSearchResultMarkers<TMarker extends RemovableMapMarker>(container: HTMLElement): TMarker[] {
  return (getMapContainerState(container)?.searchResultMarkers || []) as TMarker[];
}

export function setStoredSearchResultMarkers<TMarker extends RemovableMapMarker>(container: HTMLElement, markers: TMarker[]): void {
  setMapContainerState(container, { searchResultMarkers: markers });
}

export function createSearchResultMarkerElement(place: MapPlace): HTMLElement {
  const el = createDiv({ cls: `places-marker ${SEARCH_RESULT_MARKER_CLASS}` });
  const iconEl = createDiv({ cls: 'places-marker-icon' });

  iconEl.setText(place.icon);
  el.appendChild(iconEl);

  return el;
}

export interface SetSearchResultMarkersOptions<TMarker extends RemovableMapMarker> {
  container: HTMLElement;
  places: MapPlace[];
  createMarker: (place: MapPlace, element: HTMLElement) => TMarker;
  onMarkerClick: (place: MapPlace) => void;
  focus: { enter(): void; clear(): void };
}

export function setSearchResultMarkers<TMarker extends RemovableMapMarker>(options: SetSearchResultMarkersOptions<TMarker>): void {
  const { container, places } = options;

  getStoredSearchResultMarkers<TMarker>(container).forEach(marker => marker.remove());
  const markers: TMarker[] = [];

  setStoredSearchResultMarkers(container, markers);

  if (places.length === 0) {
    options.focus.clear();

    return;
  }

  options.focus.enter();

  for (const place of places) {
    const element = createSearchResultMarkerElement(place);
    const marker = options.createMarker(place, element);

    element.addEventListener('click', (event) => {
      event.stopPropagation();
      options.onMarkerClick(place);
    });
    markers.push(marker);
  }

  setStoredSearchResultMarkers(container, markers);
}
