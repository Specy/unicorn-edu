# @specy/unicorn-edu

32-bit ARM and AArch64 emulators for JavaScript, built from [Unicorn](https://github.com/unicorn-engine/unicorn) and GNU binutils and compiled to WebAssembly. They run in browsers and Node.

A program is assembled and linked by GNU as and ld 2.45, run on Unicorn 2.1.4, and debugged through a C layer with breakpoints, instruction budgets, an undo history and a call stack.

| Target | Factory | Instruction sets | CPU model |
| --- | --- | --- | --- |
| 32-bit ARM | `createArmEmulator` | ARMv7-A: A32 and Thumb-2, VFPv4, NEON, integer divide | Cortex-A15 |
| AArch64 | `createAarch64Emulator` | ARMv8-A: A64 with FP and Advanced SIMD | Cortex-A72 |

Both factories call `createEmulator(architecture, options)` with an `Architecture` profile, `ARM` or `AARCH64`, and return a `UnicornEmulator`.

## Installation

The package is an ES module with no dependencies. It is not published to npm. Build `ts/dist` as described in [Building from source](#building-from-source), then install the `ts` directory into your project with `npm install /path/to/unicorn-edu/ts`.

## Usage

```ts
import { createArmEmulator } from '@specy/unicorn-edu'

const emulator = await createArmEmulator({
    stdout: (text) => process.stdout.write(text),
})

const result = await emulator.compile(`
    .data
message: .asciz "Hello, ARM!\\n"
    .text
    .global _start
_start:
    mov r0, #1              @ file descriptor 1
    ldr r1, =message
    mov r2, #12             @ length
    mov r7, #4              @ write
    svc #0
    mov r0, #3              @ exit status
    mov r7, #1              @ exit
    svc #0
`)
if (!result.ok) throw new Error(result.report)

emulator.initialize(200) // keep the last 200 steps for undo
console.log(await emulator.run(10_000))
// Hello, ARM!
// { kind: 'exit', exitCode: 3, executed: 8 }
```

The WebAssembly modules load on first use: a target's machine when its emulator is created, its GNU as and ld at the first build. In a browser they are fetched from the `wasm/` directory next to `index.mjs`.

Every field of `EmulatorOptions` is optional:

| Option | Meaning |
| --- | --- |
| `stdout(text)` | Text the program writes to file descriptor 1, decoded as UTF-8 as it arrives |
| `stderr(text)` | The same for file descriptor 2 |
| `stdin()` | Called when the program reads file descriptor 0 and nothing is buffered; see [Input and sleeping](#input-and-sleeping) |
| `now()` | The clock `clock_gettime` reads, in milliseconds. Defaults to `Date.now` |
| `layout` | A `Partial<MemoryLayout>`: overrides for the [memory map](#memory-map) |

### Compile

`compile(source, path = 'main.s')` assembles and links one source, and `compileProject(project)` several files. Both resolve to an `ArmCompileResult`: `{ ok: true, diagnostics }`, where `diagnostics` holds the warnings, or `{ ok: false, diagnostics, errors, report }`, where `errors` are the diagnostics with severity `error` and `report` is their `formatted` texts, one per line. A diagnostic has this shape:

```ts
type ArmDiagnostic = {
    file?: string                        // project path; absent when the tool named no file
    lineIndex: number                    // zero-based
    column: number                       // one-based, in UTF-16 units
    endColumn?: number                   // exclusive; the span is the name the message quotes, else the statement
    line: { line: string; line_index: number }   // the text of the line
    message: string
    formatted: string                    // main.s:3: error: bad instruction `foo r3,r4'
    severity: 'error' | 'warning'
    source: 'as' | 'ld' | 'unicorn-edu'  // which tool said it; ld's errors are on the line of the reference
}
```

Sources are assembled with `-g` and the flags in `emulator.architecture.assemblerFlags`: `-mcpu=cortex-a15 -mfpu=neon-vfpv4 -mfloat-abi=hard` on 32-bit ARM, `-march=armv8-a` on AArch64. The program starts at `_start`, or at `main` when there is no `_start`; with neither, the build fails with an error from `'unicorn-edu'`. A failed build leaves the previously compiled program loaded.

### Projects of several files

A project maps root-relative paths to text or bytes (a `Uint8Array`, for `.incbin`) and names the entry file:

```ts
const project = {
    entry: 'src/main.s',
    files: {
        'src/main.s': '    .include "macros.s"\n    .global _start\n_start:\n    exit_with 7\n',
        'src/macros.s': '    .macro exit_with code\n    mov r0, #\\code\n    bl finish\n    .endm\n',
        'lib/finish.s': '    .global finish\nfinish:\n    mov r7, #1\n    svc #0\n',
    },
}

await emulator.compileProject(project)
emulator.initialize(100)
console.log(await emulator.run())
// { kind: 'exit', exitCode: 7, executed: 4 }
```

Every `.s`, `.S` or `.asm` file that no other assembly file `.include`s is assembled as its own unit, the entry first, and the units are linked, so `bl finish` above resolves across files. An included file is assembled where it is included. `.include "..."` searches the project root and the directory of the unit being assembled, not the directory of the file that holds the directive. Diagnostics, instructions, breakpoints, history steps and call-stack frames name the project file they belong to.

`check(project)` runs the same build and returns its diagnostics without replacing the loaded program. `assembleProject(project, ARM)`, `linkProgram(units, project, ARM)` and `parseElf(bytes)` run GNU as and ld without an emulator and read the ELF they produce.

### Run

`initialize(undoSize)` loads the last successful build into a fresh machine, so calling it again restarts the program. `undoSize` is the number of steps the [undo history](#undo-history) keeps; 0 turns it off. The examples from here on use this program:

```ts
const source = `    .global _start
_start:
    mov r4, #3
    mov r0, #0
loop:
    bl add_ten
    subs r4, r4, #1
    bne loop
    mov r7, #1
    svc #0
add_ten:
    add r0, r0, #10
    bx lr
`

await emulator.compile(source)
emulator.initialize(200)
```

`run(limit?, breakpoints?, options?)` runs at most `limit` instructions (no limit when absent) and resolves to an `ArmRunResult`: `executed`, the number of instructions this call executed (a faulting one included), and a `kind`:

| `kind` | The run stopped because | Other fields |
| --- | --- | --- |
| `limit` | it executed the whole instruction limit | |
| `breakpoint` | the next instruction is one a breakpoint names; it has not run | `address` (`bigint`) |
| `exit` | the program called `exit`, returned from its entry point, or ran past its last instruction | `exitCode`, or `message` in the last case |
| `wait` | the program called `nanosleep` | `waitMs` (milliseconds) |
| `pause` | the program executed `bkpt` (ARM) or `brk` (AArch64); the next run continues after it | |
| `halt` | emulation stopped by itself, as on `wfi` | |
| `error` | the program faulted or made an unsupported system call | `message`, and `address` (`bigint`, the PC) |

`exitCode` is `r0` (`x0`) read as a signed 32-bit integer, so `exit(255)` gives 255 and `exit(-1)` gives -1.

A breakpoint is a zero-based source line: a number for a line of the entry file, `{ path, line }` for a line of any project file. A line that assembled to no instruction (a label, a directive, a comment) stops nothing, and one that assembled to several consecutive instructions stops once, before the first. Each `run` takes the breakpoints it should stop on and replaces the previous set.

```ts
const breakpoints = [6] // `subs r4, r4, #1`

await emulator.run(10_000, breakpoints)
// { kind: 'breakpoint', executed: 5, address: 65548n }
emulator.getRegisterValue('r0') // 10n, and r4 is still 3: subs has not run

await emulator.run(10_000, breakpoints)
// { kind: 'breakpoint', executed: 5, address: 65548n }

await emulator.run(10_000, breakpoints, { skipBreakpointAtPc: false })
// { kind: 'breakpoint', executed: 0, address: 65548n }
```

A breakpoint stops the run before its instruction, except the instruction the run starts on while `skipBreakpointAtPc` is true (the default). That is how the second run above leaves the breakpoint the first one stopped on, and `skipBreakpointAtPc: false`, as in the third, stops there again. Pass it on the first run after `initialize` when the entry instruction has a breakpoint.

When the limit and a breakpoint fall on the same instruction, the result is `breakpoint`. `step()` is `run(1)` without breakpoints: it executes one instruction, a system call included, and returns `{ kind: 'limit', executed: 1 }` unless that instruction stopped the run some other way, such as an exit or a fault.

A fault in the program is a result, not an exception. The methods throw for host mistakes, such as running before `initialize` or writing unmapped memory. Instructions execute synchronously, so a run blocks the thread it is called from until it stops or waits for input. To keep a page responsive, run in slices with a limit and yield between them, or run the emulator in a worker.

`hasTerminated()` is true after an `exit`, a fault, a `halt`, or a run past the last instruction. A terminated program stays where it is: `run` and `step` return the same result again with `executed: 0`, until `undo()` takes the program back. `getTermination()` returns how it ended: `{ kind: 'exit', code }`, `{ kind: 'end' }` (ran past its last instruction), `{ kind: 'fault', message, address }` or `{ kind: 'halt' }`, and `null` while the program can run. `getStatus()` returns an `EmulatorStatus`: `NotReady` before a program is initialized, `Running`, `WaitingForInput` while a `stdin` call is pending, or `Terminated`. `dispose()` releases the machine.

### Input and sleeping

When the program reads file descriptor 0 and nothing is buffered, the `stdin` option is called. It returns the next text, with its newline if it has one, or `null` for the end of input, and it may return a promise: `run` stays pending until it settles. The text is encoded as UTF-8 and handed out as the program asks for bytes, so one chunk can serve several reads. After `null`, reads return 0. Without a `stdin` option the input is empty.

```ts
const lines = ['42\n', '43\n']
const emulator = await createArmEmulator({
    stdin: async () => lines.shift() ?? null,
})
```

A run that is waiting for input has not returned, and starting another run on the same emulator meanwhile is not supported. Calling `initialize` or `dispose` then makes the waiting run reject with `ArmEmulatorSupersededError`.

A `nanosleep` call is answered at once (the result register is 0) and `run` returns `{ kind: 'wait', waitMs }`. The emulator does not sleep: wait as long as suits the host, or not at all, and call `run` again to continue. `clock_gettime` reads the `now` option, so a host that skips the waits can advance its own clock by `waitMs`.

```ts
let result = await emulator.run()
while (result.kind === 'wait') {
    await new Promise((resolve) => setTimeout(resolve, result.waitMs))
    result = await emulator.run()
}
```

### Registers, flags and memory

Register values are unsigned `bigint`s, and a write is truncated to the register's width (32 or 64 bits), so `-1n` stores all ones. The names are `r0`-`r12`, `sp`, `lr` and `pc` on 32-bit ARM, and `x0`-`x30`, `sp` and `pc` on AArch64. In Thumb state `getPc()` is still the even address and bit 5 of the CPSR is set.

```ts
emulator.initialize(200)
await emulator.run(10_000, [6]) // stop before `subs r4, r4, #1`

emulator.getRegisterValue('r0')      // 10n
emulator.getRegisterValues()         // bigint[], in the order of emulator.architecture.registerNames
emulator.getRegisterValuesRecord()   // { r0: 10n, r1: 0n, ... }
emulator.setRegisterValue('r1', 5n)
emulator.getPc()                     // 65548n
emulator.getFlags()                  // [{ name: 'N', value: 0 }, { name: 'Z', value: 0 }, ...] for N, Z, C and V
emulator.getFlagsRegister()          // 16n: the whole CPSR (NZCV on AArch64)

const sp = emulator.getSp()          // 2147483648n
emulator.writeMemoryBytes(sp - 4n, new Uint8Array([1, 2, 3, 4]))
emulator.readMemoryBytes(sp - 4n, 4) // Uint8Array(4) [ 1, 2, 3, 4 ]
```

Memory addresses are `bigint`s. Reading memory that is not mapped gives zeros; writing to it throws. A host write over code takes effect at once.

`getFloatingPointRegisterValues()` returns the registers of `emulator.architecture.floatingPoint` in order, and `setFloatingPointRegister(name, value)` writes one: `d0`-`d31` and `fpscr` on 32-bit ARM, the 128-bit `v0`-`v31` with `fpcr` and `fpsr` on AArch64. The values are raw bits: `new Float64Array(new BigUint64Array([d1]).buffer)[0]` reads a `d` register as a number. On ARM a NEON `q` register is a pair of `d` registers (`q2` is `d4` in the low half and `d5` in the high half), and on AArch64 `d0` is the low half of `v0`.

### Undo history

`initialize(undoSize)` sets how many steps the history keeps; older ones are dropped. A step is one instruction, or one [group of host writes](#host-writes-as-one-step). With `initialize(0)` there is no history, `canUndo()` is false and runs are faster. The call stack does not depend on the history. A kept step takes about 0.7 KB of WebAssembly memory on 32-bit ARM and 0.85 KB on AArch64, and the memory is limited to 2 GB, so `initialize` throws beyond about 3 million steps on ARM and 2.5 million on AArch64.

`getUndoHistory(max)` returns up to `max` steps, newest first. `undo()` reverts the newest one: its memory and register writes, the general registers including the PC and flags, and the call stack. It returns `false` when there is nothing to undo, and a program that had ended is running again afterwards.

```ts
emulator.initialize(200)
await emulator.run(6)

emulator.getUndoHistory(10)[3].mutations // the `bl add_ten` step: the link register and the call
// [ { type: 'WriteRegister', value: { register: 'lr', old: 4096n, new: 65548n, size: 4 } },
//   { type: 'PushCallStack', value: { from: 65544n, to: 65564n } } ]

emulator.canUndo() // true
emulator.undo()    // true: the newest step is reverted
```

```ts
type ExecutionStep = {
    kind: 'instruction' | 'poke'
    pc: number                       // the instruction's address; for a poke, where the program was
    line: number                     // zero-based source line; -1 for a poke or an unmapped instruction
    file?: string
    mutations: MutationOperation[]
    old_ccr: { bits: number }        // CPSR (ARM) or NZCV (AArch64) before the step
    new_ccr: { bits: number }        // and after it
    writes?: PokeWrite[]             // pokes only
    reversible: boolean              // false: the writes were too large to journal
}
```

A step lists what it changed, with both values:

| `type` | `value` |
| --- | --- |
| `WriteRegister` | `{ register, old, new, size }`: the whole register as `bigint`s, `size` a `RegisterSize` (1, 2, 4, 8 or 16 bytes) |
| `WriteMemoryBytes` | `{ address, old, new }`: the bytes before and after, as `number[]` |
| `PushCallStack` | `{ from, to }`: the call site and the callee |
| `PopCallStack` | `{ from, to }`: the returning instruction and the address it returns to |

The PC and the flags register are not mutations: they are `pc`, `old_ccr` and `new_ccr`. Floating-point and SIMD writes are reported as whole registers, whatever width the instruction wrote: `d0`-`d31` (a NEON `q` register is two mutations) and `fpscr` on ARM, `v0`-`v31` on AArch64. A system call's effects, such as the result register and the bytes a `read` stored, belong to the `svc` step. A step that writes more than 512 KB, plus 32 bytes per kept step, is too large to journal: it has `reversible: false`, and `canUndo()` is false while it is the newest step.

### Host writes as one step

Register and memory writes made between `beginPoke()` and `endPoke()` become a single step of the history, with `kind: 'poke'`, which `undo()` reverts like an instruction:

```ts
emulator.beginPoke()
emulator.setRegisterValue('r3', 99n)
emulator.writeMemoryBytes(emulator.getSp() - 4n, new Uint8Array([1, 2, 3, 4]))
emulator.endPoke() // true: recorded as one step

emulator.getUndoHistory(1)[0].kind // 'poke'
emulator.undo()                    // reverts both writes
emulator.getRegisterValue('r3')    // 0n
```

`endPoke()` returns `false`, and records nothing, when nothing changed, the history is off, or no poke is open. A poke step has `line: -1`, and its `writes` repeat the `mutations` as `{ type: 'register', name, old, new }` and `{ type: 'memory', address, old, new }`. `beginPoke()` throws when a poke is already open, and `run`, `step` and `undo` throw while one is open; `isPokeOpen()` says whether one is. Outside a poke the setters write directly and record nothing, and the next `undo()` restores the general registers from the step's snapshot, so a direct register write does not survive it.

### Call stack and source lines

```ts
emulator.initialize(200)
await emulator.run(10_000, [11]) // `add r0, r0, #10`, inside add_ten

emulator.getCallStack()
// [ { name: 'add_ten', address: 65564n, destination: 65548n, sp: 2147483648n,
//     line: 11, file: 'main.s', color: 'hsl(0, 40%, 60%)' } ]

emulator.getAddressesForLine(11) // [ 65564n ]
emulator.getNextInstruction()
// { address: 65564n, lineNumber: 11, file: 'main.s', size: 4,
//   bytes: Uint8Array(4) [ 10, 0, 128, 226 ], code: 'add r0, r0, #10' }
```

Frames are listed outermost first. `address` is where the call went, `destination` where it returns to, `sp` the stack pointer when the callee started and `color` an `hsl()` string that depends on the depth. `name` is the nearest symbol at or below `address`, or `''`, and `line` and `file` locate `address`. A call is a branch that leaves the address of the following instruction in the link register (`bl`, `blx`, `blr`), and a return is any jump to the innermost frame's return address (`bx lr`, `pop {pc}`, `ret`). The stack holds at most 65,536 frames and drops the outermost beyond that. Undo restores it.

`getAddressesForLine(line, path)` returns where execution enters a line, and `path` defaults to the entry file. `getNextInstruction()` is the instruction at the PC (`null` once the program has exited or run past its end), `getLastInstruction()` the one that ran last or faulted (`null` before anything ran), `getInstructionAt(address)` the one containing an address, and `getCompiledInstructions()` every instruction of the build, in address order. They return `{ address, lineNumber, file?, size?, bytes?, code }`: `lineNumber` is zero-based and -1 when no source line produced the instruction, `bytes` is read from the loaded machine and so is absent before `initialize()`, and `code` is the source line, trimmed. `address`, `size` and `bytes` cover everything the line assembled to (a macro call is one entry), so use `getPc()` for the next instruction's own address.

## What a program sees

### Entry point and exit

The PC starts at the entry point and `sp` at the top of the stack. The link register (`lr`, `x30`) points to a return trampoline, one page of code that calls `exit` with the result register, so returning from `_start` or `main` exits with `r0` or `x0` as the status. Every other register is zero. 32-bit ARM starts in user mode, and in Thumb state when the entry point is a Thumb function. A program that runs past its last instruction ends with `{ kind: 'exit', message }` and no `exitCode`, instead of executing a literal pool or whatever else follows.

### System calls

Linux calling convention: `svc #0` (the immediate is ignored), the call number in `r7` (ARM) or `x8` (AArch64), arguments in `r0`-`r2` or `x0`-`x2`, the result in `r0` or `x0`.

| ARM `r7` | AArch64 `x8` | Call | Behaviour |
| --- | --- | --- | --- |
| 1, 248 | 93, 94 | `exit`, `exit_group` | Ends the program with the status in the first argument. |
| 3 | 63 | `read` | File descriptor 0 only. Takes bytes from the buffered input, asking `stdin` when there are none. Returns the byte count, 0 at the end of input. |
| 4 | 64 | `write` | File descriptors 1 and 2, to `stdout` and `stderr`. Returns the count. |
| 45 | 214 | `brk` | Moves the end of the heap, as the raw Linux call does: it returns the new break, or the current one when the request is refused. |
| 162 | 101 | `nanosleep` | Reads the `timespec` the first argument points to, sets the result to 0, and the run returns `{ kind: 'wait', waitMs }`. |
| 263 | 113 | `clock_gettime` | Ignores the clock id and stores `now()` as a `timespec` at the second argument. |

A `timespec` has two 32-bit fields on ARM and two 64-bit fields on AArch64. A `read` or `write` on another file descriptor returns -9 (`EBADF`). Any other call number stops the program with an `error` result.

`bkpt` (ARM) and `brk` (AArch64) pause the run, which continues after the instruction.

### Memory map

| Region | Default address | Access | `layout` key |
| --- | --- | --- | --- |
| Return trampoline | `0x1000`, one page | read, execute | `returnTrampoline` |
| `.text`, then `.rodata` | `0x10000` | read, execute | `textAddress` |
| `.data`, then `.bss` | the next 4 KB boundary | read, write | |
| Heap | from the first page boundary after the program; `brk` maps it, up to 16 MB | read, write | `heapLimit` (`0x1000000`) |
| Stack | the 1 MB below `0x80000000` | read, write | `stackTop`, `stackSize` (`0x100000`) |

`sp` starts at `stackTop`. Unmapped addresses fault. Code is read-only and nothing outside the first two rows is executable, so a store into the code or a jump into data, the heap or the stack stops the program with an `error`.

## Limitations

- Undo does not give back what left the machine: standard input that was read, output that was written, and the `brk` break, which stays where the undone call put it.
- Only the system calls in the table exist. There are no files and no `mmap`.
- There are no memory-mapped devices and no hooks on memory access.
- A unit with `.file` and `.loc` directives, as GCC writes them, is described by the file and line they name. When that file is not in the project, as is usual, its instructions have no source line, so nothing can stop on them.
- A literal pool made by `ldr rN, =value` is not marked as data. In `getCompiledInstructions()` it is listed as instructions on the line of the `ldr` on ARM, and counted in the `size` of the instruction before it on AArch64.

## Size and speed

| | 32-bit ARM | AArch64 |
| --- | --- | --- |
| Emulator (`machine-*.wasm`) | 710 KB (238 KB gzipped) | 1.29 MB (354 KB) |
| GNU as (`*-as.wasm`) | 1.06 MB (430 KB) | 1.43 MB (570 KB) |
| GNU ld (`*-ld.wasm`) | 1.31 MB (427 KB) | 1.52 MB (524 KB) |
| Total | 3.1 MB (1.1 MB) | 4.2 MB (1.4 MB) |

A loop of `add`, `eor`, `str`, `cmp` and a branch, run in slices of 100,000 instructions, executes about 11 million instructions per second on 32-bit ARM and 10 million on AArch64 with the history off, and 3.7 and 2.4 million with 200 steps of history (`npm run measure`, Node 24 on WSL2).

## Building from source

The WebAssembly modules are committed under `ts/src/wasm`, so the TypeScript only needs Node (CI uses 24):

```sh
cd ts
npm ci
npm test
npm run build
```

`npm run build` writes `ts/dist`, and `npm run measure` prints the throughput figures above.

Rebuilding the WebAssembly modules needs [Emscripten](https://emscripten.org) on `PATH` (`source ~/emsdk/emsdk_env.sh`), CMake and Python 3. The binutils build also downloads the 2.45 source with `curl`. From the repository root:

```sh
scripts/build-unicorn.sh arm        # Unicorn and native/ -> ts/src/wasm/machine-arm.{mjs,wasm}
scripts/build-unicorn.sh aarch64    # -> ts/src/wasm/machine-aarch64.{mjs,wasm}
scripts/build-binutils.sh arm       # GNU as and ld 2.45 for arm-none-eabi -> ts/src/wasm/arm-{as,ld}.{mjs,wasm}
scripts/build-binutils.sh aarch64   # for aarch64-none-elf -> ts/src/wasm/aarch64-{as,ld}.{mjs,wasm}
```

`npm run build:wasm` in `ts/` runs all four. `native/` holds the C debugger layer and `third_party/unicorn` is the Unicorn submodule, pinned at 2.1.4. `build-unicorn.sh` applies the patches to the submodule in place the first time it runs, and `build-unicorn.sh --reset` restores the pinned commit. What is patched, and why, is in [`patches/README.md`](patches/README.md). `scripts/gen-register-ids.py`, run from the repository root, regenerates `ts/src/arm-register-ids.ts` and `ts/src/arm64-register-ids.ts` from Unicorn's headers.

## License

Copyright (C) 2026 Specy.

unicorn-edu is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 2 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

The emulator modules link [Unicorn](https://github.com/unicorn-engine/unicorn), which is GPL-2.0 only, so builds of them are distributed under GPL-2.0. The bundled GNU as and ld are GPL-3.0-or-later. [`ts/src/wasm/NOTICE.md`](ts/src/wasm/NOTICE.md) lists the third-party code in each WebAssembly module and where its source is, and [`patches/README.md`](patches/README.md) covers the QEMU and unicorn.js code under `vendor/` and `patches/`.
