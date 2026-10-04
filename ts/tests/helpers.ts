import { createArmEmulator, type ArmEmulator, type ArmEmulatorOptions, type ArmProject } from '../src'

export type Loaded = {
    emulator: ArmEmulator
    stdout: () => string
}

/** Builds and loads a program, failing the test with the build report when it does not build. */
export async function load(
    source: string | ArmProject,
    options: ArmEmulatorOptions & { undo?: number } = {},
): Promise<Loaded> {
    let stdout = ''
    const emulator = await createArmEmulator({
        ...options,
        stdout: (text) => {
            stdout += text
            options.stdout?.(text)
        },
    })
    const result = typeof source === 'string' ? await emulator.compile(source) : await emulator.compileProject(source)
    if (!result.ok) throw new Error(`build failed:\n${result.report}`)
    emulator.initialize(options.undo ?? 1000)
    return { emulator, stdout: () => stdout }
}

/** Zero-based line of the first line containing `needle`. */
export function lineOf(source: string, needle: string): number {
    const index = source.split('\n').findIndex((line) => line.includes(needle))
    if (index < 0) throw new Error(`no line contains ${needle}`)
    return index
}

export function readU32(emulator: ArmEmulator, address: bigint): number {
    return new DataView(emulator.readMemoryBytes(address, 4).buffer).getUint32(0, true)
}

export function doubleFromBits(bits: bigint): number {
    return new Float64Array(new BigUint64Array([bits]).buffer)[0]!
}
