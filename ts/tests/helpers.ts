import {
    AARCH64,
    ARM,
    createEmulator,
    type Architecture,
    type ArmProject,
    type EmulatorOptions,
    type UnicornEmulator,
} from '../src'

export type Loaded<R extends string> = {
    emulator: UnicornEmulator<R>
    stdout: () => string
}

type LoadOptions = EmulatorOptions & { undo?: number }

/** Builds and loads an ARM program, failing the test with the build report when it does not build. */
export function load(source: string | ArmProject, options: LoadOptions = {}) {
    return loadFor(ARM, source, options)
}

/** The same for AArch64. */
export function loadAarch64(source: string | ArmProject, options: LoadOptions = {}) {
    return loadFor(AARCH64, source, options)
}

async function loadFor<R extends string>(
    architecture: Architecture<R>,
    source: string | ArmProject,
    options: LoadOptions,
): Promise<Loaded<R>> {
    let stdout = ''
    const emulator = await createEmulator(architecture, {
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

export function readU32(emulator: UnicornEmulator, address: bigint): number {
    return new DataView(emulator.readMemoryBytes(address, 4).buffer).getUint32(0, true)
}

export function doubleFromBits(bits: bigint): number {
    return new Float64Array(new BigUint64Array([bits]).buffer)[0]!
}
