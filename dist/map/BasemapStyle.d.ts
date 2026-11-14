export interface BasemapStyle {
    value: string;
    name: string;
}
export type MapStyleKind = 'raster' | 'vector';
export declare const styleKindMap: (styles: ReadonlyArray<BasemapStyle>, kind: MapStyleKind) => Record<string, MapStyleKind>;
export declare const styleIds: (styles: ReadonlyArray<BasemapStyle>) => string[];
