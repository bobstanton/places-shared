export interface GeocodingSearchResult {
    name: string;
    lat: number;
    lon: number;
    address?: string;
    website?: string;
    tags: string[];
    source: string;
}
export declare const asRecord: (value: unknown) => Record<string, unknown>;
export declare const nonBlankText: (value: unknown) => string | undefined;
