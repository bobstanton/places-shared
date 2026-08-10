export interface POIFilterFields {
    class?: string;
    subclass?: string;
    name?: string;
    tags?: string[];
}
export declare function shouldFilterPOI(patterns: string[], fields: POIFilterFields): boolean;
