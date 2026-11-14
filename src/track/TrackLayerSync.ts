import type { MapPlace } from '../Place';
import { PlacesBoundingBox } from '../geo/PlacesBoundingBox';
import { getPlaceId, getPlaceTrackRenderHash, getTrackStateRenderSignature, type PlaceTrackState, type TrackVisibilityResult } from './TrackVisibilityResolver';

export function getTrackRenderSignature(place: MapPlace, visibility?: TrackVisibilityResult): string {
  const state = visibility?.placeStateMap.get(getPlaceId(place));

  return state ? getTrackStateRenderSignature(state) : getPlaceTrackRenderHash(place);
}

export interface VisibleTrackEntry<TSettings> {
  place: MapPlace;
  settings: TSettings;
  renderSignature: string;
}

export interface VisibleTrackEngine<TSettings, TEntry extends VisibleTrackEntry<TSettings>> {
  isVisible?(state: PlaceTrackState): boolean;
  remove(placeId: string, entry: TEntry): void;
  add(state: PlaceTrackState): void;
}

export function syncVisibleTrackEntries<TSettings, TEntry extends VisibleTrackEntry<TSettings>>(
  visible: Map<string, TEntry>,
  nextVisibility: TrackVisibilityResult,
  nextSettings: TSettings,
  engine: VisibleTrackEngine<TSettings, TEntry>,
): void {
  const nextVisibleStates = new Map(
    nextVisibility.placeStates
      .filter(state => engine.isVisible ? engine.isVisible(state) : state.showOnLoad)
      .map(state => [state.placeId, state])
  );

  for (const [placeId, entry] of Array.from(visible.entries())) {
    const nextState = nextVisibleStates.get(placeId);
    const nextSignature = nextState ? getTrackStateRenderSignature(nextState) : undefined;

    if (!nextState || !nextSignature || entry.renderSignature !== nextSignature) {
      engine.remove(placeId, entry);
      visible.delete(placeId);
    }
  }

  for (const state of nextVisibleStates.values()) {
    const existing = visible.get(state.placeId);

    if (!existing) {
      engine.add(state);
    } else {
      existing.place = state.place;
      existing.settings = nextSettings;
      existing.renderSignature = getTrackStateRenderSignature(state);
    }
  }
}

export interface GeoBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface ViewportTrackCandidate {
  place: MapPlace;
  placeId: string;
  bounds: GeoBounds;
}

export function collectViewportTrackCandidates(places: readonly MapPlace[]): ViewportTrackCandidate[] {
  const candidates: ViewportTrackCandidate[] = [];

  for (const place of places) {
    if (!place.overlay?.geojson) continue;
    const bbox = PlacesBoundingBox.fromImmutableGeoJSON(place.overlay.geojson);

    if (!bbox.isValid()) continue;
    candidates.push({ place, placeId: getPlaceId(place), bounds: { minLng: bbox.minLng, maxLng: bbox.maxLng, minLat: bbox.minLat, maxLat: bbox.maxLat } });
  }

  return candidates;
}

export interface ViewportTrackSelection<T extends ViewportTrackCandidate> {
  desired: T[];
  add: T[];
  remove: T[];
}

export interface ViewportTrackMargins {
  enter: number;
  retain: number;
}

const DEFAULT_VIEWPORT_TRACK_MARGINS: Readonly<ViewportTrackMargins> = { enter: 0.05, retain: 0.15 };

export function selectViewportTracks<T extends ViewportTrackCandidate>(
  candidates: readonly T[],
  view: GeoBounds,
  options: {
    margins?: Readonly<ViewportTrackMargins>;
    minimumMarginDegrees?: number;
    worldCopies?: boolean;
    isHidden?: (placeId: string) => boolean;
    isActive: (candidate: T) => boolean;
  },
): ViewportTrackSelection<T> {
  const margins = options.margins ?? DEFAULT_VIEWPORT_TRACK_MARGINS;
  const east = view.maxLng < view.minLng ? view.maxLng + 360 * Math.ceil((view.minLng - view.maxLng) / 360) : view.maxLng;
  const width = east - view.minLng;
  const height = view.maxLat - view.minLat;
  const desired: T[] = [];
  const add: T[] = [];
  const remove: T[] = [];

  for (const candidate of candidates) {
    const hidden = options.isHidden?.(candidate.placeId) ?? false;
    const active = options.isActive(candidate);
    const fraction = active ? margins.retain : margins.enter;
    const lngMargin = Math.max(options.minimumMarginDegrees ?? 0, width * fraction);
    const latMargin = Math.max(options.minimumMarginDegrees ?? 0, height * fraction);
    const west = view.minLng - lngMargin;
    const paddedEast = east + lngMargin;
    const longitudeIntersects = options.worldCopies
      ? Math.ceil((west - candidate.bounds.maxLng) / 360) <= Math.floor((paddedEast - candidate.bounds.minLng) / 360)
      : candidate.bounds.minLng <= paddedEast && candidate.bounds.maxLng >= west;
    const intersects = !hidden
      && longitudeIntersects
      && candidate.bounds.minLat <= view.maxLat + latMargin
      && candidate.bounds.maxLat >= view.minLat - latMargin;

    if (intersects) desired.push(candidate);

    if (intersects && !active) add.push(candidate);
    else if (!intersects && active) remove.push(candidate);
  }

  return { desired, add, remove };
}
