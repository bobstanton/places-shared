import type * as GeoJSON from 'geojson';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import type { MapPlace } from "../overlay/index";

export interface ViewportBucketTrack {
  place: MapPlace;
  signature: string;
}

export type ViewportBucketUpdate = ({
  initial: GeoJSON.FeatureCollection;
  diff?: never;
} | {
  initial?: never;
  diff: GeoJSONSourceDiff;
}) & { snapshot?: GeoJSON.FeatureCollection };

export class ViewportTrackBucketData {
  private tracks = new Map<string, { signature: string; ids: number[] }>();
  private initialized = false;
  private nextFeatureId = 1;
  private readonly features: Map<number, GeoJSON.Feature> | undefined;
  private readonly paintDefaults: [string, unknown][] | undefined;

  constructor(snapshotUpdates = false, paintDefaults?: Readonly<Record<string, unknown>>) {
    if (snapshotUpdates) this.features = new Map();
    if (paintDefaults) this.paintDefaults = Object.entries(paintDefaults);
  }

  update(next: ReadonlyMap<string, ViewportBucketTrack>, build: (place: MapPlace) => GeoJSON.Feature[]): ViewportBucketUpdate | null {
    const remove: number[] = [];
    const add: GeoJSON.Feature[] = [];

    for (const [id, track] of this.tracks) {
      if (next.has(id)) continue;
      for (const featureId of track.ids) remove.push(featureId);
      this.tracks.delete(id);
    }

    for (const [id, track] of next) {
      const previous = this.tracks.get(id);

      if (previous?.signature === track.signature) continue;
      const features = build(track.place).map((feature, index) => {
        let properties = feature.properties;

        if (this.paintDefaults && (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString')) {
          properties = { ...properties };

          for (const [key, value] of this.paintDefaults) {
            if (properties[key] === value) delete properties[key];
          }
        }

        return { ...feature, properties, id: previous?.ids[index] ?? this.nextFeatureId++ };
      });

      for (const featureId of previous?.ids.slice(features.length) ?? []) remove.push(featureId);
      this.tracks.set(id, { signature: track.signature, ids: features.map(feature => feature.id) });
      for (const feature of features) add.push(feature);
    }

    if (this.features) {
      for (const id of remove) this.features.delete(id);
      for (const feature of add) this.features.set(feature.id as number, feature);
    }

    if (!this.initialized) {
      this.initialized = true;

      return { initial: { type: 'FeatureCollection', features: add } };
    }

    return remove.length || add.length ? {
      diff: { remove, add },
      ...(this.features ? { snapshot: { type: 'FeatureCollection', features: [...this.features.values()] } } : {}),
    } : null;
  }
}
