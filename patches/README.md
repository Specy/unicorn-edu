# Patches to Unicorn 2.1.4

`scripts/build-unicorn.sh` applies these to `third_party/unicorn` (pinned at `8028ec4`, the
2.1.4 tag) the first time it runs, after copying `vendor/qemu-5.0.1-tci/tcg/` into
`third_party/unicorn/qemu/tcg/` without overwriting anything.

| File | From | License | What it does |
| --- | --- | --- | --- |
| `vendor/qemu-5.0.1-tci/` | [unicorn.js](https://github.com/AlexAltea/unicorn.js) `externals/qemu-5.0.1` at `1220477`, originally QEMU 5.0.1 | `tcg/tci.c` GPL-2.0-or-later, `tcg/tci/` MIT | QEMU's TCG interpreter (TCI). Unicorn dropped it from its QEMU fork; WebAssembly cannot run generated host code, so TCI is how the guest code runs. |
| `0001-unicorn-tci.patch` | unicorn.js `src/patches/unicorn-tci.patch` | GPL-2.0-only | Builds Unicorn with TCI as the TCG backend, for the wasm32 host. |
| `helper-adapter.h`, `0002-unicorn-helper-adapters.patch` | unicorn.js `src/qemu/helper-adapter.h`, `src/patches/unicorn-adapters.patch` | GPL-2.0-only | TCI calls every TCG helper through one function type, and WebAssembly traps on an indirect call whose signature does not match. Each helper gets an adapter with that one signature, and `tcg_gen_callN` passes every argument as a 64-bit pair. |
| `0003-free-helper-extension-temps.patch` | this repository | GPL-2.0-or-later | Frees the 64-bit temporaries 0002 creates to widen narrow helper arguments. Without it, every helper call leaked two TCG temporaries, and a translation block of about 100 instructions under a per-instruction hook (or about 200 VFP instructions without one) overran `TCG_MAX_TEMPS` and corrupted memory. Not reported upstream yet. |

Unicorn itself is GPL-2.0-only. `scripts/build-unicorn.sh --reset` puts the submodule back to the pinned commit.
