import type { VectorTileSourceDefinition } from './OverlaySystem';
export interface TileJsonVectorLayer {
    id: string;
    fields: Record<string, string>;
    description?: string;
    minzoom?: number;
    maxzoom?: number;
}
export interface ResolvedTileJson {
    tiles: string[];
    minzoom?: number;
    maxzoom?: number;
    bounds?: [number, number, number, number];
    attribution?: string;
    vectorLayers?: TileJsonVectorLayer[];
}
export declare function resolveTileUrlTemplate(template: string, baseUrl: string): string;
export declare function parseTileJson(document: Record<string, unknown>, baseUrl: string): ResolvedTileJson;
export declare function createTileJsonResolver(fetchTileJsonText: (url: string) => Promise<string>): (url: string) => Promise<ResolvedTileJson>;
export declare function createVectorTileSourceSpec(overlay: VectorTileSourceDefinition, tileJson: ResolvedTileJson | undefined): Record<string, unknown>;
