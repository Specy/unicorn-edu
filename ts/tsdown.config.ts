import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  dts: true,
  format: ['esm'],
  clean: true,
  deps: {
    // Emscripten modules that locate their own .wasm beside themselves at runtime;
    // scripts/copy-assets.mjs puts both halves of each into dist/wasm/.
    neverBundle: [
      './wasm/machine-arm.mjs',
      './wasm/arm-as.mjs',
      './wasm/arm-ld.mjs',
      './wasm/machine-aarch64.mjs',
      './wasm/aarch64-as.mjs',
      './wasm/aarch64-ld.mjs',
    ],
  },
})
