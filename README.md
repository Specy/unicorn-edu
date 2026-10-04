# unicorn-edu

An experiment: ARM and AArch64 emulators for an educational assembly IDE ([asm-editor](https://github.com/Specy/asm-editor)), built from [Unicorn](https://github.com/unicorn-engine/unicorn) and GNU binutils, all running as WebAssembly in the browser or in Node.

- **Unicorn 2.1.4** executes, under QEMU's TCG interpreter (WebAssembly cannot run generated host code), with the patches in [`patches/`](patches/README.md).
- **A debugger layer in C** ([`native/edu.c`](native/edu.c)) does everything that happens once per instruction, so that no instruction crosses into JavaScript:
  - instruction budgets and breakpoints;
  - an Undo history (registers, stores, floating point, call stack);
  - Poke transactions;
  - a shadow call stack;
  - handing `svc` system calls to the host.
- **GNU as and ld 2.45** build the program, so it accepts what GCC emits and what tutorials teach, with line-numbered diagnostics and a DWARF line table for the debugger.
- **A TypeScript package** ([`ts/`](ts)), shaped like [`@specy/x86`](https://github.com/Specy/x86-js) so an editor adapter can follow the x86 one.

There are two targets, each with its own WebAssembly builds and the same API:

| Target | Factory | Instruction sets | CPU Unicorn models |
| --- | --- | --- | --- |
| 32-bit ARM | `createArmEmulator` | ARMv7-A: A32 and Thumb-2, VFPv4, NEON, integer divide | Cortex-A15 |
| AArch64 | `createAarch64Emulator` | ARMv8-A: A64 with FP and Advanced SIMD | Cortex-A72 |

Everything that differs between them lives in an `Architecture` profile ([`arm.ts`](ts/src/arm.ts), [`aarch64.ts`](ts/src/aarch64.ts)). That covers registers, system-call numbers, the exit trampoline, mapping symbols and which instructions touch floating point, so `createEmulator(profile)` runs either.

## Using it

```ts
import { createArmEmulator } from '@specy/unicorn-edu' // or createAarch64Emulator

const emulator = await createArmEmulator({
    stdout: (text) => console.log(text),
    stdin: async () => prompt('input') ?? null,
})

const result = await emulator.compileProject({
    entry: 'main.s',
    files: { 'main.s': source },
})
if (!result.ok) console.log(result.errors) // { file, lineIndex, column, endColumn, message, ... }

emulator.initialize(200) // keep 200 steps of Undo
const run = await emulator.run(10_000, [{ path: 'main.s', line: 12 }])
// run.kind: 'limit' | 'breakpoint' | 'exit' | 'wait' | 'pause' | 'halt' | 'error'
```

The rest of the surface:

| Area | Methods |
| --- | --- |
| Building | `compile(source)`, `compileProject(project)`, `check(project)` |
| Running | `initialize(undoSize)`, `run(limit?, breakpoints?, { skipBreakpointAtPc })`, `step()` |
| Status | `hasTerminated()`, `getTermination()`, `getStatus()` |
| Undo | `undo()`, `canUndo()`, `getUndoHistory(max)` (`ExecutionStep`s with old and new values) |
| Pokes | `beginPoke()`, `endPoke()`; register and memory writes in between are one undoable step |
| Registers | `getRegisterValues()`, `getRegisterValue(name)`, `setRegisterValue(name, value)`, `getFlags()`, `getFlagsRegister()` (CPSR or NZCV) |
| Floating point | `getFloatingPointRegisterValues()`, `setFloatingPointRegister(name, value)`: `d0`-`d31` and `fpscr` on ARM, the 128-bit `v0`-`v31` with `fpcr` and `fpsr` on AArch64 |
| Memory | `readMemoryBytes(address, length)`, `writeMemoryBytes(address, bytes)` |
| Source | `getNextInstruction()`, `getLastInstruction()`, `getInstructionAt(address)`, `getCompiledInstructions()`, `getAddressesForLine(line, path?)` |
| Calls | `getCallStack()` |

`run` stops a breakpoint *before* the instruction it names. The exception is the instruction the run starts on, while `skipBreakpointAtPc` is true (the default), which is how a run leaves the breakpoint it is parked on (asm-editor's ADR 0023).

### What a program sees

**Entry point.** The program starts at `_start`, or at `main` when there is no `_start`. The link register (`lr`, `x30`) starts on a trampoline that calls `exit` with the result register, so returning from either ends the program with that status. A program that runs past its last instruction stops there instead of executing whatever follows, such as a literal pool or the next section.

**System calls.** Linux: `svc #0`, with the call number in `r7` (ARM) or `x8` (AArch64). Arguments are in `r0`–`r2` or `x0`–`x2`, and the result comes back in `r0` or `x0`.

| ARM `r7` | AArch64 `x8` | Call | Behaviour |
| --- | --- | --- | --- |
| 1, 248 | 93, 94 | `exit`, `exit_group` | Ends the program with that status. |
| 3 | 63 | `read` | fd 0 only. Asks the `stdin` callback when nothing is buffered; `null` means end of input. |
| 4 | 64 | `write` | fd 1 and 2, decoded as UTF-8. |
| 45 | 214 | `brk` | A heap above the program, up to 16 MB. |
| 162 | 101 | `nanosleep` | Returns `{ kind: 'wait', waitMs }`; the host resumes the run after waiting. |
| 263 | 113 | `clock_gettime` | Reads the `now` callback; `struct timespec` has 32-bit fields on ARM, 64-bit on AArch64. |

Any other call stops the program with an error. `bkpt` (ARM) and `brk` (AArch64) pause the run, which resumes after them.

**Memory.**

| Region | Address |
| --- | --- |
| Code and read-only data | `.text` at `0x00010000`, then `.rodata` |
| Data | `.data` and `.bss` on the next 4 KB page |
| Heap | grows up from the page after `.bss` |
| Stack | 1 MB below `0x80000000`; `sp` starts at `0x80000000` |
| Return trampoline | `0x00001000` |

Every other register starts at zero; 32-bit ARM starts in user mode.

## Repository

| Path | What |
| --- | --- |
| `third_party/unicorn` | Unicorn, pinned at 2.1.4 (`8028ec4`) |
| `vendor/qemu-5.0.1-tci`, `patches/` | QEMU 5.0.1's TCG interpreter and the patches that make Unicorn run in WebAssembly ([details](patches/README.md)) |
| `native/` | The debugger layer |
| `scripts/` | Builds of the machine module and of binutils |
| `ts/src` | The TypeScript package; `ts/src/wasm` holds the committed WebAssembly builds |
| `ts/tests` | vitest suites, run against those builds |

## Building

The WebAssembly modules are committed, so working on the TypeScript only needs Node:

```
cd ts && npm ci && npm test && npm run build
```

Rebuilding the modules needs [Emscripten](https://emscripten.org) on `PATH` (`source ~/emsdk/emsdk_env.sh`), CMake and Python 3:

```
scripts/build-unicorn.sh arm          # Unicorn + native/ -> ts/src/wasm/machine-arm.{mjs,wasm}, ~40 s
scripts/build-unicorn.sh aarch64      # -> ts/src/wasm/machine-aarch64.{mjs,wasm}
scripts/build-binutils.sh arm         # GNU as + ld 2.45 (arm-none-eabi) -> ts/src/wasm/arm-{as,ld}.{mjs,wasm}, ~5 min
scripts/build-binutils.sh aarch64     # (aarch64-none-elf) -> ts/src/wasm/aarch64-{as,ld}.{mjs,wasm}
```

`build-unicorn.sh` patches the submodule in place the first time; `build-unicorn.sh --reset` restores it. `scripts/gen-register-ids.py` regenerates `ts/src/arm-register-ids.ts` and `ts/src/arm64-register-ids.ts` from Unicorn's headers.

| Module | Size | gzipped |
| --- | --- | --- |
| `machine-arm.wasm` | 710 KB | 238 KB |
| `arm-as.wasm` | 1.06 MB | 430 KB |
| `arm-ld.wasm` | 1.31 MB | 427 KB |
| `machine-aarch64.wasm` | 1.29 MB | 354 KB |
| `aarch64-as.wasm` | 1.43 MB | 570 KB |
| `aarch64-ld.wasm` | 1.52 MB | 524 KB |

Each target's modules load only when it is first used.

## Speed

Measured with `cd ts && npm run measure` (Node 24, WSL2). The program is a loop of `add`/`eor`/`str`/`cmp`/branch, run in 100,000-instruction slices as an IDE runs it; the figures are the best of five.

| Target | Undo off | 200 steps of Undo |
| --- | --- | --- |
| 32-bit ARM | 11.7 million instructions/s | 3.5 million instructions/s |
| AArch64 | 9.4 million instructions/s | 2.1 million instructions/s |

With Undo on, every instruction saves the core registers: 17 32-bit registers on ARM, 34 64-bit ones on AArch64, which is why AArch64 pays more for it. Without the layer's per-instruction hook, the ARM loop runs at about 35 million instructions/s, so per-block budgets would be the next speed-up. For comparison, asm-editor's own estimates for its existing Cores are 11,022 instructions/ms for MIPS and 5,432 for RISC-V.

## Known gaps

- **Undo:** it does not give back standard input a program has consumed, nor take back output already written.
- **Self-modifying code:** a block that rewrites itself keeps running its old instructions until it is left, which ARM allows without an `ISB`. Host writes (Pokes, system calls) drop the translated code they overlap.
- **Not implemented yet:**
  - files (`open`, `close`, `lseek`);
  - memory-mapped devices for a Screen and Keyboard;
  - disassembly, so `Instruction.code` is the source line.
- **Compiler output:** `.file`/`.loc` directives make gas describe GCC output in terms of its C source, so instructions from such a unit have no assembly line.
- **Licensing:** Unicorn is GPL-2.0, binutils GPL-3.0-or-later, and the unicorn.js patches GPL-2.0. This repository's own licence is not decided yet.
