export type IconImageDetail = 'standard' | 'sharp' | 'maximum';
export declare const ICON_IMAGE_DETAILS: readonly ["standard", "sharp", "maximum"];
export interface IconImageQuality {
    pixelRatio: number;
    decodePx: number;
}
export declare const DEFAULT_ICON_IMAGE_QUALITY: IconImageQuality;
export declare function resolveIconImageQuality(detail: string | undefined): IconImageQuality;
