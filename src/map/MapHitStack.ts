import type * as GeoJSON from 'geojson';
import type { MapPlace } from '../Place';
import { getPlaceId } from '../track/TrackVisibilityResolver';
import { resolveOverlayPointIcon, resolveOverlayPointName } from './PopupBuilder';

export type MapHitKind = 'marker' | 'waypoint' | 'track' | 'feature';

export interface MapHit {
  readonly kind: MapHitKind;
  readonly place: MapPlace;
  readonly id: string;
  readonly order: number;
  readonly label: string;
  readonly icon?: string;
  readonly kinds: readonly MapHitKind[];
  readonly feature?: GeoJSON.Feature;
  readonly sourcePath?: string;
  readonly layerId?: string;
}

const KIND_ORDER: readonly MapHitKind[] = ['marker', 'waypoint', 'track', 'feature'];

export function createMapHit(kind: MapHitKind, place: MapPlace, order: number): MapHit {
  return {
    kind,
    place,
    id: getPlaceId(place),
    order,
    label: place.name || place.filePath || 'Untitled',
    icon: place.icon,
    kinds: [kind],
  };
}

export function createOverlayPointHit(feature: GeoJSON.Feature, order: number, sourcePath?: string): MapHit | undefined {
  if (feature.geometry?.type !== 'Point') return undefined;

  const [longitude, latitude] = feature.geometry.coordinates;
  const properties = feature.properties ?? {};
  const name = resolveOverlayPointName(properties, sourcePath);
  const icon = resolveOverlayPointIcon(properties);

  return {
    kind: 'waypoint',
    place: { latitude, longitude, name, icon },
    id: `point:${longitude},${latitude}:${name}`,
    order,
    label: name,
    icon,
    kinds: ['waypoint'],
    feature,
    ...(sourcePath ? { sourcePath } : {}),
  };
}

export function createFeatureHit(feature: GeoJSON.Feature, order: number, options: { layerId: string; label: string; coordinate: { latitude: number; longitude: number } }): MapHit {
  const key = feature.id ?? JSON.stringify(feature.properties ?? {});

  return {
    kind: 'feature',
    place: { latitude: options.coordinate.latitude, longitude: options.coordinate.longitude, name: options.label, icon: '' },
    id: `feature:${options.layerId}:${String(key)}`,
    order,
    label: options.label,
    kinds: ['feature'],
    feature,
    layerId: options.layerId,
  };
}

export function orderMapHits(hits: readonly MapHit[]): MapHit[] {
  const byId = new Map<string, MapHit>();

  for (const hit of [...hits].sort((left, right) =>
    KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) || left.order - right.order)) {
    const existing = byId.get(hit.id);

    if (!existing) {
      byId.set(hit.id, hit);
      continue;
    }

    if (existing.kinds.includes(hit.kind)) continue;
    byId.set(hit.id, { ...existing, kinds: [...existing.kinds, hit.kind] });
  }

  return [...byId.values()];
}
