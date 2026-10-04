import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The Emscripten modules are never bundled and load their .wasm from beside
// themselves, so each .mjs lands in dist/wasm/ together with its .wasm and types.
const files = ['machine-arm', 'arm-as', 'arm-ld', 'machine-aarch64', 'aarch64-as', 'aarch64-ld'].flatMap((name) => [
  `${name}.mjs`,
  `${name}.wasm`,
  `${name}.d.mts`,
])

// The notices travel with the binaries they describe: GNU as and ld need the GPL-3.0 text.
files.push('tool-module.d.ts', 'NOTICE.md', 'GPL-3.0.txt')

await mkdir(resolve(root, 'dist/wasm'), { recursive: true })
for (const file of files) {
  await cp(resolve(root, 'src/wasm', file), resolve(root, 'dist/wasm', file), { force: true })
}
