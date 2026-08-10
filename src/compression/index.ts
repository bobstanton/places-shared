import { init, compress, decompress } from "@bokuweb/zstd-wasm";
import { getOverlayCompressionState } from "../utils/StringCompressor";
import ZSTD_WASM_BYTES from "zstd-wasm-binary";

export async function initOverlayCompression(): Promise<void> {
  const state = getOverlayCompressionState();
  if (state.codec) return;
  state.initPromise ??= (async () => {
    await Reflect.apply(init, undefined, [ZSTD_WASM_BYTES]);
    state.codec = {
      compress: (data, level) => compress(data, level),
      decompress: (data) => decompress(data),
    };
  })();
  try {
    await state.initPromise;
  } catch (error) {
    state.initPromise = null;
    throw error;
  }
}
