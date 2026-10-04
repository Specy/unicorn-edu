import { UC_ARM_REG } from './arm-register-ids'
import type { Architecture, FloatingPointRegister, InstructionDecoder } from './architecture'

export const UC_ARCH_ARM = 1
export const UC_MODE_ARM = 0
export const UC_MODE_THUMB = 16

/** The general registers, in the order the CPU Register file lists them. */
export const ARM_REGISTER_NAMES = [
    'r0',
    'r1',
    'r2',
    'r3',
    'r4',
    'r5',
    'r6',
    'r7',
    'r8',
    'r9',
    'r10',
    'r11',
    'r12',
    'sp',
    'lr',
    'pc',
] as const

export type ArmRegisterName = (typeof ARM_REGISTER_NAMES)[number]

export const ARM_REGISTER_IDS: Record<ArmRegisterName, number> = {
    r0: UC_ARM_REG.R0,
    r1: UC_ARM_REG.R1,
    r2: UC_ARM_REG.R2,
    r3: UC_ARM_REG.R3,
    r4: UC_ARM_REG.R4,
    r5: UC_ARM_REG.R5,
    r6: UC_ARM_REG.R6,
    r7: UC_ARM_REG.R7,
    r8: UC_ARM_REG.R8,
    r9: UC_ARM_REG.R9,
    r10: UC_ARM_REG.R10,
    r11: UC_ARM_REG.R11,
    r12: UC_ARM_REG.R12,
    sp: UC_ARM_REG.SP,
    lr: UC_ARM_REG.LR,
    pc: UC_ARM_REG.PC,
}

export const CPSR_THUMB = 1 << 5
export const CPSR_MODE_USER = 0x10

/** `d0`-`d31`, then `fpscr`: the VFP/NEON state the history saves (Q registers alias D pairs). */
export const ARM_FLOATING_POINT_REGISTERS: FloatingPointRegister[] = [
    ...Array.from({ length: 32 }, (_, i) => ({ name: `d${i}`, id: UC_ARM_REG.D0 + i, size: 8 })),
    { name: 'fpscr', id: UC_ARM_REG.FPSCR, size: 4 },
]

/** Encodings that read or write the VFP/NEON registers (ARMv7-A A32). */
export function isA32FloatingPoint(word: number): boolean {
    const cond = word >>> 28
    if (cond === 0xf) {
        // Advanced SIMD data processing, and element or structure loads and stores
        return ((word >>> 25) & 7) === 1 || (((word >>> 24) & 0xf) === 4 && ((word >>> 20) & 1) === 0)
    }
    // coprocessor space with coprocessor 10 or 11: VFP data processing, transfers, loads, stores
    const coprocessor = ((word >>> 24) & 0xf) === 0xe || ((word >>> 25) & 7) === 6
    return coprocessor && ((word >>> 9) & 7) === 5
}

/** The same for T32 (Thumb-2) 32-bit encodings, first and second halfword. */
export function isT32FloatingPoint(first: number, second: number): boolean {
    if ((first & 0xef00) === 0xef00) return true // Advanced SIMD data processing
    if ((first & 0xff10) === 0xf900) return true // Advanced SIMD element/structure load/store
    return (first & 0xec00) === 0xec00 && ((second >>> 9) & 7) === 5
}

export function isT32Wide(first: number): boolean {
    const top = first >>> 11
    return top === 0x1d || top === 0x1e || top === 0x1f
}

const decodeA32: InstructionDecoder = (view, offset) => ({
    size: 4,
    floatingPoint: offset + 4 <= view.byteLength && isA32FloatingPoint(view.getUint32(offset, true)),
})

const decodeT32: InstructionDecoder = (view, offset) => {
    const first = view.getUint16(offset, true)
    if (!isT32Wide(first) || offset + 4 > view.byteLength) return { size: 2, floatingPoint: false }
    return { size: 4, floatingPoint: isT32FloatingPoint(first, view.getUint16(offset + 2, true)) }
}

function armRegisterName(id: number): string {
    for (const [name, value] of Object.entries(ARM_REGISTER_IDS)) if (value === id) return name
    if (id === UC_ARM_REG.CPSR) return 'cpsr'
    if (id === UC_ARM_REG.FPSCR) return 'fpscr'
    if (id >= UC_ARM_REG.D0 && id <= UC_ARM_REG.D31) return `d${id - UC_ARM_REG.D0}`
    if (id >= UC_ARM_REG.S0 && id <= UC_ARM_REG.S31) return `s${id - UC_ARM_REG.S0}`
    if (id >= UC_ARM_REG.Q0 && id <= UC_ARM_REG.Q15) return `q${id - UC_ARM_REG.Q0}`
    return `reg${id}`
}

/**
 * 32-bit ARM: ARMv7-A, A32 and Thumb-2 with VFPv4 and NEON, the Cortex-A15 Unicorn models by
 * default. Programs run in user mode and talk to the host through Linux EABI system calls.
 */
export const ARM: Architecture<ArmRegisterName> = {
    name: 'arm',
    ucArch: UC_ARCH_ARM,
    ucMode: UC_MODE_ARM,
    bits: 32,
    loadMachine: async () => (await import('./wasm/machine-arm.mjs')).default(),
    assembler: {
        name: 'arm-as',
        load: async () => (await import('./wasm/arm-as.mjs')).default,
        wasm: () => new URL('./wasm/arm-as.wasm', import.meta.url),
    },
    linker: {
        name: 'arm-ld',
        load: async () => (await import('./wasm/arm-ld.mjs')).default,
        wasm: () => new URL('./wasm/arm-ld.wasm', import.meta.url),
    },
    assemblerFlags: ['-mcpu=cortex-a15', '-mfpu=neon-vfpv4', '-mfloat-abi=hard'],
    registerNames: ARM_REGISTER_NAMES,
    registerIds: ARM_REGISTER_IDS,
    coreSnapshot: [...ARM_REGISTER_NAMES, 'cpsr'],
    pcName: 'pc',
    flagsName: 'cpsr',
    pcId: UC_ARM_REG.PC,
    spId: UC_ARM_REG.SP,
    linkId: UC_ARM_REG.LR,
    flagsId: UC_ARM_REG.CPSR,
    floatingPoint: ARM_FLOATING_POINT_REGISTERS,
    systemCalls: {
        numberRegister: UC_ARM_REG.R7,
        argumentRegisters: [UC_ARM_REG.R0, UC_ARM_REG.R1, UC_ARM_REG.R2],
        exit: [1, 248],
        read: 3,
        write: 4,
        brk: 45,
        nanosleep: 162,
        clockGettime: 263,
        timespecFieldSize: 4,
    },
    // mov r7, #1; svc #0
    exitTrampoline: new Uint8Array([0x01, 0x70, 0xa0, 0xe3, 0x00, 0x00, 0x00, 0xef]),
    mappingStates: { a: decodeA32, t: decodeT32, d: null },
    defaultState: (entry) => ((entry & 1n) === 1n ? 't' : 'a'),
    breakpointInstructionSize: (flags) => (flags & BigInt(CPSR_THUMB) ? 2 : 4),
    // Unicorn takes the Thumb state from bit 0 of a PC write
    pcValue: (address, flags) => (flags & BigInt(CPSR_THUMB) ? address | 1n : address),
    registerName: armRegisterName,
    initialRegisters: (entry) => [
        // the mode first: sp and lr are banked, and the ones written next are the user-mode ones
        { id: UC_ARM_REG.CPSR, value: BigInt(CPSR_MODE_USER | ((entry & 1n) === 1n ? CPSR_THUMB : 0)) },
    ],
}
