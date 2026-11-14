import { sharedRegistryValue } from './CrossBundleRegistry';

export const DEFAULT_OVERLAY_COMPRESSION_LEVEL = 12;

// Zstandard frame magic number (little-endian 0xFD2FB528).
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

export interface OverlayCompressionCodec {
  compress(data: Uint8Array, level: number): Uint8Array;
  decompress(data: Uint8Array): Uint8Array;
}

export interface OverlayCompressionState {
  codec: OverlayCompressionCodec | null;
  initPromise: Promise<void> | null;
  level: number;
}

// The codec is stateful WASM initialized once by the main Places plugin, while
// this module exists as several bundle copies at runtime; the state lives on a
// shared global.
const STATE_KEY = "__placesOverlayCompression";

export function getOverlayCompressionState(): OverlayCompressionState {
  return sharedRegistryValue<OverlayCompressionState>(STATE_KEY, () => ({
    codec: null,
    initPromise: null,
    level: DEFAULT_OVERLAY_COMPRESSION_LEVEL,
  }));
}

function clampCompressionLevel(level: number): number {
  return Math.min(19, Math.max(1, Math.round(level)));
}

// Zstandard level (1-19) applied to subsequent compressAndEncode calls.
export function setOverlayCompressionLevel(level: number): void {
  getOverlayCompressionState().level = clampCompressionLevel(level);
}

// Chunked to avoid call-stack limits on large payloads.
export function bytesToBase64(bytes: Uint8Array): string {
  const withToBase64 = bytes as Uint8Array & { toBase64?: () => string };

  if (typeof withToBase64.toBase64 === "function") {
    return withToBase64.toBase64();
  }

  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE)));
  }

  return btoa(chunks.join(''));
}

// Throws on input that is not valid base64.
export function base64ToBytes(data: string): Uint8Array {
  const withFromBase64 = Uint8Array as typeof Uint8Array & { fromBase64?: (data: string) => Uint8Array };

  if (typeof withFromBase64.fromBase64 === "function") {
    return withFromBase64.fromBase64(data);
  }

  // A preallocated loop over atob decodes large blobs several times faster
  // than Uint8Array.from's per-character callback.
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function requireCodec(): OverlayCompressionCodec {
  const codec = getOverlayCompressionState().codec;

  if (!codec) {
    throw new Error("Overlay compression is not initialized. The Places plugin initializes it during load via initOverlayCompression().");
  }

  return codec;
}

function hasMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  return bytes.length >= magic.length && magic.every((byte, index) => bytes[index] === byte);
}

export class StringCompressor {
  static compressAndEncode(data: string, level?: number): string {
    if (data === undefined || data === null) {
      throw new Error("StringCompressor.compressAndEncode: data cannot be undefined or null");
    }

    const state = getOverlayCompressionState();
    const input = textEncoder.encode(data);
    const compressed = requireCodec().compress(input, level !== undefined ? clampCompressionLevel(level) : state.level);
    const compressedBase64 = bytesToBase64(compressed);

    if (compressedBase64.length < input.length) {
      return compressedBase64;
    }

    return data;
  }

  static decodeAndDecompress(data: string): string {
    let binary: Uint8Array;

    try {
      binary = base64ToBytes(data);
    } catch {
      return data;
    }

    if (hasMagic(binary, ZSTD_MAGIC)) {
      return textDecoder.decode(requireCodec().decompress(binary));
    }

    return data;
  }
}
