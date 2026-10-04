import { describe, expect, it } from 'vitest'
import { doubleFromBits, lineOf, load, readU32 } from './helpers'

const PROGRAM = `
    .data
value: .word 0
    .text
    .global _start
_start:
    mov r1, #5
    ldr r2, =value
    str r1, [r2]
    bl helper
    mov r0, #0
    mov r7, #1
    svc #0
helper:
    add r1, r1, #1
    bx lr
`
const VALUE = 0x11000n

describe('history and Undo', () => {
    it('describes each step: registers, memory, calls and returns', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(6)
        const [ret, add, call, store, load_, move] = emulator.getUndoHistory(10)
        expect(move).toMatchObject({
            kind: 'instruction',
            pc: 0x10000,
            line: lineOf(PROGRAM, 'mov r1, #5'),
            file: 'main.s',
            reversible: true,
            mutations: [{ type: 'WriteRegister', value: { register: 'r1', old: 0n, new: 5n } }],
        })
        expect(load_!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'r2', old: 0n, new: VALUE, size: 4 } },
        ])
        expect(store!.mutations).toEqual([
            { type: 'WriteMemoryBytes', value: { address: VALUE, old: [0, 0, 0, 0], new: [5, 0, 0, 0] } },
        ])
        expect(call!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'lr', old: 0x1000n, new: 0x10010n, size: 4 } },
            { type: 'PushCallStack', value: { from: 0x1000cn, to: 0x1001cn } },
        ])
        expect(add!.mutations).toEqual([{ type: 'WriteRegister', value: { register: 'r1', old: 5n, new: 6n, size: 4 } }])
        expect(ret!.mutations).toEqual([{ type: 'PopCallStack', value: { from: 0x10020n, to: 0x10010n } }])
    })

    it('undoes every step back to the start, and replays the same way', async () => {
        const { emulator } = await load(PROGRAM)
        const start = emulator.getRegisterValues()
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0 })
        expect(readU32(emulator, VALUE)).toBe(5)
        let undone = 0
        while (emulator.canUndo()) {
            expect(emulator.undo()).toBe(true)
            undone++
        }
        expect(undone).toBe(9)
        expect(emulator.hasTerminated()).toBe(false)
        expect(emulator.getRegisterValues()).toEqual(start)
        expect(readU32(emulator, VALUE)).toBe(0)
        expect(emulator.getCallStack()).toEqual([])
        expect(emulator.getLastInstruction()).toBeNull()
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 0, executed: 9 })
    })

    it('puts back what a system call wrote, along with the call', async () => {
        const source = `
    .bss
buffer: .space 8
    .text
    .global _start
_start:
    mov r0, #0
    ldr r1, =buffer
    mov r2, #8
    mov r7, #3
    svc #0
    b .
`
        const { emulator } = await load(source, { stdin: () => 'hey\n' })
        await emulator.run(5)
        expect(emulator.getRegisterValue('r0')).toBe(4n)
        const buffer = emulator.getRegisterValue('r1')
        expect([...emulator.readMemoryBytes(buffer, 4)]).toEqual([...new TextEncoder().encode('hey\n')])
        expect(emulator.undo()).toBe(true)
        expect(emulator.getRegisterValue('r0')).toBe(0n)
        expect([...emulator.readMemoryBytes(buffer, 4)]).toEqual([0, 0, 0, 0])
        expect(emulator.getNextInstruction()?.code).toBe('svc #0')
    })

    it('restores floating-point registers', async () => {
        const source = `
    .global _start
_start:
    vmov.f64 d0, #1.5
    vadd.f64 d1, d0, d0
    vmov.f64 d0, #2.0
    b .
`
        const { emulator } = await load(source)
        await emulator.run(3)
        const steps = emulator.getUndoHistory(3)
        expect(steps[1]!.mutations).toEqual([
            { type: 'WriteRegister', value: { register: 'd1', old: 0n, new: 0x4008000000000000n, size: 8 } },
        ])
        emulator.undo()
        expect(doubleFromBits(emulator.getFloatingPointRegisterValues()[0]!)).toBe(1.5)
        emulator.undo()
        expect(emulator.getFloatingPointRegisterValues()[1]!).toBe(0n)
        emulator.undo()
        expect(emulator.getFloatingPointRegisterValues()[0]!).toBe(0n)
    })

    it('keeps only the newest steps the history was sized for', async () => {
        const { emulator } = await load('    .global _start\n_start:\n    add r0, r0, #1\n    b _start\n', { undo: 5 })
        await emulator.run(100)
        expect(emulator.getRegisterValue('r0')).toBe(50n)
        let undone = 0
        while (emulator.undo()) undone++
        expect(undone).toBe(5)
        expect(emulator.getRegisterValue('r0')).toBe(48n)
    })

    it('records nothing with a history of zero', async () => {
        const { emulator } = await load(PROGRAM, { undo: 0 })
        await emulator.run(3)
        expect(emulator.canUndo()).toBe(false)
        expect(emulator.getUndoHistory(10)).toEqual([])
        // the call stack does not depend on the history
        await emulator.run(1)
        expect(emulator.getCallStack()).toHaveLength(1)
    })

    it('undoes an exit, and the program can run again', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(1000)
        expect(emulator.hasTerminated()).toBe(true)
        emulator.undo()
        expect(emulator.hasTerminated()).toBe(false)
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', executed: 1 })
    })

    it('undoes the instruction that faulted', async () => {
        const source = '    .global _start\n_start:\n    mov r0, #0\n    ldr r1, [r0]\n'
        const { emulator } = await load(source)
        expect((await emulator.run(10)).kind).toBe('error')
        expect(emulator.undo()).toBe(true)
        expect(emulator.hasTerminated()).toBe(false)
        expect(emulator.getNextInstruction()?.code).toBe('ldr r1, [r0]')
    })
})

describe('Thumb state', () => {
    it('undoes Thumb instructions without leaving Thumb state', async () => {
        const source = `
    .syntax unified
    .thumb
    .global _start
    .thumb_func
_start:
    movs r0, #1
    adds r0, r0, #2
    lsls r0, r0, #3
    mov r7, #1
    svc #0
`
        const { emulator } = await load(source)
        await emulator.run(2)
        expect(emulator.getRegisterValue('r0')).toBe(3n)
        emulator.undo()
        emulator.undo()
        expect(emulator.getFlagsRegister() & (1n << 5n)).not.toBe(0n)
        expect(emulator.getPc()).toBe(0x10000n)
        expect(await emulator.run(100)).toMatchObject({ kind: 'exit', exitCode: 24 })
    })
})

describe('Pokes', () => {
    it('records register and memory writes as one step, undone like an instruction', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(3)
        emulator.beginPoke()
        emulator.setRegisterValue('r3', 99n)
        emulator.writeMemoryBytes(VALUE, new Uint8Array([1, 2, 3, 4]))
        expect(emulator.endPoke()).toBe(true)
        const [poke] = emulator.getUndoHistory(1)
        expect(poke).toMatchObject({ kind: 'poke', line: -1 })
        expect(poke!.writes).toEqual([
            { type: 'register', name: 'r3', old: 0n, new: 99n },
            { type: 'memory', address: VALUE, old: [5, 0, 0, 0], new: [1, 2, 3, 4] },
        ])
        expect(emulator.undo()).toBe(true)
        expect(emulator.getRegisterValue('r3')).toBe(0n)
        expect(readU32(emulator, VALUE)).toBe(5)
        // and the instruction before it is next in line
        expect(emulator.getUndoHistory(1)[0]!.kind).toBe('instruction')
    })

    it('records nothing for a poke that changed nothing', async () => {
        const { emulator } = await load(PROGRAM)
        await emulator.run(1)
        emulator.beginPoke()
        expect(emulator.endPoke()).toBe(false)
        expect(emulator.getUndoHistory(5)).toHaveLength(1)
    })

    it('writes directly outside a poke', async () => {
        const { emulator } = await load(PROGRAM)
        emulator.setRegisterValue('r6', 7n)
        expect(emulator.canUndo()).toBe(false)
        expect(emulator.getRegisterValue('r6')).toBe(7n)
    })

    it('changes the code a poke writes over, and puts it back on Undo', async () => {
        const source = '    .global _start\n_start:\n    add r0, r0, #1\n    b _start\n'
        const { emulator } = await load(source)
        await emulator.run(10)
        expect(emulator.getRegisterValue('r0')).toBe(5n)
        // add r0, r0, #100
        emulator.beginPoke()
        emulator.writeMemoryBytes(0x10000n, new Uint8Array([0x64, 0x00, 0x80, 0xe2]))
        emulator.endPoke()
        await emulator.run(10)
        expect(emulator.getRegisterValue('r0')).toBe(505n)
        for (let i = 0; i < 11; i++) emulator.undo()
        expect(emulator.getRegisterValue('r0')).toBe(5n)
        await emulator.run(10)
        expect(emulator.getRegisterValue('r0')).toBe(10n)
    })

    it('refuses to run while a poke is open', async () => {
        const { emulator } = await load(PROGRAM)
        emulator.beginPoke()
        await expect(emulator.run(1)).rejects.toThrow('poke is open')
        emulator.endPoke()
    })
})

describe('call stack', () => {
    const CALLS = `
    .global _start
_start:
    mov r4, #3
loop:
    bl outer
    subs r4, r4, #1
    bne loop
    mov r7, #1
    svc #0
outer:
    push {lr}
    bl inner
    pop {pc}
inner:
    add r0, r0, #1
    bx lr
`

    it('shows each active call, innermost last, every time round a loop', async () => {
        const { emulator } = await load(CALLS)
        const breakpoint = [lineOf(CALLS, 'add r0, r0, #1')]
        for (let iteration = 1; iteration <= 3; iteration++) {
            expect((await emulator.run(1000, breakpoint)).kind).toBe('breakpoint')
            const frames = emulator.getCallStack()
            expect(frames.map((frame) => frame.name)).toEqual(['outer', 'inner'])
            expect(frames[0]).toMatchObject({ address: 0x10018n, destination: 0x10008n, line: lineOf(CALLS, 'push {lr}') })
            expect(frames[1]).toMatchObject({ address: 0x10024n, destination: 0x10020n })
        }
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 3 })
        expect(emulator.getCallStack()).toEqual([])
    })

    it('follows recursion and unwinds it', async () => {
        const source = `
    .global _start
_start:
    mov r0, #5
    bl factorial
    mov r7, #1
    svc #0
factorial:
    cmp r0, #1
    movle r0, #1
    bxle lr
    push {r0, lr}
    sub r0, r0, #1
    bl factorial
    pop {r1, lr}
    mul r0, r1, r0
    bx lr
`
        const { emulator } = await load(source)
        // every level of the recursion passes the base case's test on its way down
        for (let depth = 1; depth <= 5; depth++) {
            expect((await emulator.run(1000, [lineOf(source, 'movle r0, #1')])).kind).toBe('breakpoint')
            expect(emulator.getCallStack().map((frame) => frame.name)).toEqual(Array(depth).fill('factorial'))
        }
        expect(await emulator.run(1000)).toMatchObject({ kind: 'exit', exitCode: 120 })
        expect(emulator.getCallStack()).toEqual([])
    })

    it('undoes calls and returns', async () => {
        const { emulator } = await load(CALLS)
        await emulator.run(1000, [lineOf(CALLS, 'add r0, r0, #1')])
        expect(emulator.getCallStack()).toHaveLength(2)
        emulator.undo() // bl inner
        expect(emulator.getCallStack().map((frame) => frame.name)).toEqual(['outer'])
        await emulator.run(3, [], { skipBreakpointAtPc: true }) // into inner, and back out to pop {pc}
        expect(emulator.getCallStack().map((frame) => frame.name)).toEqual(['outer'])
        emulator.undo()
        expect(emulator.getCallStack().map((frame) => frame.name)).toEqual(['outer', 'inner'])
    })
})
