export declare function toGlMaxZoom(maxZoom: number): number;
export interface ZoomRange {
    minZoom?: number;
    maxZoom?: number;
}
export declare function normalizeZoomValue(value: unknown): number | undefined;
export declare function normalizeZoomRange(range: ZoomRange | undefined): ZoomRange | undefined;
export declare function mergeZoomRanges(...ranges: Array<ZoomRange | undefined>): ZoomRange | undefined;
export declare function readZoomRangeFromRecord(record: Record<string, unknown> | undefined, prefix?: string): ZoomRange | undefined;
export declare function readZoomRangesFromRecord(record: Record<string, unknown> | undefined, prefixes: readonly string[]): Record<string, ZoomRange | undefined>;
export declare function getZoomRangeClassNames(range: ZoomRange | undefined): string[];
export declare function updateZoomContainerState(container: HTMLElement, zoom: number): void;
