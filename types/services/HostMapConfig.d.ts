import type { ResolvedMapConfig } from '../settings/MapConfiguration';
import type { IPlacesHostServices } from './IPlacesHostServices';
export declare function resolveHostMapConfig(host: IPlacesHostServices, blockSettings: Readonly<Record<string, unknown>>, placeCount: number): {
    config: ResolvedMapConfig;
    clusteringEnabled: boolean;
};
