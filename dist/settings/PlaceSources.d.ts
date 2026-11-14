export type PlaceSource = string | Record<string, unknown>;
export declare function parsePlaceSources(value: unknown): readonly PlaceSource[] | undefined;
export declare function placeSourcePaths(sources: readonly PlaceSource[] | undefined): string[];
