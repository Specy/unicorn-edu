import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { doubleFromBits, load } from './helpers'

/**
 * Compiler Explorer's ARM GCC 14.2 (`carmug1420`) output for fixtures/gcc-sample.c, with the
 * editor's Source compilation flags plus `-mcpu=cortex-a15 -mfloat-abi=hard -mfpu=vfpv4 -marm`,
 * unedited: sections, a switch table, recursion and double arithmetic. The native build of the
 * same C returns 1698.
 */
const START = '    .text\n    .global _start\n_start:\n    bl __asm_editor_main\n    mov r7, #1\n    svc #0\n'

describe('compiler output', () => {
    for (const level of ['O0', 'O2']) {
        it(`runs GCC 14.2 -${level} output unedited`, async () => {
            const generated = readFileSync(new URL(`./fixtures/gcc-14.2-arm-${level}.s`, import.meta.url), 'utf8')
            const { emulator } = await load({
                entry: 'start.s',
                files: { 'start.s': START, 'example.s': generated },
            })
            expect(await emulator.run(1_000_000)).toMatchObject({ kind: 'exit', exitCode: 1698 })
        })
    }
})

describe('long translation blocks', () => {
    // Before patches/0003, a block this long under the per-instruction hook, or this many VFP
    // helper calls in one block, overran QEMU's TCG temporaries and crashed the module.
    const SOURCE = `
    .global _start
_start:
    vmov.f64 d1, #1.0
    .rept 300
    add r0, r0, #1
    .endr
    .rept 512
    vadd.f64 d0, d0, d1
    .endr
    mov r7, #1
    svc #0
`

    for (const undo of [1000, 0]) {
        it(`runs them ${undo ? 'with' : 'without'} history`, async () => {
            const { emulator } = await load(SOURCE, { undo })
            expect(await emulator.run(10_000)).toMatchObject({ kind: 'exit', exitCode: 300 })
            expect(doubleFromBits(emulator.getFloatingPointRegisterValues()[0]!)).toBe(512)
        })
    }

    it('undoes through them', async () => {
        const { emulator } = await load(SOURCE, { undo: 1000 })
        await emulator.run(10_000)
        for (let i = 0; i < 2 + 512; i++) expect(emulator.undo()).toBe(true)
        expect(emulator.getFloatingPointRegisterValues()[0]!).toBe(0n)
        expect(emulator.getRegisterValue('r0')).toBe(300n)
    })
})
