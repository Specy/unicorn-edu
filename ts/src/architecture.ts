import type { ElfFile } from './elf'
import { PF_X, PT_LOAD } from './elf'
import type { MachineModule } from './wasm/machine-arm.mjs'
import type { ToolModuleFactory } from './wasm/tool-module'

/** A tool of the toolchain: its Emscripten module, loaded on first use, and its .wasm. */
export type ToolSpec = {
    /** Also the base name of its files under wasm/. */
    name: string
    load: () => Promise<ToolModuleFactory>
    /** A literal `new URL(..., import.meta.url)`, the form bundlers copy the asset for. */
    wasm: () => URL
}

export type FloatingPointRegister = {
    name: string
    id: number
    /** Bytes. */
    size: number
}

/** The Linux system calls the emulator answers, by number, and how arguments travel. */
export type SystemCallTable = {
    numberRegister: number
    /** First, second and third argument; the first also carries the result. */
    argumentRegisters: readonly [number, number, number]
    exit: readonly number[]
    read: number
    write: number
    brk: number
    nanosleep: number
    clockGettime: number
    /** `struct timespec`: two 32-bit fields on ARM, two 64-bit fields on AArch64. */
    timespecFieldSize: 4 | 8
}

/** How to read one instruction-set state of a code range, for the floating-point map. */
export type InstructionDecoder = (view: DataView, offset: number) => { size: number; floatingPoint: boolean }

/**
 * Everything the emulator does differently per architecture. `R` is the union of the general
 * register names.
 */
export type Architecture<R extends string = string> = {
    name: 'arm' | 'aarch64'
    ucArch: number
    ucMode: number
    /** Width of an address and of a general register. */
    bits: 32 | 64
    loadMachine: () => Promise<MachineModule>
    assembler: ToolSpec
    linker: ToolSpec
    assemblerFlags: readonly string[]
    /** The general registers, in the order the CPU Register file lists them. */
    registerNames: readonly R[]
    registerIds: Readonly<Record<R, number>>
    /** The registers native/edu.c snapshots per instruction, in its order. */
    coreSnapshot: readonly string[]
    /** Which snapshot entry is the program counter, and which holds the condition flags. */
    pcName: string
    flagsName: string
    pcId: number
    spId: number
    linkId: number
    flagsId: number
    floatingPoint: readonly FloatingPointRegister[]
    systemCalls: SystemCallTable
    /** Code that calls exit with the result register: where returning from the entry point goes. */
    exitTrampoline: Uint8Array
    /**
     * Mapping symbols (`$a`, `$t`, `$x`, `$d`) by their letter: how to decode code of that state,
     * or null for data.
     */
    mappingStates: Readonly<Record<string, InstructionDecoder | null>>
    /** The state of code before any mapping symbol, given the entry address. */
    defaultState: (entry: bigint) => string
    /** Bytes from a breakpoint instruction (`bkpt`, `brk`) to the one after it. */
    breakpointInstructionSize: (flags: bigint) => number
    /** The PC to write so that execution resumes at `address` in the current state. */
    pcValue: (address: bigint, flags: bigint) => bigint
    /** Name of any register id a history record can carry. */
    registerName: (id: number) => string
    /** Registers a freshly loaded program starts with, besides sp, the link register and pc. */
    initialRegisters: (entry: bigint) => { id: number; value: bigint }[]
}

export type FpMap = { base: bigint; halfwords: number; bits: Uint8Array }

type Marker = { address: bigint; state: string }

function mappingMarkers(elf: ElfFile, architecture: Architecture): Marker[] {
    return elf.symbols
        .filter((symbol) => /^\$[a-z](\.|$)/.test(symbol.name) && symbol.name[1]! in architecture.mappingStates)
        .map((symbol) => ({ address: symbol.value, state: symbol.name[1]! }))
        .sort((left, right) => (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))
}

/**
 * Marks every instruction in the executable segments that may change the floating-point
 * registers, so that the history saves them around those instructions only. The mapping symbols
 * say how to decode each range; data decoded as instructions only costs a needless save.
 */
export function buildFpMap(elf: ElfFile, architecture: Architecture): FpMap | null {
    const code = elf.segments.filter((segment) => segment.type === PT_LOAD && segment.flags & PF_X)
    if (!code.length) return null
    const base = code.reduce((low, segment) => (segment.address < low ? segment.address : low), code[0]!.address)
    const end = code.reduce((high, segment) => {
        const segmentEnd = segment.address + BigInt(segment.memorySize)
        return segmentEnd > high ? segmentEnd : high
    }, base)
    const halfwords = Number((end - base + 1n) / 2n)
    const bits = new Uint8Array(Math.ceil(halfwords / 8))
    const markers = mappingMarkers(elf, architecture)

    for (const segment of code) {
        const bytes = elf.bytes.subarray(segment.offset, segment.offset + segment.fileSize)
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        let state = architecture.defaultState(elf.entry)
        let next = 0
        while (next < markers.length && markers[next]!.address <= segment.address) state = markers[next++]!.state
        let offset = 0
        while (offset < bytes.length) {
            const address = segment.address + BigInt(offset)
            while (next < markers.length && markers[next]!.address <= address) state = markers[next++]!.state
            const decode = architecture.mappingStates[state]
            if (!decode) {
                offset += 2
                continue
            }
            const { size, floatingPoint } = decode(view, offset)
            if (offset + size > bytes.length) break
            if (floatingPoint) {
                const halfword = Number((address - base) / 2n)
                bits[halfword >> 3]! |= 1 << (halfword & 7)
            }
            offset += size
        }
    }
    return { base, halfwords, bits }
}

/**
 * Where the last run of instructions in `.text` ends: at the data (a literal pool) that follows
 * it, or at the end of the section. The mapping symbols say which ranges are code and which are
 * data, so this holds for code that has no line information too.
 */
export function findCodeEnd(elf: ElfFile, architecture: Architecture): bigint | null {
    const text = elf.sections.find((section) => section.name === '.text')
    if (!text || !text.size) return null
    const end = text.address + BigInt(text.size)
    const markers = mappingMarkers(elf, architecture).filter(
        (marker) => marker.address >= text.address && marker.address < end,
    )
    let lastCode = -1
    markers.forEach((marker, index) => {
        if (architecture.mappingStates[marker.state]) lastCode = index
    })
    if (lastCode < 0) return end
    const data = markers.slice(lastCode + 1).find((marker) => !architecture.mappingStates[marker.state])
    return data ? data.address : end
}
