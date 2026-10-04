import { describe, expect, it } from 'vitest'
import { createArmEmulator, translationUnits } from '../src'

describe('building', () => {
    it('reports assembler errors on their lines, with the span they name', async () => {
        const emulator = await createArmEmulator()
        const source = ['    .global _start', '_start:', '    mov r0, #1', '    foo r3, r4', '    mov r0, #0x12345', ''].join(
            '\n',
        )
        const result = await emulator.compile(source)
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors.map((error) => [error.lineIndex, error.severity, error.source])).toEqual([
            [3, 'error', 'as'],
            [4, 'error', 'as'],
        ])
        const bad = result.errors[0]!
        expect(bad.message).toContain('bad instruction')
        expect(bad.file).toBe('main.s')
        // the span covers `foo`, the name the message quotes
        expect(source.split('\n')[3]!.slice(bad.column - 1, bad.endColumn! - 1)).toBe('foo')
    })

    it('reports warnings without failing the build', async () => {
        const emulator = await createArmEmulator()
        const result = await emulator.compile('    .global _start\n_start:\n    str r0, [r0], r0\n    b _start\n')
        expect(result.ok).toBe(true)
        expect(result.diagnostics.map((diagnostic) => [diagnostic.lineIndex, diagnostic.severity])).toEqual([
            [2, 'warning'],
        ])
    })

    it('reports link errors on the line that caused them', async () => {
        const emulator = await createArmEmulator()
        const result = await emulator.compile('    .global _start\n_start:\n    mov r0, #1\n    bl nowhere\n')
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toMatchObject({ lineIndex: 3, source: 'ld', file: 'main.s' })
        expect(result.errors[0]!.message).toContain("undefined reference to `nowhere'")
    })

    it('asks for an entry point when there is neither _start nor main', async () => {
        const emulator = await createArmEmulator()
        const result = await emulator.compile('start:\n    b start\n')
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.errors[0]!.message).toContain('no entry point')
    })

    it('links every assembly File that nothing includes, and assembles included ones in place', async () => {
        const project = {
            entry: 'src/main.s',
            files: {
                'src/main.s': '    .include "macros.s"\n    .global _start\n_start:\n    exit_with 7\n',
                'src/macros.s': '    .macro exit_with code\n    mov r0, #\\code\n    bl finish\n    .endm\n',
                'lib/finish.s': '    .global finish\nfinish:\n    mov r7, #1\n    svc #0\n',
            },
        }
        expect(translationUnits(project)).toEqual(['src/main.s', 'lib/finish.s'])
        const emulator = await createArmEmulator()
        const result = await emulator.compileProject(project)
        expect(result.ok).toBe(true)
        emulator.initialize(100)
        const run = await emulator.run(1000)
        expect(run).toMatchObject({ kind: 'exit', exitCode: 7 })
    })

    it('maps each instruction back to the File and line that produced it', async () => {
        const project = {
            entry: 'main.s',
            files: {
                'main.s': '    .global _start\n_start:\n    mov r0, #1\n    bl helper\n    mov r7, #1\n    svc #0\n',
                'parts/helper.s': '    .global helper\nhelper:\n    add r0, r0, #41\n    bx lr\n',
            },
        }
        const emulator = await createArmEmulator()
        expect((await emulator.compileProject(project)).ok).toBe(true)
        emulator.initialize(100)
        const instructions = emulator.getCompiledInstructions()
        expect(instructions.map((instruction) => [instruction.file, instruction.lineNumber, instruction.code])).toEqual([
            ['main.s', 2, 'mov r0, #1'],
            ['main.s', 3, 'bl helper'],
            ['main.s', 4, 'mov r7, #1'],
            ['main.s', 5, 'svc #0'],
            ['parts/helper.s', 2, 'add r0, r0, #41'],
            ['parts/helper.s', 3, 'bx lr'],
        ])
        expect(instructions[0]!.address).toBe(0x10000n)
        expect(instructions.every((instruction) => instruction.size === 4 && instruction.bytes?.length === 4)).toBe(true)
        expect(await emulator.run(100)).toMatchObject({ kind: 'exit', exitCode: 42 })
    })
})
