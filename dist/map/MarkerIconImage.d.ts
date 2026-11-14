import type { IconImageQuality } from './IconImageQuality';
import type { ComputedIconStyle } from '../Place';
export { MARKER_ICON_SIZE_PX } from './MarkerIconGeometry';
export declare const PLAIN_MARKER_IMAGE_PREFIX = "places-emoji-";
export interface MarkerImageTarget {
    hasImage(id: string): boolean;
    addImage(id: string, image: ImageData, options?: {
        pixelRatio?: number;
    }): void;
}
export interface MarkerIconImageHost {
    createCanvas(): HTMLCanvasElement | null;
    pixelRatio: number;
}
export interface MarkerIconImageResult {
    imageId: string;
    outcome: 'existing' | 'cache' | 'rasterized' | 'failed';
}
export declare function markerIconImageId(icon: string, style: ComputedIconStyle | undefined): string;
export declare function ensureMarkerIconImage(map: MarkerImageTarget, icon: string, style: ComputedIconStyle | undefined, host: MarkerIconImageHost, imageId?: string): MarkerIconImageResult;
export declare function ensureMarkerPictureImage(map: MarkerImageTarget, url: string, style: ComputedIconStyle | undefined, host: MarkerIconImageHost, quality: IconImageQuality, imageId?: string): MarkerIconImageResult;
