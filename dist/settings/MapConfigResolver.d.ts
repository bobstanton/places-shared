import type { MapConfigPatch, MapConfigSource, ResolvedMapConfig, ResolvedMapConfiguration } from './MapConfiguration';
export interface ConfigWarning {
    readonly path: string;
    readonly message: string;
}
export declare const CODED_MAP_DEFAULTS: ResolvedMapConfig;
export interface MapConfigLayer {
    readonly source: Exclude<MapConfigSource, 'coded'>;
    readonly values: MapConfigPatch;
}
export declare function parseMapConfigPatch(raw: Readonly<Record<string, unknown>>): MapConfigPatch;
export declare function resolveMapConfiguration(layers: readonly MapConfigLayer[]): ResolvedMapConfiguration;
export declare function mapConfigKeys(): ReadonlySet<string>;
export declare function mapConfigPaths(): readonly string[];
