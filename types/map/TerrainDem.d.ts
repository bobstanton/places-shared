export interface TerrainDemSpec {
    readonly tiles: readonly string[];
    readonly encoding: 'terrarium' | 'mapbox';
    readonly tileSize?: number;
    readonly maxzoom?: number;
    readonly attribution?: string;
}
export declare const DEFAULT_TERRAIN_EXAGGERATION = 1.4;
export declare const DEFAULT_HILLSHADE_INTENSITY = 0.5;
export declare const DEFAULT_COLOR_RELIEF_OPACITY = 0.4;
export declare const HILLSHADE_METHODS: readonly ["standard", "basic", "combined", "igor", "multidirectional"];
export type HillshadeMethod = typeof HILLSHADE_METHODS[number];
export interface ColorReliefStop {
    readonly elevation: number;
    readonly color: string;
}
export declare const DEFAULT_COLOR_RELIEF_STOPS: readonly ColorReliefStop[];
export declare const COLOR_RELIEF_PRESETS: Record<string, readonly ColorReliefStop[]>;
export declare const COLOR_RELIEF_PRESET_NAMES: string[];
export declare function parseColorReliefStops(value: unknown): readonly ColorReliefStop[] | undefined;
export declare const DEFAULT_AWS_TERRAIN_DEM: TerrainDemSpec;
export declare function terrainDemFromUrl(url: string): TerrainDemSpec;
export interface TerrainExaggerationStop {
    readonly zoom: number;
    readonly factor: number;
}
export type TerrainExaggeration = number | readonly TerrainExaggerationStop[];
export declare function parseTerrainExaggeration(value: unknown): TerrainExaggeration | undefined;
export declare function exaggerationAtZoom(stops: readonly TerrainExaggerationStop[], zoom: number): number;
export interface TerrainDemResolution {
    readonly dem?: TerrainDemSpec;
    readonly error?: string;
}
export declare function resolveTerrainDemSpec(terrainProvider: string | undefined, lookupProvider: (name: string) => TerrainDemSpec | null | undefined, availableProviders: () => readonly string[]): TerrainDemResolution;
