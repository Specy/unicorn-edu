/** The parts of an ELF executable the loader and the debugger read. Little endian, 32 or 64 bit. */

export const PT_LOAD = 1
export const PF_X = 1
export const PF_W = 2
export const PF_R = 4
export const STT_FUNC = 2
export const STT_OBJECT = 1
export const STT_NOTYPE = 0
export const SHN_UNDEF = 0

export type ElfSegment = {
    type: number
    flags: number
    offset: number
    address: bigint
    fileSize: number
    memorySize: number
}

export type ElfSection = {
    name: string
    type: number
    flags: number
    address: bigint
    offset: number
    size: number
}

export type ElfSymbol = {
    name: string
    value: bigint
    size: number
    type: number
    binding: number
    section: number
}

export type ElfFile = {
    bits: 32 | 64
    machine: number
    entry: bigint
    segments: ElfSegment[]
    sections: ElfSection[]
    symbols: ElfSymbol[]
    bytes: Uint8Array
}

export class ElfError extends Error {}

export function parseElf(bytes: Uint8Array): ElfFile {
    if (bytes.length < 52 || bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[2] !== 0x4c || bytes[3] !== 0x46) {
        throw new ElfError('not an ELF file')
    }
    if (bytes[5] !== 1) throw new ElfError('only little-endian ELF files are supported')
    const bits = bytes[4] === 2 ? 64 : bytes[4] === 1 ? 32 : 0
    if (!bits) throw new ElfError('unknown ELF class')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const wide = bits === 64
    const address = (offset: number): bigint =>
        wide ? view.getBigUint64(offset, true) : BigInt(view.getUint32(offset, true))
    const offsetAt = (offset: number): number => Number(address(offset))

    const machine = view.getUint16(18, true)
    const entry = address(24)
    const programHeaders = offsetAt(wide ? 32 : 28)
    const sectionHeaders = offsetAt(wide ? 40 : 32)
    const programHeaderSize = view.getUint16(wide ? 54 : 42, true)
    const programHeaderCount = view.getUint16(wide ? 56 : 44, true)
    const sectionHeaderSize = view.getUint16(wide ? 58 : 46, true)
    const sectionHeaderCount = view.getUint16(wide ? 60 : 48, true)
    const sectionNameIndex = view.getUint16(wide ? 62 : 50, true)

    const segments: ElfSegment[] = []
    for (let i = 0; i < programHeaderCount; i++) {
        const at = programHeaders + i * programHeaderSize
        if (at + programHeaderSize > bytes.length) break
        segments.push(
            wide
                ? {
                      type: view.getUint32(at, true),
                      flags: view.getUint32(at + 4, true),
                      offset: offsetAt(at + 8),
                      address: address(at + 16),
                      fileSize: offsetAt(at + 32),
                      memorySize: offsetAt(at + 40),
                  }
                : {
                      type: view.getUint32(at, true),
                      offset: view.getUint32(at + 4, true),
                      address: address(at + 8),
                      fileSize: view.getUint32(at + 16, true),
                      memorySize: view.getUint32(at + 20, true),
                      flags: view.getUint32(at + 24, true),
                  },
        )
    }

    type RawSection = ElfSection & { nameOffset: number; link: number; entrySize: number }
    const raw: RawSection[] = []
    for (let i = 0; i < sectionHeaderCount; i++) {
        const at = sectionHeaders + i * sectionHeaderSize
        if (at + sectionHeaderSize > bytes.length) break
        raw.push(
            wide
                ? {
                      name: '',
                      nameOffset: view.getUint32(at, true),
                      type: view.getUint32(at + 4, true),
                      flags: Number(view.getBigUint64(at + 8, true)),
                      address: address(at + 16),
                      offset: offsetAt(at + 24),
                      size: offsetAt(at + 32),
                      link: view.getUint32(at + 40, true),
                      entrySize: offsetAt(at + 56),
                  }
                : {
                      name: '',
                      nameOffset: view.getUint32(at, true),
                      type: view.getUint32(at + 4, true),
                      flags: view.getUint32(at + 8, true),
                      address: address(at + 12),
                      offset: view.getUint32(at + 16, true),
                      size: view.getUint32(at + 20, true),
                      link: view.getUint32(at + 24, true),
                      entrySize: view.getUint32(at + 36, true),
                  },
        )
    }
    const names = raw[sectionNameIndex]
    for (const section of raw) {
        section.name = names ? readString(bytes, names.offset + section.nameOffset) : ''
    }

    const symbols: ElfSymbol[] = []
    const SHT_SYMTAB = 2
    for (const table of raw.filter((section) => section.type === SHT_SYMTAB)) {
        const strings = raw[table.link]
        const size = table.entrySize || (wide ? 24 : 16)
        for (let at = table.offset; at + size <= table.offset + table.size; at += size) {
            const nameOffset = view.getUint32(at, true)
            const info = wide ? bytes[at + 4]! : bytes[at + 12]!
            symbols.push({
                name: strings ? readString(bytes, strings.offset + nameOffset) : '',
                value: wide ? view.getBigUint64(at + 8, true) : BigInt(view.getUint32(at + 4, true)),
                size: wide ? Number(view.getBigUint64(at + 16, true)) : view.getUint32(at + 8, true),
                type: info & 0xf,
                binding: info >> 4,
                section: view.getUint16(wide ? at + 6 : at + 14, true),
            })
        }
    }

    return {
        bits,
        machine,
        entry,
        segments,
        sections: raw.map(({ name, type, flags, address, offset, size }) => ({
            name,
            type,
            flags,
            address,
            offset,
            size,
        })),
        symbols,
        bytes,
    }
}

export function sectionBytes(elf: ElfFile, name: string): Uint8Array | null {
    const section = elf.sections.find((candidate) => candidate.name === name)
    if (!section || section.type === 8 /* SHT_NOBITS */) return null
    return elf.bytes.subarray(section.offset, section.offset + section.size)
}

function readString(bytes: Uint8Array, offset: number): string {
    let end = offset
    while (end < bytes.length && bytes[end] !== 0) end++
    return new TextDecoder().decode(bytes.subarray(offset, end))
}
