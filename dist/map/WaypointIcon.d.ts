import type * as GeoJSON from 'geojson';
export declare const WAYPOINT_ICON_PROPERTY = "_placesWaypointIcon";
export interface WaypointIconSource {
    name?: unknown;
    symbol?: unknown;
    type?: unknown;
}
export interface CompiledWaypointIconMappings {
    readonly names: ReadonlyMap<string, string>;
    readonly symbols: ReadonlyMap<string, string>;
    readonly types: ReadonlyMap<string, string>;
}
export declare const CURRENT_WAYPOINT_ICON_MAPPINGS_REVISION = 1;
export declare function defaultWaypointIconMappings(): string[];
export declare function compileWaypointIconMappings(lines: readonly string[] | undefined): CompiledWaypointIconMappings;
export declare function configureWaypointIconMappings(lines: readonly string[] | undefined): void;
type WaypointGeoJson = NonNullable<GeoJSON.GeoJSON<GeoJSON.Geometry | null>>;
export declare function resolveWaypointIcon(source: WaypointIconSource, mappings?: CompiledWaypointIconMappings): string | undefined;
export declare function applyWaypointIconsToGeoJson<T extends WaypointGeoJson>(geojson: T, mappings?: CompiledWaypointIconMappings): T;
export declare function upgradeWaypointIconMappings(lines: readonly string[] | undefined, revision: unknown): string[];
export {};
