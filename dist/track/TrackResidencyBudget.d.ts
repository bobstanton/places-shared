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
    entries: Map<string, ResidentTrackCost & {
        used: number;
    }>;
    evict(ids: readonly string[]): void;
}
export interface TrackResidencyLease {
    update(entries: readonly ResidentTrackCost[]): ReadonlySet<string>;
    snapshot(): TrackResidencySnapshot;
    dispose(): void;
}
export declare class TrackResidencyBudget {
    private readonly maxBytes;
    private readonly perMapBytes;
    private readonly owners;
    private clock;
    constructor(maxBytes: number, perMapBytes: number);
    open(evict: (ids: readonly string[]) => void): TrackResidencyLease;
    snapshot(owner?: Owner): TrackResidencySnapshot;
    private trim;
}
export {};
