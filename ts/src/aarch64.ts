import { UC_ARM64_REG } from './arm64-register-ids'
import type { Architecture, FloatingPointRegister, InstructionDecoder } from './architecture'

export const UC_ARCH_ARM64 = 2
export const UC_MODE_ARM64 = 0

/** The general registers, in the order the CPU Register file lists them (x29 is fp, x30 lr). */
export const AARCH64_REGISTER_NAMES = [
    ...(Array.from({ length: 31 }, (_, i) => `x${i}`) as `x${number}`[]),
    'sp',
    'pc',
] as const

export type Aarch64RegisterName = `x${number}` | 'sp' | 'pc'

function generalRegisterId(index: number): number {
    if (index === 29) return UC_ARM64_REG.X29
    if (index === 30) return UC_ARM64_REG.X30
    return UC_ARM64_REG.X0 + index
}

export const AARCH64_REGISTER_IDS: Record<Aarch64RegisterName, number> = Object.fromEntries([
    ...Array.from({ length: 31 }, (_, i) => [`x${i}`, generalRegisterId(i)]),
    ['sp', UC_ARM64_REG.SP],
    ['pc', UC_ARM64_REG.PC],
]) as Record<Aarch64RegisterName, number>

/** `v0`-`v31` (128 bits each), then `fpcr` and `fpsr`. */
export const AARCH64_FLOATING_POINT_REGISTERS: FloatingPointRegister[] = [
    ...Array.from({ length: 32 }, (_, i) => ({ name: `v${i}`, id: UC_ARM64_REG.V0 + i, size: 16 })),
    { name: 'fpcr', id: UC_ARM64_REG.FPCR, size: 4 },
    { name: 'fpsr', id: UC_ARM64_REG.FPSR, size: 4 },
]

/**
 * A64 encodings that read or write the floating-point and SIMD registers: the scalar FP and
 * Advanced SIMD data-processing class (op0 = x111), loads and stores of SIMD&FP registers (op0 =
 * x1x0 with the V bit), and `msr fpcr`/`msr fpsr`.
 */
export function isA64FloatingPoint(word: number): boolean {
    const op0 = (word >>> 25) & 0xf
    if ((op0 & 0b0111) === 0b0111) return true
    if ((op0 & 0b0101) === 0b0100 && ((word >>> 26) & 1) === 1) return true
    return (word & 0xffffffc0) === 0xd51b4400
}

const decodeA64: InstructionDecoder = (view, offset) => ({
    size: 4,
    floatingPoint: offset + 4 <= view.byteLength && isA64FloatingPoint(view.getUint32(offset, true)),
})

function aarch64RegisterName(id: number): string {
    for (const [name, value] of Object.entries(AARCH64_REGISTER_IDS)) if (value === id) return name
    const ranges: [number, number, string][] = [
        [UC_ARM64_REG.V0, UC_ARM64_REG.V31, 'v'],
        [UC_ARM64_REG.Q0, UC_ARM64_REG.Q31, 'q'],
        [UC_ARM64_REG.D0, UC_ARM64_REG.D31, 'd'],
        [UC_ARM64_REG.S0, UC_ARM64_REG.S31, 's'],
        [UC_ARM64_REG.H0, UC_ARM64_REG.H31, 'h'],
        [UC_ARM64_REG.B0, UC_ARM64_REG.B31, 'b'],
        [UC_ARM64_REG.W0, UC_ARM64_REG.W30, 'w'],
    ]
    for (const [first, last, prefix] of ranges) if (id >= first && id <= last) return `${prefix}${id - first}`
    if (id === UC_ARM64_REG.NZCV) return 'nzcv'
    if (id === UC_ARM64_REG.FPCR) return 'fpcr'
    if (id === UC_ARM64_REG.FPSR) return 'fpsr'
    return `reg${id}`
}

/**
 * AArch64: ARMv8-A A64 with FP and Advanced SIMD, the Cortex-A72 Unicorn models by default.
 * Programs talk to the host through Linux system calls (`svc #0`, number in x8).
 */
export const AARCH64: Architecture<Aarch64RegisterName> = {
    name: 'aarch64',
    ucArch: UC_ARCH_ARM64,
    ucMode: UC_MODE_ARM64,
    bits: 64,
    loadMachine: async () => (await import('./wasm/machine-aarch64.mjs')).default(),
    assembler: {
        name: 'aarch64-as',
        load: async () => (await import('./wasm/aarch64-as.mjs')).default,
        wasm: () => new URL('./wasm/aarch64-as.wasm', import.meta.url),
    },
    linker: {
        name: 'aarch64-ld',
        load: async () => (await import('./wasm/aarch64-ld.mjs')).default,
        wasm: () => new URL('./wasm/aarch64-ld.wasm', import.meta.url),
    },
    assemblerFlags: ['-march=armv8-a'],
    registerNames: AARCH64_REGISTER_NAMES,
    registerIds: AARCH64_REGISTER_IDS,
    coreSnapshot: [...AARCH64_REGISTER_NAMES, 'nzcv'],
    pcName: 'pc',
    flagsName: 'nzcv',
    pcId: UC_ARM64_REG.PC,
    spId: UC_ARM64_REG.SP,
    linkId: UC_ARM64_REG.X30,
    flagsId: UC_ARM64_REG.NZCV,
    floatingPoint: AARCH64_FLOATING_POINT_REGISTERS,
    systemCalls: {
        numberRegister: UC_ARM64_REG.X8,
        argumentRegisters: [UC_ARM64_REG.X0, UC_ARM64_REG.X1, UC_ARM64_REG.X2],
        exit: [93, 94],
        read: 63,
        write: 64,
        brk: 214,
        nanosleep: 101,
        clockGettime: 113,
        timespecFieldSize: 8,
    },
    // mov x8, #93; svc #0
    exitTrampoline: new Uint8Array([0xa8, 0x0b, 0x80, 0xd2, 0x01, 0x00, 0x00, 0xd4]),
    mappingStates: { x: decodeA64, d: null },
    defaultState: () => 'x',
    breakpointInstructionSize: () => 4,
    pcValue: (address) => address,
    registerName: aarch64RegisterName,
    initialRegisters: () => [],
}
