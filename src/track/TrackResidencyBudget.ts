import type { GeoJsonFootprint } from '../geo/GeoJsonFootprint';

export interface ResidentTrackCost extends GeoJsonFootprint {
  id: string;
  active: boolean;
}

export interface TrackResidencySnapshot extends GeoJsonFootprint {
  maps: number;
  tracks: number;
  activeBytes: number;
  retainedBytes: number;
  overBudgetBytes: number;
  budgetBytes: number;
}

interface Owner {
  limit: number;
  entries: Map<string, ResidentTrackCost & { used: number }>;
  evict(ids: readonly string[]): void;
}

export interface TrackResidencyLease {
  update(entries: readonly ResidentTrackCost[]): ReadonlySet<string>;
  snapshot(): TrackResidencySnapshot;
  dispose(): void;
}

export class TrackResidencyBudget {
  private readonly owners = new Set<Owner>();
  private clock = 0;

  constructor(private readonly maxBytes: number, private readonly perMapBytes: number) {}

  open(evict: (ids: readonly string[]) => void): TrackResidencyLease {
    const owner: Owner = { limit: this.perMapBytes, entries: new Map(), evict };

    this.owners.add(owner);
    let disposed = false;

    return {
      update: entries => {
        if (disposed) return new Set();
        const previous = owner.entries;

        owner.entries = new Map(entries.map(entry => [entry.id, {
          ...entry, used: entry.active ? ++this.clock : previous.get(entry.id)?.used ?? ++this.clock,
        }]));
        this.trim(owner);

        return new Set(owner.entries.keys());
      },
      snapshot: () => this.snapshot(owner),
      dispose: () => { disposed = true; owner.entries.clear(); this.owners.delete(owner); },
    };
  }

  snapshot(owner?: Owner): TrackResidencySnapshot {
    const owners = owner ? [owner] : this.owners;
    const budgetBytes = owner ? owner.limit : this.maxBytes;
    const result: TrackResidencySnapshot = { features: 0, vertices: 0, estimatedBytes: 0, maps: owner ? 1 : this.owners.size,
      tracks: 0, activeBytes: 0, retainedBytes: 0, overBudgetBytes: 0, budgetBytes };

    for (const current of owners) for (const entry of current.entries.values()) {
      result.features += entry.features;
      result.vertices += entry.vertices;
      result.estimatedBytes += entry.estimatedBytes;
      result.tracks++;

      if (entry.active) result.activeBytes += entry.estimatedBytes;
      else result.retainedBytes += entry.estimatedBytes;
    }

    result.overBudgetBytes = Math.max(0, result.estimatedBytes - budgetBytes);

    return result;
  }

  private trim(updating: Owner): void {
    const evicted = new Map<Owner, string[]>();
    const remove = (owner: Owner, id: string): void => {
      owner.entries.delete(id);
      let ids = evicted.get(owner);

      if (!ids) evicted.set(owner, ids = []);
      ids.push(id);
    };
    const optional = [...this.owners].flatMap(owner => [...owner.entries.values()]
      .filter(entry => !entry.active).map(entry => ({ owner, entry })))
      .sort((a, b) => a.entry.used - b.entry.used);
    const sizes = new Map([...this.owners].map(owner => [owner, this.snapshot(owner).estimatedBytes]));
    let total = [...sizes.values()].reduce((sum, bytes) => sum + bytes, 0);

    for (const { owner, entry } of optional) {
      const size = sizes.get(owner)!;

      if (size <= owner.limit) continue;
      remove(owner, entry.id);
      sizes.set(owner, size - entry.estimatedBytes);
      total -= entry.estimatedBytes;
    }

    for (const { owner, entry } of optional) {
      if (total <= this.maxBytes) break;
      if (!owner.entries.has(entry.id)) continue;
      remove(owner, entry.id);
      total -= entry.estimatedBytes;
    }

    for (const [owner, ids] of evicted) if (owner !== updating) owner.evict(ids);
  }
}
