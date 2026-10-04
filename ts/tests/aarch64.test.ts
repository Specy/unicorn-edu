import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AARCH64_FLOATING_POINT_REGISTERS, RegisterSize, createAarch64Emulator } from '../src'
import { doubleFromBits, lineOf, loadAarch64 as load } from './helpers'

const fp = (name: string) => AARCH64_FLOATING_POINT_REGISTERS.findIndex((register) => register.name === name)

const HELLO = `
    .data
message: .asciz "Hello, AArch64!\\n"
    .text
    .global _start
_start:
    mov x0, #1
    adr x1, message
    mov x2, #16
    mov x8, #64
    svc #0
    mov x0, #3
    mov x8, #93
    svc #0
`

const LOOP = `
    .global _start
_start:
    mov x4, #3
    mov x0, #0
loop:
    bl add_ten
    subs x4, x4, #1
    b.ne loop
    mov x8, #93
    svc #0
add_ten:
    add x0, x0, #10
    ret
`

describe('AArch64: building', () => {
    it('reports errors on their lines', async () => {
        const emulator = await createAarch64Emulator()
        const result = await emulator.compile('    .global _start\n_start:\n    mov x0, #1\n    mov r0, #1\n')
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors.map((error) => [error.lineIndex, error.source])).toEqual([[3, 'as']])
    })

    it('maps every instruction to its line', async () => {
        const { emulator } = await load(LOOP)
        const instructions = emulator.getCompiledInstructions()
        expect(instructions[0]).toMatchObject({ address: 0x10000n, lineNumber: lineOf(LOOP, 'mov x4, #3'), size: 4 })
        expect(instructions.map((instruction) => instruction.code)).toContain('b.ne loop')
    })
})

describe('AArch64: running', () => {
    it('writes to stdout and exits with a status', async () => {
        const { emulator, stdout } = await load(HELLO)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 3, executed: 8 })
        expect(stdout()).toBe('Hello, AArch64!\n')
    })

    it('starts with sp at the stack top and x30 on the return trampoline', async () => {
        const { emulator } = await load(HELLO)
        expect(emulator.getPc()).toBe(0x10000n)
        expect(emulator.getSp()).toBe(0x80000000n)
        expect(emulator.getRegisterValue('x30')).toBe(0x1000n)
        expect(emulator.getRegisterValues()).toHaveLength(33)
    })

    it('stops before a breakpoint and runs on from it', async () => {
        const { emulator } = await load(LOOP)
        const breakpoints = [lineOf(LOOP, 'subs x4')]
        expect(await emulator.run(1000, breakpoints)).toMatchObject({ kind: 'breakpoint', executed: 5 })
        expect(emulator.getRegisterValue('x0')).toBe(10n)
        expect(await emulator.run(1000, breakpoints, { skipBreakpointAtPc: false })).toMatchObject({ executed: 0 })
        expect(await emulator.run(1000, breakpoints)).toMatchObject({ kind: 'breakpoint', executed: 5 })
        expect(emulator.getRegisterValue('x0')).toBe(20n)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 30 })
    })

    it('treats a return from main as exit(x0)', async () => {
        const { emulator } = await load('    .global main\nmain:\n    mov x0, #42\n    ret\n')
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 42 })
    })

    it('ends a program that runs past its last instruction', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    mov x0, #5\n    add x0, x0, #1\n')
        const result = await emulator.run(1000)
        expect(result).toMatchObject({ kind: 'exit', executed: 2 })
        expect(result.message).toContain('past its last instruction')
    })

    it('reports a fault on the instruction that caused it', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    mov x0, #0\n    ldr x1, [x0]\n')
        const result = await emulator.run(1000)
        expect(result.kind).toBe('error')
        expect(result.message).toContain('UC_ERR_READ_UNMAPPED')
        expect(result.message).toContain('main.s:4')
    })

    it('pauses on a brk and resumes after it', async () => {
        const source = '    .global _start\n_start:\n    mov x0, #1\n    brk #3\n    mov x0, #2\n    mov x8, #93\n    svc #0\n'
        const { emulator } = await load(source)
        expect(await emulator.run(100)).toMatchObject({ kind: 'pause', executed: 2 })
        expect(emulator.getNextInstruction()?.code).toBe('mov x0, #2')
        expect(await emulator.run(100)).toMatchObject({ kind: 'exit', exitCode: 2 })
    })

    it('computes with scalar FP and 128-bit NEON registers', async () => {
        const source = `
    .global _start
_start:
    fmov d0, #1.5
    fadd d1, d0, d0
    fcvtzs w0, d1
    movi v2.4s, #1
    add v3.4s, v2.4s, v2.4s
    mov x8, #93
    svc #0
`
        const { emulator } = await load(source)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 3 })
        const values = emulator.getFloatingPointRegisterValues()
        expect(doubleFromBits(values[fp('v1')]! & 0xffffffffffffffffn)).toBe(3)
        expect(values[fp('v3')]).toBe(0x0000000200000002_0000000200000002n)
    })
})

describe('AArch64: system calls', () => {
    it('echoes standard input', async () => {
        const source = `
    .bss
buffer: .space 32
    .text
    .global _start
_start:
    mov x0, #0
    adr x1, buffer
    mov x2, #32
    mov x8, #63
    svc #0
    mov x2, x0
    mov x0, #1
    adr x1, buffer
    mov x8, #64
    svc #0
    mov x0, #0
    mov x8, #93
    svc #0
`
        const { emulator, stdout } = await load(source, { stdin: async () => 'arm64\n' })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0 })
        expect(stdout()).toBe('arm64\n')
    })

    it('grows the heap with brk', async () => {
        const source = `
    .global _start
_start:
    mov x0, #0
    mov x8, #214
    svc #0
    mov x4, x0
    add x0, x0, #8192
    mov x8, #214
    svc #0
    sub x1, x0, x4
    mov x2, #0x55
    add x5, x4, #4096
    str x2, [x5]
    ldr x3, [x5]
    add x0, x1, x3
    mov x8, #93
    svc #0
`
        const { emulator } = await load(source)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 8192 + 0x55 })
    })

    it('reads the clock and waits, with 64-bit timespec fields', async () => {
        const source = `
    .data
now:   .quad 0, 0
pause: .quad 1, 500000000
    .text
    .global _start
_start:
    mov x0, #0
    adr x1, now
    mov x8, #113
    svc #0
    adr x0, pause
    mov x1, #0
    mov x8, #101
    svc #0
    adr x1, now
    ldr x0, [x1]
    ldr x2, [x1, #8]
    mov x8, #93
    svc #0
`
        const { emulator } = await load(source, { now: () => 42_250 })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'wait', waitMs: 1500 })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 42 })
        expect(emulator.getRegisterValue('x2')).toBe(250_000_000n)
    })
})

describe('AArch64: history, Pokes and the call stack', () => {
    const PROGRAM = `
    .data
value: .quad 0
    .text
    .global _start
_start:
    mov x1, #5
    adr x2, value
    str x1, [x2]
    bl helper
    mov x0, #0
    mov x8, #93
    svc #0
helper:
    add x1, x1, #1
    ret
`

    it('describes each step with 64-bit registers', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(6)
        const [ret, add, call, store, address, move] = emulator.getUndoHistory(10)
        expect(move!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'x1', old: 0n, new: 5n, size: RegisterSize.Double } },
        ])
        expect(address!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'x2', old: 0n, new: 0x11000n, size: RegisterSize.Double } },
        ])
        expect(store!.mutations).toEqual([
            { type: 'WriteMemoryBytes', value: { address: 0x11000n, old: [0, 0, 0, 0, 0, 0, 0, 0], new: [5, 0, 0, 0, 0, 0, 0, 0] } },
        ])
        expect(call!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'x30', old: 0x1000n, new: 0x10010n, size: RegisterSize.Double } },
            { type: 'PushCallStack', value: { from: 0x1000cn, to: 0x1001cn } },
        ])
        expect(add!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'x1', old: 5n, new: 6n, size: RegisterSize.Double } },
        ])
        expect(ret!.mutations).toEqual([{ type: 'PopCallStack', value: { from: 0x10020n, to: 0x10010n } }])
    })

    it('undoes back to the start and replays the same way', async () => {
        const { emulator } = await load(PROGRAM)
        const start = emulator.getRegisterValues()
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0 })
        let undone = 0
        while (emulator.undo()) undone++
        expect(undone).toBe(9)
        expect(emulator.getRegisterValues()).toEqual(start)
        expect([...emulator.readMemoryBytes(0x11000n, 8)]).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0, executed: 9 })
    })

    it('journals and undoes 128-bit SIMD registers', async () => {
        const source = `
    .global _start
_start:
    movi v2.4s, #1
    add v3.4s, v2.4s, v2.4s
    fmov d0, #1.5
    b .
`
        const { emulator } = await load(source)
        await emulator.run(3)
        const [, add] = emulator.getUndoHistory(3)
        expect(add!.mutations).toEqual([
            {
                type: 'WriteRegister',
                value: { register: 'v3', old: 0n, new: 0x0000000200000002_0000000200000002n, size: RegisterSize.Quad },
            },
        ])
        emulator.undo()
        emulator.undo()
        expect(emulator.getFloatingPointRegisterValues()[fp('v3')]).toBe(0n)
        expect(emulator.getFloatingPointRegisterValues()[fp('v2')]).toBe(0x0000000100000001_0000000100000001n)
        emulator.undo()
        expect(emulator.getFloatingPointRegisterValues()[fp('v2')]).toBe(0n)
    })

    it('records Pokes of 64-bit and SIMD registers and memory', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(3)
        emulator.beginPoke()
        emulator.setRegisterValue('x3', 0x1_0000_0000n)
        emulator.setFloatingPointRegister('v7', 0xffn << 100n)
        emulator.writeMemoryBytes(0x11000n, new Uint8Array([9]))
        expect(emulator.endPoke()).toBe(true)
        expect(emulator.getUndoHistory(1)[0]!.writes).toEqual([
            { type: 'register', name: 'x3', old: 0n, new: 0x1_0000_0000n },
            { type: 'register', name: 'v7', old: 0n, new: 0xffn << 100n },
            { type: 'memory', address: 0x11000n, old: [5], new: [9] },
        ])
        emulator.undo()
        expect(emulator.getRegisterValue('x3')).toBe(0n)
        expect(emulator.getFloatingPointRegisterValues()[fp('v7')]).toBe(0n)
        expect(emulator.readMemoryBytes(0x11000n, 1)[0]).toBe(5)
    })

    it('follows nested calls and recursion', async () => {
        const source = `
    .global _start
_start:
    mov x0, #5
    bl factorial
    mov x8, #93
    svc #0
factorial:
    cmp x0, #1
    b.gt recurse
    mov x0, #1
    ret
recurse:
    stp x0, x30, [sp, #-16]!
    sub x0, x0, #1
    bl factorial
    ldp x1, x30, [sp], #16
    mul x0, x1, x0
    ret
`
        const { emulator } = await load(source)
        for (let depth = 1; depth <= 5; depth++) {
            expect((await emulator.run(1000, [lineOf(source, 'cmp x0, #1')])).kind).toBe('breakpoint')
            expect(emulator.getCallStack().map((frame) => frame.name)).toEqual(Array(depth).fill('factorial'))
        }
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 120 })
        expect(emulator.getCallStack()).toEqual([])
    })
})

describe('AArch64: compiler output and long blocks', () => {
    const START = '    .text\n    .global _start\n_start:\n    bl __asm_editor_main\n    mov x8, #93\n    svc #0\n'

    for (const level of ['O0', 'O2']) {
        it(`runs ARM64 GCC 14.2 -${level} output unedited`, async () => {
            const generated = readFileSync(new URL(`./fixtures/gcc-14.2-aarch64-${level}.s`, import.meta.url), 'utf8')
            const { emulator } = await load({ entry: 'start.s', files: { 'start.s': START, 'example.s': generated } })
            expect(await emulator.run(1_000_000)).toMatchObject({ kind: 'exit', exitCode: 1698 })
        })
    }

    it('runs a long block of integer and FP instructions under history', async () => {
        const source = `
    .global _start
_start:
    fmov d1, #1.0
    .rept 300
    add x0, x0, #1
    .endr
    .rept 512
    fadd d0, d0, d1
    .endr
    mov x8, #93
    svc #0
`
        const { emulator } = await load(source, { undo: 1000 })
        expect(await emulator.run(10_000)).toMatchObject({ kind: 'exit', exitCode: 300 })
        expect(doubleFromBits(emulator.getFloatingPointRegisterValues()[fp('v0')]! & 0xffffffffffffffffn)).toBe(512)
    })
})
