export declare const DEFAULT_OVERLAY_COMPRESSION_LEVEL = 12;
export interface OverlayCompressionCodec {
    compress(data: Uint8Array, level: number): Uint8Array;
    decompress(data: Uint8Array): Uint8Array;
}
export interface OverlayCompressionState {
    codec: OverlayCompressionCodec | null;
    initPromise: Promise<void> | null;
    level: number;
}
export declare function getOverlayCompressionState(): OverlayCompressionState;
export declare function setOverlayCompressionLevel(level: number): void;
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function base64ToBytes(data: string): Uint8Array;
export declare class StringCompressor {
    static compressAndEncode(data: string, level?: number): string;
    static decodeAndDecompress(data: string): string;
}
