import type { ResolvedMapConfig } from '../settings/index';
import type { MapHostServices } from './MapHostServices';
export declare function resolveHostMapConfig(host: MapHostServices, blockSettings: Readonly<Record<string, unknown>>, placeCount: number): {
    config: ResolvedMapConfig;
    clusteringEnabled: boolean;
};
