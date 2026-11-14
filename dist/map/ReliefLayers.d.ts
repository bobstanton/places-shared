import { type ColorReliefStop, type TerrainDemSpec } from './TerrainDem';
export declare const TERRAIN_SOURCE_ID = "places-terrain-dem";
export declare const HILLSHADE_SOURCE_ID = "places-hillshade-dem";
export declare const HILLSHADE_LAYER_ID = "places-hillshade";
export declare const COLOR_RELIEF_SOURCE_ID = "places-colorrelief-dem";
export declare const COLOR_RELIEF_LAYER_ID = "places-color-relief";
export interface RasterDemSourceSpec {
    readonly type: 'raster-dem';
    readonly tiles: string[];
    readonly encoding: 'terrarium' | 'mapbox';
    readonly tileSize: number;
    readonly maxzoom?: number;
    readonly attribution?: string;
}
export declare function rasterDemSource(spec: TerrainDemSpec): RasterDemSourceSpec;
export interface HillshadeOptions {
    intensity: number;
    method?: string;
    direction?: number;
    shadowColor?: string;
    highlightColor?: string;
    accentColor?: string;
}
export declare function hillshadePaint(options: HillshadeOptions): Record<string, unknown>;
export declare function colorReliefRamp(stops: readonly ColorReliefStop[]): unknown[];
export declare function colorReliefPaint(opacity: number, stops?: readonly ColorReliefStop[]): Record<string, unknown>;
export declare function reliefInsertBeforeId(layers: readonly {
    id: string;
    type?: string;
}[]): string | undefined;
