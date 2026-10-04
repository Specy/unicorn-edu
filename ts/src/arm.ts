import { UC_ARM_REG } from './arm-register-ids'
import { PF_X, PT_LOAD, type ElfFile } from './elf'

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

/**
 * The registers the machine layer snapshots per instruction, in native/edu.c's ARM_CORE_IDS
 * order: r0-r12, sp, lr, pc, cpsr.
 */
export const ARM_CORE_SNAPSHOT_NAMES = [...ARM_REGISTER_NAMES, 'cpsr'] as const

/** CPSR's condition flags, most significant first, as the Status flags show them. */
export const ARM_FLAGS = [
    { name: 'N', bit: 31 },
    { name: 'Z', bit: 30 },
    { name: 'C', bit: 29 },
    { name: 'V', bit: 28 },
] as const

export const CPSR_THUMB = 1 << 5
export const CPSR_MODE_USER = 0x10

export const VFP_DOUBLE_NAMES = Array.from({ length: 32 }, (_, i) => `d${i}`)

/** A name for every register id a history record can carry. */
export function armRegisterName(id: number): string {
    for (const [name, value] of Object.entries(ARM_REGISTER_IDS)) if (value === id) return name
    if (id === UC_ARM_REG.CPSR) return 'cpsr'
    if (id === UC_ARM_REG.FPSCR) return 'fpscr'
    if (id >= UC_ARM_REG.D0 && id <= UC_ARM_REG.D31) return `d${id - UC_ARM_REG.D0}`
    if (id >= UC_ARM_REG.S0 && id <= UC_ARM_REG.S31) return `s${id - UC_ARM_REG.S0}`
    if (id >= UC_ARM_REG.Q0 && id <= UC_ARM_REG.Q15) return `q${id - UC_ARM_REG.Q0}`
    return `reg${id}`
}

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

export type FpMap = { base: bigint; halfwords: number; bits: Uint8Array }

/**
 * Marks every instruction in the executable segments that may change the floating-point
 * registers, so that the history saves them around those instructions only. The mapping
 * symbols the assembler leaves (`$a` ARM, `$t` Thumb, `$d` data) say how to decode each range;
 * data decoded as instructions only costs a needless save.
 */
export function buildFpMap(elf: ElfFile): FpMap | null {
    const code = elf.segments.filter((segment) => segment.type === PT_LOAD && segment.flags & PF_X)
    if (!code.length) return null
    const base = code.reduce((low, segment) => (segment.address < low ? segment.address : low), code[0]!.address)
    const end = code.reduce((high, segment) => {
        const segmentEnd = segment.address + BigInt(segment.memorySize)
        return segmentEnd > high ? segmentEnd : high
    }, base)
    const halfwords = Number((end - base + 1n) / 2n)
    const bits = new Uint8Array(Math.ceil(halfwords / 8))
    const mark = (address: bigint) => {
        const halfword = Number((address - base) / 2n)
        bits[halfword >> 3]! |= 1 << (halfword & 7)
    }

    const states = elf.symbols
        .filter((symbol) => /^\$[atd](\.|$)/.test(symbol.name))
        .map((symbol) => ({ address: symbol.value, state: symbol.name[1] as 'a' | 't' | 'd' }))
        .sort((left, right) => (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))

    for (const segment of code) {
        const bytes = elf.bytes.subarray(segment.offset, segment.offset + segment.fileSize)
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        let state: 'a' | 't' | 'd' = (elf.entry & 1n) === 1n ? 't' : 'a'
        let next = 0
        for (const marker of states) {
            if (marker.address > segment.address) break
            state = marker.state
            next++
        }
        let offset = 0
        while (offset < bytes.length) {
            const address = segment.address + BigInt(offset)
            while (next < states.length && states[next]!.address <= address) state = states[next++]!.state
            if (state === 'd') {
                offset += 2
                continue
            }
            if (state === 'a') {
                if (offset + 4 > bytes.length) break
                if (isA32FloatingPoint(view.getUint32(offset, true))) mark(address)
                offset += 4
                continue
            }
            if (offset + 2 > bytes.length) break
            const first = view.getUint16(offset, true)
            if (isT32Wide(first) && offset + 4 <= bytes.length) {
                if (isT32FloatingPoint(first, view.getUint16(offset + 2, true))) mark(address)
                offset += 4
            } else {
                offset += 2
            }
        }
    }
    return { base, halfwords, bits }
}
