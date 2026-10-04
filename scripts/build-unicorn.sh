#!/usr/bin/env bash
# Builds the machine module: Unicorn 2.1.4 with QEMU 5.0.1's TCG interpreter, the
# patches in patches/, and the debugger layer in native/, as an ES module and its
# .wasm under ts/src/wasm/.
#
#   scripts/build-unicorn.sh [arch]      arch: arm (default) or aarch64
#
# Needs emcc/emcmake on PATH (source ~/emsdk/emsdk_env.sh), cmake 3.x/4.x and
# python3. The Unicorn submodule is patched in place the first time and left
# patched; `scripts/build-unicorn.sh --reset` restores it to the pinned commit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNICORN="$ROOT/third_party/unicorn"
OUT="$ROOT/ts/src/wasm"
MARKER="$UNICORN/.unicorn-edu-patched"

if [[ "${1:-}" == "--reset" ]]; then
    git -C "$UNICORN" checkout -q -- .
    git -C "$UNICORN" clean -fdq
    rm -f "$MARKER"
    echo "third_party/unicorn restored"
    exit 0
fi

ARCH="${1:-arm}"
case "$ARCH" in
    arm|aarch64) ;;
    *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

for tool in emcc emcmake cmake python3 git; do
    command -v "$tool" >/dev/null || { echo "missing $tool (for emcc: source ~/emsdk/emsdk_env.sh)" >&2; exit 1; }
done

if [[ ! -f "$UNICORN/uc.c" ]]; then
    git -C "$ROOT" submodule update --init third_party/unicorn
fi

prepare() {
    [[ -f "$MARKER" ]] && return
    echo "== patching third_party/unicorn"
    # TCI was removed from Unicorn's QEMU fork; bring QEMU 5.0.1's back without
    # overwriting anything Unicorn still has.
    (cd "$ROOT/vendor/qemu-5.0.1-tci/tcg" && find . -type f) | while read -r file; do
        [[ -e "$UNICORN/qemu/tcg/$file" ]] && continue
        mkdir -p "$(dirname "$UNICORN/qemu/tcg/$file")"
        cp "$ROOT/vendor/qemu-5.0.1-tci/tcg/$file" "$UNICORN/qemu/tcg/$file"
    done
    git -C "$UNICORN" apply "$ROOT/patches/0001-unicorn-tci.patch"
    cp "$ROOT/patches/helper-adapter.h" "$UNICORN/qemu/include/exec/helper-adapter.h"
    git -C "$UNICORN" apply "$ROOT/patches/0002-unicorn-helper-adapters.patch"
    git -C "$UNICORN" apply "$ROOT/patches/0003-free-helper-extension-temps.patch"
    # The adapters add symbols that every per-architecture build renames.
    (cd "$UNICORN" && bash symbols.sh)
    touch "$MARKER"
}

prepare

BUILD="$ROOT/build/unicorn-$ARCH"
echo "== building libunicorn ($ARCH) in $BUILD"
emcmake cmake -B "$BUILD" -S "$UNICORN" \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=OFF \
    -DUNICORN_ARCH="$ARCH" \
    -DUNICORN_BUILD_TESTS=OFF \
    -DUNICORN_INSTALL=OFF \
    -DUNICORN_FUZZ=OFF \
    -DUNICORN_LEGACY_STATIC_ARCHIVE=ON >/dev/null
cmake --build "$BUILD" --target unicorn_archive -j"$(nproc)"

EXPORTS="$(python3 - "$ROOT/native/edu.h" <<'PY'
import re, sys, json
names = re.findall(r'^EDU_API\s+[^;(]*?\b(edu_\w+)\s*\(', open(sys.argv[1]).read(), re.M)
print(json.dumps(['_' + n for n in names] + ['_malloc', '_free']))
PY
)"

mkdir -p "$OUT"
echo "== linking ts/src/wasm/machine-$ARCH.mjs"
emcc -O3 \
    -I"$UNICORN/include" \
    "$ROOT/native/edu.c" "$BUILD/libunicorn.a" \
    -o "$OUT/machine-$ARCH.mjs" \
    -sMODULARIZE=1 \
    -sEXPORT_ES6=1 \
    -sEXPORT_NAME=createMachineModule \
    -sENVIRONMENT=web,worker,node \
    -sALLOW_MEMORY_GROWTH=1 \
    -sEXPORTED_FUNCTIONS="$EXPORTS" \
    -sEXPORTED_RUNTIME_METHODS='["HEAPU8","HEAP32","HEAPU32","HEAPF64","UTF8ToString"]'

ls -l "$OUT/machine-$ARCH.mjs" "$OUT/machine-$ARCH.wasm"
