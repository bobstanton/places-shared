import type * as GeoJSON from 'geojson';
import type { GeoJSONSourceDiff } from 'maplibre-gl';

export type KeyedSourceSubmission = { kind: 'full'; data: GeoJSON.FeatureCollection } | { kind: 'diff'; diff: GeoJSONSourceDiff } | { kind: 'unchanged' };

type FeatureId = string | number;

const UNKNOWN_CONTENT: GeoJSON.Feature = Object.freeze<GeoJSON.Feature>({ type: 'Feature', properties: null, geometry: { type: 'Point', coordinates: [] } });

export class KeyedSourceFeed {
  private submitted: Map<FeatureId, GeoJSON.Feature> | null = null;

  constructor(private readonly orderMatters: boolean) {}

  recordWhole(features: readonly GeoJSON.Feature[]): void {
    this.submitted = keyedFeatures(features);
  }

  forget(id: FeatureId): void {
    if (this.submitted?.has(id)) this.submitted.set(id, UNKNOWN_CONTENT);
  }

  submit(features: GeoJSON.Feature[], canDiff: boolean): KeyedSourceSubmission {
    const next = keyedFeatures(features);
    const previous = this.submitted;

    if (!canDiff || !next || !previous || (this.orderMatters && !keepsOrder(previous, features))) {
      this.submitted = next;

      return { kind: 'full', data: { type: 'FeatureCollection', features } };
    }

    const remove: FeatureId[] = [];

    for (const id of previous.keys()) if (!next.has(id)) remove.push(id);
    const add: GeoJSON.Feature[] = [];

    for (const [id, feature] of next) if (previous.get(id) !== feature) add.push(feature);
    if (remove.length === 0 && add.length === 0) return { kind: 'unchanged' };

    if (remove.length + add.length > next.size / 2) {
      this.submitted = next;

      return { kind: 'full', data: { type: 'FeatureCollection', features } };
    }

    for (const id of remove) previous.delete(id);
    for (const feature of add) previous.set(feature.id!, feature);

    return { kind: 'diff', diff: { remove, add } };
  }
}

function keyedFeatures(features: readonly GeoJSON.Feature[]): Map<FeatureId, GeoJSON.Feature> | null {
  const keyed = new Map<FeatureId, GeoJSON.Feature>();

  for (const feature of features) {
    const id = feature.id;

    if (id === undefined || id === null || keyed.has(id)) return null;
    keyed.set(id, feature);
  }

  return keyed;
}

function keepsOrder(previous: ReadonlyMap<FeatureId, GeoJSON.Feature>, features: readonly GeoJSON.Feature[]): boolean {
  const position = new Map<FeatureId, number>();
  let index = 0;

  for (const id of previous.keys()) position.set(id, index++);
  let last = -1;
  let appending = false;

  for (const feature of features) {
    const at = position.get(feature.id!);

    if (at === undefined) {
      appending = true;
      continue;
    }

    if (appending || at < last) return false;
    last = at;
  }

  return true;
}
