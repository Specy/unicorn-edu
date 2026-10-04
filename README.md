# unicorn-edu

An experiment: an ARM emulator for an educational assembly IDE ([asm-editor](https://github.com/Specy/asm-editor)), built from [Unicorn](https://github.com/unicorn-engine/unicorn) and GNU binutils, all running as WebAssembly in the browser or in Node.

- **Unicorn 2.1.4** executes, under QEMU's TCG interpreter (WebAssembly cannot run generated host code), with the patches in [`patches/`](patches/README.md).
- **A debugger layer in C** ([`native/edu.c`](native/edu.c)) does everything that happens once per instruction, so that no instruction crosses into JavaScript:
  - instruction budgets and breakpoints;
  - an Undo history (registers, stores, floating point, call stack);
  - Poke transactions;
  - a shadow call stack;
  - handing `svc` system calls to the host.
- **GNU as and ld 2.45** build the program, so it accepts what GCC emits and what tutorials teach, with line-numbered diagnostics and a DWARF line table for the debugger.
- **A TypeScript package** ([`ts/`](ts)), `ArmEmulator`, shaped like [`@specy/x86`](https://github.com/Specy/x86-js) so an editor adapter can follow the x86 one.

The target is ARMv7-A, the Cortex-A15 Unicorn models by default: A32 and Thumb-2, VFPv4 and NEON, integer divide.

## Using it

```ts
import { createArmEmulator } from '@specy/unicorn-edu'

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
| Registers | `getRegisterValues()`, `getRegisterValue(name)`, `setRegisterValue(name, value)`, `getFlags()`, `getVfpRegisters()`, `setVfpRegister(name, value)` |
| Memory | `readMemoryBytes(address, length)`, `writeMemoryBytes(address, bytes)` |
| Source | `getNextInstruction()`, `getLastInstruction()`, `getInstructionAt(address)`, `getCompiledInstructions()`, `getAddressesForLine(line, path?)` |
| Calls | `getCallStack()` |

`run` stops a breakpoint *before* the instruction it names. The exception is the instruction the run starts on, while `skipBreakpointAtPc` is true (the default), which is how a run leaves the breakpoint it is parked on (asm-editor's ADR 0023).

### What a program sees

**Entry point.** The program starts at `_start`, or at `main` when there is no `_start`. `lr` starts on a trampoline that calls `exit(r0)`, so returning from either ends the program with that status. A program that runs past its last instruction stops there instead of executing whatever follows, such as a literal pool or the next section.

**System calls.** Linux EABI: `svc #0`, with the call number in `r7`, arguments in `r0`–`r2` and the result in `r0`.

| r7 | Call | Behaviour |
| --- | --- | --- |
| 1, 248 | `exit`, `exit_group` | Ends the program with status `r0`. |
| 3 | `read` | fd 0 only. Asks the `stdin` callback when nothing is buffered; `null` means end of input. |
| 4 | `write` | fd 1 and 2, decoded as UTF-8. |
| 45 | `brk` | A heap above the program, up to 16 MB. |
| 162 | `nanosleep` | Returns `{ kind: 'wait', waitMs }`; the host resumes the run after waiting. |
| 263 | `clock_gettime` | Reads the `now` callback. |

Any other call stops the program with an error.

**Memory.**

| Region | Address |
| --- | --- |
| Code and read-only data | `.text` at `0x00010000`, then `.rodata` |
| Data | `.data` and `.bss` on the next 4 KB page |
| Heap | grows up from the page after `.bss` |
| Stack | 1 MB below `0x80000000`; `sp` starts at `0x80000000` |
| Return trampoline | `0x00001000` |

The CPU starts in user mode with every other register zero.

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
scripts/build-unicorn.sh arm      # Unicorn + native/ -> ts/src/wasm/machine-arm.{mjs,wasm}, ~40 s
scripts/build-binutils.sh arm     # GNU as + ld 2.45 -> ts/src/wasm/arm-{as,ld}.{mjs,wasm}, ~5 min
```

`build-unicorn.sh` patches the submodule in place the first time; `build-unicorn.sh --reset` restores it. `scripts/gen-arm-registers.py` regenerates `ts/src/arm-register-ids.ts` from Unicorn's header.

| Module | Size | gzipped |
| --- | --- | --- |
| `machine-arm.wasm` | 710 KB | 238 KB |
| `arm-as.wasm` | 1.06 MB | 430 KB |
| `arm-ld.wasm` | 1.31 MB | 427 KB |

## Speed

Measured with `cd ts && npm run measure` (Node 24, WSL2). The program is a loop of `add`/`eor`/`str`/`cmp`/`bne`, run in slices as an IDE runs it; the figures are the best of five.

| Undo history | Slice | Million instructions/s |
| --- | --- | --- |
| off | 100,000 | 9.6 |
| 200 steps | 100,000 | 3.3 |

Without the layer's per-instruction hook, the same loop runs at about 35 million instructions/s, so per-block budgets would be the next speed-up. For comparison, asm-editor's own estimates for its existing Cores are 11,022 instructions/ms for MIPS and 5,432 for RISC-V.

## Known gaps

- **Undo:** it does not give back standard input a program has consumed, nor take back output already written.
- **Self-modifying code:** a block that rewrites itself keeps running its old instructions until it is left, which ARM allows without an `ISB`. Host writes (Pokes, system calls) drop the translated code they overlap.
- **Not implemented yet:**
  - files (`open`, `close`, `lseek`);
  - memory-mapped devices for a Screen and Keyboard;
  - disassembly, so `Instruction.code` is the source line;
  - AArch64.
- **Compiler output:** `.file`/`.loc` directives make gas describe GCC output in terms of its C source, so instructions from such a unit have no assembly line.
- **Licensing:** Unicorn is GPL-2.0, binutils GPL-3.0-or-later, and the unicorn.js patches GPL-2.0. This repository's own licence is not decided yet.
