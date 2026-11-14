import type { IconImageQuality } from './IconImageQuality';
import type { ComputedIconStyle, IconShapeStyle } from '../Place';
export interface MarkerPicture {
    readonly width: number;
    readonly height: number;
    close?: () => void;
}
export type MarkerPictureLoader = (url: string, decodePx: number) => Promise<MarkerPicture>;
export declare const MARKER_PICTURE_CACHE_LIMIT = 128;
export declare function getMarkerPicture(url: string, decodePx: number): MarkerPicture | undefined;
export declare function markerPictureFailed(url: string): boolean;
export declare function markerPictureFailureCounts(): {
    undecodable: number;
    unread: number;
};
export declare function markerPictureFailedCount(): number;
export declare function releaseMarkerPicture(url: string): void;
export declare function loadMarkerPictures(urls: readonly string[], load: MarkerPictureLoader, decodePx: number): Promise<boolean>;
export declare const domPictureLoader: MarkerPictureLoader;
export declare function takeMarkerPictureLoadTiming(): {
    readMs: number;
    decodeMs: number;
    megabytes: number;
    fromOriginal: number;
    fromStore: number;
};
export declare function markerPictureImageId(url: string, style: ComputedIconStyle | undefined, quality: IconImageQuality): string;
interface PictureContext {
    save(): void;
    restore(): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
    closePath(): void;
    clip(): void;
    drawImage(image: MarkerPicture, x: number, y: number, width: number, height: number): void;
}
export declare function drawMarkerPicture(context: PictureContext, picture: MarkerPicture, box: {
    centerX: number;
    centerY: number;
    size: number;
}, shape: IconShapeStyle | undefined, pixelRatio: number): void;
export declare function markerPictureCssUrl(url: string): string;
export declare function defaultPictureShape(): IconShapeStyle;
export declare function getMarkerPictureSize(style: ComputedIconStyle | undefined): number;
export {};
