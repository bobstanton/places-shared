export declare const TRACK_DIRECTION_ARROW_IMAGE_ID = "places-track-direction-arrow";
export declare function ensureTrackDirectionArrowImage(map: {
    hasImage(id: string): boolean;
    addImage(id: string, image: {
        width: number;
        height: number;
        data: Uint8Array | Uint8ClampedArray;
    }, options?: {
        sdf?: boolean;
        pixelRatio?: number;
    }): void;
}): string;
