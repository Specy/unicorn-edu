# Notices for the WebAssembly modules

These modules are built from other projects' code. This file lists what each one contains, its license, and where to get its source.

## `machine-arm`, `machine-aarch64`

These are the emulators. `scripts/build-unicorn.sh <target>` builds each one from:

| Component | Version | License |
| --- | --- | --- |
| [Unicorn Engine](https://github.com/unicorn-engine/unicorn) | 2.1.4, commit `8028ec4` | GPL-2.0-only |
| QEMU's TCG interpreter, taken from [unicorn.js](https://github.com/AlexAltea/unicorn.js) | QEMU 5.0.1 | `tcg/tci.c` GPL-2.0-or-later, `tcg/tci/` MIT |
| unicorn.js's interpreter and helper-adapter patches | unicorn.js commit `1220477` | GPL-2.0-only |
| unicorn-edu's own patch and `native/` | | GPL-2.0-or-later |

Unicorn is licensed under GPL version 2 only, so each module as a whole is distributed under the GNU General Public License version 2. The license text is `LICENSE`, at the root of the repository and of the package. The corresponding source is the [unicorn-edu repository](https://github.com/Specy/unicorn-edu) at the commit the module was built from. It consists of the `third_party/unicorn` submodule and the `vendor/`, `patches/` and `native/` directories.

## `arm-as`, `arm-ld`, `aarch64-as`, `aarch64-ld`

These are GNU as and GNU ld from [GNU Binutils](https://www.gnu.org/software/binutils/) 2.45, unmodified. The `arm` pair targets `arm-none-eabi` and the `aarch64` pair targets `aarch64-none-elf`. They are licensed under the GNU General Public License version 3 or later; the text is `GPL-3.0.txt` in this directory.

The source is <https://ftp.gnu.org/gnu/binutils/binutils-2.45.tar.xz> (SHA-256 `c50c0e7f9cb188980e2cc97e4537626b1672441815587f1eab69d2a1bfbef5d2`). `scripts/build-binutils.sh <target>` builds them; the configure options and Emscripten flags are in that script.

## All modules

Every module also contains code from [Emscripten](https://emscripten.org) 6.0.9, licensed under MIT or the University of Illinois/NCSA license: the JavaScript glue and the C runtime. That runtime includes [musl](https://musl.libc.org) libc, licensed under MIT.
