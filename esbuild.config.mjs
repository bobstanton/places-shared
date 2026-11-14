import esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { commonBuildOptions, preservedModuleBuildOptions, runBuildContexts, sourceFiles } from "./esbuild.library.mjs";

const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const wasm = join(dirname(require.resolve("@bokuweb/zstd-wasm")), "..", "web", "zstd.wasm");
const wasmPlugin = {
  name: "zstd-wasm-binary",
  setup(build) {
    build.onResolve({ filter: /^zstd-wasm-binary$/ }, () => ({ path: wasm }));
    build.onLoad({ filter: /zstd\.wasm$/ }, async () => ({ contents: await readFile(wasm), loader: "binary" }));
  },
};
const sources = (await sourceFiles("src")).filter(file => file !== join("src", "worker-safe.ts") && !file.startsWith(join("src", "compression") + "/"));
const contexts = [await esbuild.context(preservedModuleBuildOptions({ entryPoints: sources }))];
const entries = Object.values(manifest.exports).filter(entry => entry?.types);

for (const entry of entries) {
  const source = entry.types.replace("./dist/", "src/").replace(/\.d\.ts$/, ".ts");
  const compression = source === "src/compression/index.ts";
  const input = compression ? "src/compression/index.ts" : source;

  if (compression || source === "src/worker-safe.ts") {
    contexts.push(await esbuild.context(commonBuildOptions({
      entryPoints: [input], bundle: true, format: "esm", outfile: entry.import,
      ...(compression ? { plugins: [wasmPlugin], define: { "import.meta.url": '\"file:///places-shared\"' } } : { packages: "external" }),
    })));
  }

  contexts.push(await esbuild.context(commonBuildOptions({
    entryPoints: [input], bundle: true, packages: "external", format: "cjs", outfile: entry.require,
    ...(compression ? { plugins: [wasmPlugin], define: { "import.meta.url": '\"file:///places-shared\"' } } : {}),
  })));
}

await runBuildContexts(contexts);
