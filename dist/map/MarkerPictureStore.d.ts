export declare function takeStoredPictureCounts(): {
    stored: number;
    dropped: number;
};
export declare function storeKey(url: string, decodePx: number): string;
export declare function readStoredPicture(url: string, decodePx: number): Promise<Blob | undefined>;
export declare function storePicture(url: string, picture: ImageBitmap | HTMLImageElement, decodePx: number): Promise<void>;
export declare function getStoredPictureStats(): Promise<{
    count: number;
    sizeBytes: number;
}>;
export declare function clearStoredPictures(): Promise<number>;
