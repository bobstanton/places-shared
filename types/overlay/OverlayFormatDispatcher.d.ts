export type OverlayContentFormat = 'gpx' | 'geojson' | 'csv' | 'polyline';
export type OverlayPathFormat = OverlayContentFormat | 'md' | 'image' | 'unknown';
export interface OverlayFormatDispatchInput {
    path?: string;
    content?: string;
    allowTrack?: boolean;
}
export declare function overlayFormatFromPath(path: string): OverlayPathFormat;
export declare function overlayFormatFromContent(content: string, allowTrack?: boolean): OverlayContentFormat | 'unknown';
export declare function dispatchOverlayFormat(input: OverlayFormatDispatchInput): OverlayContentFormat | OverlayPathFormat;
