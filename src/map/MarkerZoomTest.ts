import { Notice } from 'obsidian';
import type { MapPlace } from '../Place';
import { sleep } from '../utils/Utilities';

export interface MarkerZoomTestOptions {
  minZoom?: number;
  maxZoom?: number;
  delayMs?: number;
  providerName?: string;
}

interface MarkerZoomTestState {
  cancelled: boolean;
}

const activeTests = new WeakMap<HTMLElement, MarkerZoomTestState>();

function getMarkerPlaces(places: MapPlace[]): MapPlace[] {
  return places.filter((place) =>
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.metadata?.boundsAnchor !== true
  );
}

export async function runMarkerZoomTest(
  container: HTMLElement,
  places: MapPlace[],
  zoomToPlace: (place: MapPlace, zoom: number) => void | Promise<void>,
  getVisiblePlaces: (places: MapPlace[]) => MapPlace[],
  options: MarkerZoomTestOptions = {}
): Promise<void> {
  const activeTest = activeTests.get(container);
  if (activeTest) {
    activeTest.cancelled = true;
    activeTests.delete(container);
    new Notice(`${options.providerName ? `${options.providerName}: ` : ''}Marker zoom test stopped`);
    return;
  }

  const markerPlaces = getMarkerPlaces(places);
  if (markerPlaces.length === 0) {
    new Notice('No map markers to zoom through');
    return;
  }

  const minZoom = options.minZoom ?? 1;
  const maxZoom = options.maxZoom ?? 18;
  const delayMs = options.delayMs ?? 750;
  const providerPrefix = options.providerName ? `${options.providerName}: ` : '';
  const testState: MarkerZoomTestState = { cancelled: false };
  activeTests.set(container, testState);
  const seenByZoom = new Map<number, WeakSet<MapPlace>>();

  new Notice(`${providerPrefix}Sweeping zoom ${minZoom}-${maxZoom} for ${markerPlaces.length} marker${markerPlaces.length === 1 ? '' : 's'}`);

  try {
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      let seenAtZoom = seenByZoom.get(zoom);
      if (!seenAtZoom) {
        seenAtZoom = new WeakSet<MapPlace>();
        seenByZoom.set(zoom, seenAtZoom);
      }

      for (const place of markerPlaces) {
        if (testState.cancelled) return;
        if (seenAtZoom.has(place)) continue;

        await zoomToPlace(place, zoom);
        await sleep(delayMs);

        seenAtZoom.add(place);
        for (const visiblePlace of getVisiblePlaces(markerPlaces)) {
          seenAtZoom.add(visiblePlace);
        }
      }
    }

    new Notice(`${providerPrefix}Marker zoom test complete`);
  } finally {
    if (activeTests.get(container) === testState) {
      activeTests.delete(container);
    }
  }
}
