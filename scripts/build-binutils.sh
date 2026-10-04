#!/usr/bin/env bash
# Builds GNU as and ld 2.45 as WebAssembly programs under ts/src/wasm/:
#
#   scripts/build-binutils.sh [target]      target: arm (default) -> arm-none-eabi,
#                                            aarch64 -> aarch64-none-elf
#
# Each tool is an ES module (MODULARIZE + EXPORT_ES6) with its .wasm beside it, run with
# `callMain` over Emscripten's in-memory filesystem. Needs emcc/emconfigure/emmake on
# PATH (source ~/emsdk/emsdk_env.sh), curl and the usual autotools build environment.
# Configuring through emcc is slow: expect about ten minutes.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/ts/src/wasm"
VERSION=2.45
# Verified against the GNU release signature (Nick Clifton, 13FCEF89DD9E3C4F).
SHA256=c50c0e7f9cb188980e2cc97e4537626b1672441815587f1eab69d2a1bfbef5d2
TARBALL="$ROOT/build/downloads/binutils-$VERSION.tar.xz"
SOURCE="$ROOT/build/binutils-$VERSION"

TARGET_NAME="${1:-arm}"
case "$TARGET_NAME" in
    arm) TRIPLE=arm-none-eabi ;;
    aarch64) TRIPLE=aarch64-none-elf ;;
    *) echo "unsupported target: $TARGET_NAME" >&2; exit 1 ;;
esac

for tool in emcc emconfigure emmake curl; do
    command -v "$tool" >/dev/null || { echo "missing $tool (for emcc: source ~/emsdk/emsdk_env.sh)" >&2; exit 1; }
done

if [[ ! -f "$TARBALL" ]]; then
    mkdir -p "$(dirname "$TARBALL")"
    curl -fL -o "$TARBALL.part" "https://ftpmirror.gnu.org/gnu/binutils/binutils-$VERSION.tar.xz"
    mv "$TARBALL.part" "$TARBALL"
fi
echo "$SHA256  $TARBALL" | sha256sum -c -

if [[ ! -d "$SOURCE" ]]; then
    tar -xJf "$TARBALL" -C "$ROOT/build"
fi

BUILD="$ROOT/build/binutils-$TARGET_NAME"
mkdir -p "$BUILD"
cd "$BUILD"

if [[ ! -f Makefile ]]; then
    emconfigure "$SOURCE/configure" \
        --target="$TRIPLE" \
        --host=wasm32 \
        --disable-doc \
        --disable-gprof \
        --disable-nls \
        --disable-binutils \
        --disable-gdb \
        --disable-gdbserver \
        --disable-libdecnumber \
        --disable-readline \
        --disable-sim \
        --disable-werror \
        --disable-plugins \
        --disable-lto \
        --disable-gold \
        --enable-ld=default \
        --enable-deterministic-archives \
        --without-zstd \
        >configure.log
fi

# INVOKE_RUN=0 + EXIT_RUNTIME=0: the host calls main through callMain and reads the
# outputs back out of the filesystem afterwards. Both tools keep global state, so an
# instance is good for one run; the wrapper instantiates a fresh one each time.
emmake make -j"$(nproc)" \
    "CFLAGS=-DHAVE_PSIGNAL=1 -DELIDE_CODE -Os" \
    "LDFLAGS=-sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1" \
    all-gas all-ld >make.log

mkdir -p "$OUT"
install_tool() {
    local built="$1" name="$2"
    # Emscripten names the .wasm after the build output and refers to it by that name.
    sed "s/$(basename "$built").wasm/$name.wasm/g" "$built" >"$OUT/$name.mjs"
    cp "$built.wasm" "$OUT/$name.wasm"
}
install_tool gas/as-new "$TARGET_NAME-as"
install_tool ld/ld-new "$TARGET_NAME-ld"
ls -l "$OUT/$TARGET_NAME"-{as,ld}.{mjs,wasm}
