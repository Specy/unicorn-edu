import { describe, expect, it } from 'vitest'
import { EmulatorStatus } from '../src'
import { doubleFromBits, lineOf, load, readU32 } from './helpers'

const HELLO = `
    .data
message: .asciz "Hello, ARM!\\n"
    .text
    .global _start
_start:
    mov r0, #1
    ldr r1, =message
    mov r2, #12
    mov r7, #4
    svc #0
    mov r0, #3
    mov r7, #1
    svc #0
`

const LOOP = `
    .global _start
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

describe('running', () => {
    it('writes to stdout and exits with a status', async () => {
        const { emulator, stdout } = await load(HELLO)
        const result = await emulator.run(1000)
        expect(result).toMatchObject({ kind: 'exit', exitCode: 3, executed: 8 })
        expect(stdout()).toBe('Hello, ARM!\n')
        expect(emulator.hasTerminated()).toBe(true)
        expect(emulator.getStatus()).toBe(EmulatorStatus.Terminated)
        expect(emulator.getNextInstruction()).toBeNull()
        expect(emulator.getLastInstruction()?.lineNumber).toBe(lineOf(HELLO, 'svc #0') + 3)
    })

    it('starts in user mode with sp at the stack top and lr on the return trampoline', async () => {
        const { emulator } = await load(HELLO)
        expect(emulator.getPc()).toBe(0x10000n)
        expect(emulator.getSp()).toBe(0x80000000n)
        expect(emulator.getRegisterValue('lr')).toBe(0x1000n)
        expect(emulator.getCpsr() & 0x1f).toBe(0x10)
        expect(emulator.getNextInstruction()).toMatchObject({ lineNumber: lineOf(HELLO, 'mov r0, #1'), code: 'mov r0, #1' })
    })

    it('runs no more than its instruction limit', async () => {
        const { emulator } = await load(LOOP)
        expect(await emulator.run(5)).toEqual({ kind: 'limit', executed: 5 })
        expect(await emulator.run(0)).toEqual({ kind: 'limit', executed: 0 })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 30 })
    })

    it('stops before a breakpoint, and runs on from the one it is parked on', async () => {
        const { emulator } = await load(LOOP)
        const breakpoints = [lineOf(LOOP, 'subs r4')]
        const first = await emulator.run(1000, breakpoints)
        expect(first).toMatchObject({ kind: 'breakpoint', executed: 5 })
        expect(emulator.getRegisterValue('r0')).toBe(10n)
        expect(emulator.getRegisterValue('r4')).toBe(3n) // subs has not run
        // parked on it: a run that may not skip it does not move
        expect(await emulator.run(1000, breakpoints, { skipBreakpointAtPc: false })).toMatchObject({
            kind: 'breakpoint',
            executed: 0,
        })
        const second = await emulator.run(1000, breakpoints)
        expect(second).toMatchObject({ kind: 'breakpoint', executed: 5 })
        expect(emulator.getRegisterValue('r0')).toBe(20n)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 30 })
    })

    it('accepts breakpoints as Project locations', async () => {
        const { emulator } = await load(LOOP)
        const result = await emulator.run(1000, [{ path: 'main.s', line: lineOf(LOOP, 'add r0, r0, #10') }])
        expect(result).toMatchObject({ kind: 'breakpoint', executed: 3 })
        expect(result.address).toBe(emulator.getAddressesForLine(lineOf(LOOP, 'add r0, r0, #10'))[0])
    })

    it('steps one instruction at a time, through system calls', async () => {
        const { emulator, stdout } = await load(HELLO)
        for (let i = 0; i < 5; i++) expect(await emulator.step()).toEqual({ kind: 'limit', executed: 1 })
        expect(stdout()).toBe('Hello, ARM!\n')
        expect(emulator.getRegisterValue('r0')).toBe(12n) // write returned the length
    })

    it('ends a program that runs past its last instruction', async () => {
        const source = '    .global _start\n_start:\n    mov r0, #5\n    add r0, r0, #1\n'
        const { emulator } = await load(source)
        const result = await emulator.run(1000)
        expect(result).toMatchObject({ kind: 'exit', executed: 2 })
        expect(result.message).toContain('past its last instruction')
        expect(emulator.getRegisterValue('r0')).toBe(6n)
        expect(emulator.getNextInstruction()).toBeNull()
    })

    it('stops before a literal pool rather than executing it', async () => {
        const source = '    .global _start\n_start:\n    ldr r0, =0x12345678\n    add r0, r0, #1\n    .ltorg\n'
        const { emulator } = await load(source)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', executed: 2 })
        expect(emulator.getRegisterValue('r0')).toBe(0x12345679n)
    })

    it('treats a return from main as exit(r0)', async () => {
        const { emulator } = await load('    .global main\nmain:\n    mov r0, #42\n    bx lr\n')
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 42 })
    })

    it('reports a fault on the instruction that caused it', async () => {
        const source = '    .global _start\n_start:\n    mov r0, #0\n    ldr r1, [r0]\n    b _start\n'
        const { emulator } = await load(source)
        const result = await emulator.run(1000)
        expect(result.kind).toBe('error')
        expect(result.message).toContain('UC_ERR_READ_UNMAPPED')
        expect(result.message).toContain('main.s:4')
        expect(emulator.getLastInstruction()?.lineNumber).toBe(3)
        expect(emulator.hasTerminated()).toBe(true)
        // a later run says the same thing and executes nothing
        expect(await emulator.run(1000)).toMatchObject({ kind: 'error', executed: 0 })
    })

    it('runs Thumb-2 code', async () => {
        const source = `
    .syntax unified
    .thumb
    .global _start
    .thumb_func
_start:
    movs r0, #1
    mov.w r1, #0x10001
    adds r0, r0, r1
    bl double
    mov r7, #1
    svc #0
    .thumb_func
double:
    lsls r0, r0, #1
    bx lr
`
        const { emulator } = await load(source)
        expect(emulator.getCpsr() & (1 << 5)).not.toBe(0)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0x20004 })
    })

    it('computes with VFP doubles and NEON', async () => {
        const source = `
    .global _start
_start:
    vmov.f64 d0, #1.5
    vadd.f64 d1, d0, d0
    vdup.32 q2, r0
    vcvt.s32.f64 s0, d1
    vmov r0, s0
    mov r7, #1
    svc #0
`
        const { emulator } = await load(source)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 3 })
        expect(doubleFromBits(emulator.getVfpRegisters().d[1]!)).toBe(3)
    })
})

describe('exceptions', () => {
    for (const thumb of [false, true]) {
        it(`pauses on a bkpt and resumes after it${thumb ? ' in Thumb state' : ''}`, async () => {
            const source = thumb
                ? '    .syntax unified\n    .thumb\n    .global _start\n    .thumb_func\n_start:\n    movs r0, #1\n    bkpt #3\n    movs r0, #2\n    mov r7, #1\n    svc #0\n'
                : '    .global _start\n_start:\n    mov r0, #1\n    bkpt #3\n    mov r0, #2\n    mov r7, #1\n    svc #0\n'
            const { emulator } = await load(source)
            expect(await emulator.run(100)).toMatchObject({ kind: 'pause', executed: 2 })
            expect(emulator.getNextInstruction()?.code).toBe(thumb ? 'movs r0, #2' : 'mov r0, #2')
            expect(await emulator.run(100)).toMatchObject({ kind: 'exit', exitCode: 2 })
        })
    }

    it('halts on a wfi', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    mov r0, #1\n    wfi\n    b _start\n')
        expect(await emulator.run(100)).toMatchObject({ kind: 'halt' })
        expect(emulator.hasTerminated()).toBe(true)
    })

    it('faults on an undefined instruction', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    mov r0, #1\n    udf #7\n')
        const result = await emulator.run(100)
        expect(result.kind).toBe('error')
        expect(result.message).toContain('UC_ERR_INSN_INVALID')
        expect(result.message).toContain('main.s:4')
    })
})

describe('system calls', () => {
    const ECHO = `
    .bss
buffer: .space 32
    .text
    .global _start
_start:
    mov r0, #0
    ldr r1, =buffer
    mov r2, #32
    mov r7, #3
    svc #0
    mov r2, r0
    mov r0, #1
    ldr r1, =buffer
    mov r7, #4
    svc #0
    mov r0, #0
    mov r7, #1
    svc #0
`

    it('reads standard input through an asynchronous source', async () => {
        const answers = ['abc\n']
        const { emulator, stdout } = await load(ECHO, {
            stdin: async () => {
                await new Promise((resolve) => setTimeout(resolve, 5))
                return answers.shift() ?? null
            },
        })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0 })
        expect(stdout()).toBe('abc\n')
    })

    it('abandons a read whose program was reloaded meanwhile', async () => {
        let answer!: (text: string) => void
        const { emulator } = await load(ECHO, { stdin: () => new Promise<string>((resolve) => (answer = resolve)) })
        const running = emulator.run(1000)
        await new Promise((resolve) => setTimeout(resolve, 10))
        emulator.initialize(10)
        answer('late\n')
        await expect(running).rejects.toThrow('reloaded')
        // the new machine is untouched and runs normally
        expect(emulator.getPc()).toBe(0x10000n)
    })

    it('reads nothing at the end of input', async () => {
        const { emulator, stdout } = await load(ECHO, { stdin: () => null })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0 })
        expect(stdout()).toBe('')
    })

    it('grows the heap with brk', async () => {
        const source = `
    .global _start
_start:
    mov r0, #0
    mov r7, #45
    svc #0              @ the current break
    mov r4, r0
    add r0, r0, #8192
    mov r7, #45
    svc #0              @ two pages more
    sub r1, r0, r4
    mov r2, #0x55
    add r5, r4, #4096
    str r2, [r5]        @ the new memory is writable
    ldr r3, [r5]
    add r0, r1, r3
    mov r7, #1
    svc #0
`
        const { emulator } = await load(source)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 8192 + 0x55 })
    })

    it('reads the clock and asks the host to wait', async () => {
        const source = `
    .data
now:   .word 0, 0
pause: .word 1, 500000000
    .text
    .global _start
_start:
    mov r0, #0
    ldr r1, =now
    mov r7, #0x107       @ clock_gettime
    svc #0
    ldr r0, =pause
    mov r1, #0
    mov r7, #162         @ nanosleep
    svc #0
    ldr r1, =now
    ldr r0, [r1]
    mov r7, #1
    svc #0
`
        const { emulator } = await load(source, { now: () => 42_250 })
        expect(await emulator.run(1000)).toMatchObject({ kind: 'wait', waitMs: 1500 })
        expect(emulator.getRegisterValue('r0')).toBe(0n)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 42 })
        expect(readU32(emulator, 0x11000n + 4n)).toBe(250_000_000)
    })

    it('stops on a system call it does not know', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    mov r7, #999\n    svc #0\n')
        const result = await emulator.run(1000)
        expect(result.kind).toBe('error')
        expect(result.message).toContain('Unsupported system call 999')
    })
})
