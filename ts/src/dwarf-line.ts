/**
 * A reader for `.debug_line`, DWARF versions 2 to 5: the table that says which source line each
 * instruction address came from. GNU as writes one row per instruction when it assembles with `-g`.
 */

export type LineRow = {
    address: bigint
    /** File path as the assembler recorded it, joined with its directory when that was relative. */
    file: string
    /** One-based, as DWARF counts. */
    line: number
    /** First row after the last instruction of a contiguous sequence. */
    endSequence: boolean
}

const DW_LNS_copy = 1
const DW_LNS_advance_pc = 2
const DW_LNS_advance_line = 3
const DW_LNS_set_file = 4
const DW_LNS_set_column = 5
const DW_LNS_negate_stmt = 6
const DW_LNS_set_basic_block = 7
const DW_LNS_const_add_pc = 8
const DW_LNS_fixed_advance_pc = 9
const DW_LNS_set_prologue_end = 10
const DW_LNS_set_epilogue_begin = 11
const DW_LNS_set_isa = 12

const DW_LNE_end_sequence = 1
const DW_LNE_set_address = 2
const DW_LNE_define_file = 3

const DW_LNCT_path = 1
const DW_LNCT_directory_index = 2

const DW_FORM_block = 0x09
const DW_FORM_block1 = 0x0a
const DW_FORM_block2 = 0x03
const DW_FORM_block4 = 0x04
const DW_FORM_data1 = 0x0b
const DW_FORM_data2 = 0x05
const DW_FORM_data4 = 0x06
const DW_FORM_data8 = 0x07
const DW_FORM_data16 = 0x1e
const DW_FORM_string = 0x08
const DW_FORM_strp = 0x0e
const DW_FORM_line_strp = 0x1f
const DW_FORM_udata = 0x0f
const DW_FORM_sdata = 0x0d

class Reader {
    offset: number
    constructor(
        readonly view: DataView,
        offset: number,
    ) {
        this.offset = offset
    }
    u8(): number {
        return this.view.getUint8(this.offset++)
    }
    i8(): number {
        return this.view.getInt8(this.offset++)
    }
    u16(): number {
        const value = this.view.getUint16(this.offset, true)
        this.offset += 2
        return value
    }
    u32(): number {
        const value = this.view.getUint32(this.offset, true)
        this.offset += 4
        return value
    }
    u64(): bigint {
        const value = this.view.getBigUint64(this.offset, true)
        this.offset += 8
        return value
    }
    uleb(): bigint {
        let result = 0n
        let shift = 0n
        for (;;) {
            const byte = this.u8()
            result |= BigInt(byte & 0x7f) << shift
            shift += 7n
            if (!(byte & 0x80)) return result
        }
    }
    sleb(): bigint {
        let result = 0n
        let shift = 0n
        let byte: number
        do {
            byte = this.u8()
            result |= BigInt(byte & 0x7f) << shift
            shift += 7n
        } while (byte & 0x80)
        if (byte & 0x40) result -= 1n << shift
        return result
    }
    cstring(): string {
        const start = this.offset
        while (this.view.getUint8(this.offset) !== 0) this.offset++
        const text = decodeUtf8(this.view, start, this.offset)
        this.offset++
        return text
    }
    address(size: number): bigint {
        if (size === 8) return this.u64()
        if (size === 4) return BigInt(this.u32())
        if (size === 2) return BigInt(this.u16())
        return BigInt(this.u8())
    }
}

function decodeUtf8(view: DataView, start: number, end: number): string {
    return new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + start, end - start))
}

function stringAt(section: Uint8Array | null, offset: number): string {
    if (!section) return ''
    let end = offset
    while (end < section.length && section[end] !== 0) end++
    return new TextDecoder().decode(section.subarray(offset, end))
}

function joinPath(directory: string, file: string): string {
    if (!directory || file.startsWith('/')) return file
    return directory.endsWith('/') ? directory + file : `${directory}/${file}`
}

/**
 * Every row of every line program in `debugLine`. `lineStrings` and `strings` are the
 * `.debug_line_str` and `.debug_str` sections, which DWARF 5 file tables refer into.
 */
export function readLineTable(
    debugLine: Uint8Array,
    addressSize: number,
    lineStrings: Uint8Array | null = null,
    strings: Uint8Array | null = null,
): LineRow[] {
    const view = new DataView(debugLine.buffer, debugLine.byteOffset, debugLine.byteLength)
    const rows: LineRow[] = []
    let unitStart = 0
    while (unitStart + 4 <= debugLine.length) {
        const reader = new Reader(view, unitStart)
        let unitLength = reader.u32()
        let offsetSize = 4
        if (unitLength === 0xffffffff) {
            unitLength = Number(reader.u64())
            offsetSize = 8
        }
        if (unitLength === 0) break
        const unitEnd = reader.offset + unitLength
        if (unitEnd > debugLine.length) break
        const version = reader.u16()
        if (version < 2 || version > 5) {
            unitStart = unitEnd
            continue
        }
        let unitAddressSize = addressSize
        if (version >= 5) {
            unitAddressSize = reader.u8()
            reader.u8() // segment selector size
        }
        const headerLength = offsetSize === 8 ? Number(reader.u64()) : reader.u32()
        const programStart = reader.offset + headerLength
        const minimumInstructionLength = reader.u8()
        if (version >= 4) reader.u8() // maximum operations per instruction
        const defaultIsStmt = reader.u8() !== 0
        const lineBase = reader.i8()
        const lineRange = reader.u8()
        const opcodeBase = reader.u8()
        const opcodeLengths = [0]
        for (let i = 1; i < opcodeBase; i++) opcodeLengths.push(reader.u8())

        const directories: string[] = []
        const files: string[] = []
        const readForm = (form: number): { text?: string; number?: bigint } => {
            switch (form) {
                case DW_FORM_string:
                    return { text: reader.cstring() }
                case DW_FORM_line_strp:
                    return { text: stringAt(lineStrings, offsetSize === 8 ? Number(reader.u64()) : reader.u32()) }
                case DW_FORM_strp:
                    return { text: stringAt(strings, offsetSize === 8 ? Number(reader.u64()) : reader.u32()) }
                case DW_FORM_udata:
                    return { number: reader.uleb() }
                case DW_FORM_sdata:
                    return { number: reader.sleb() }
                case DW_FORM_data1:
                    return { number: BigInt(reader.u8()) }
                case DW_FORM_data2:
                    return { number: BigInt(reader.u16()) }
                case DW_FORM_data4:
                    return { number: BigInt(reader.u32()) }
                case DW_FORM_data8:
                    return { number: reader.u64() }
                case DW_FORM_data16:
                    reader.offset += 16
                    return {}
                case DW_FORM_block:
                    reader.offset += Number(reader.uleb())
                    return {}
                case DW_FORM_block1:
                    reader.offset += reader.u8()
                    return {}
                case DW_FORM_block2:
                    reader.offset += reader.u16()
                    return {}
                case DW_FORM_block4:
                    reader.offset += reader.u32()
                    return {}
                default:
                    throw new Error(`unsupported DWARF form 0x${form.toString(16)} in .debug_line`)
            }
        }

        if (version >= 5) {
            const readEntries = (): { path: string; directory: number }[] => {
                const formatCount = reader.u8()
                const format: [number, number][] = []
                for (let i = 0; i < formatCount; i++) format.push([Number(reader.uleb()), Number(reader.uleb())])
                const count = Number(reader.uleb())
                const entries: { path: string; directory: number }[] = []
                for (let i = 0; i < count; i++) {
                    let path = ''
                    let directory = 0
                    for (const [content, form] of format) {
                        const value = readForm(form)
                        if (content === DW_LNCT_path) path = value.text ?? ''
                        else if (content === DW_LNCT_directory_index) directory = Number(value.number ?? 0n)
                    }
                    entries.push({ path, directory })
                }
                return entries
            }
            for (const entry of readEntries()) directories.push(entry.path)
            for (const entry of readEntries()) {
                // the first directory is the compilation directory, which relative paths are relative to
                const directory = entry.directory === 0 ? '' : (directories[entry.directory] ?? '')
                files.push(joinPath(directory, entry.path))
            }
        } else {
            directories.push('')
            for (let name = reader.cstring(); name; name = reader.cstring()) directories.push(name)
            files.push('') // DWARF 2-4 number files from 1
            for (let name = reader.cstring(); name; name = reader.cstring()) {
                const directory = Number(reader.uleb())
                reader.uleb() // modification time
                reader.uleb() // length
                files.push(joinPath(directories[directory] ?? '', name))
            }
        }

        reader.offset = programStart
        let address = 0n
        let file = version >= 5 ? 0 : 1
        let line = 1
        let isStmt = defaultIsStmt
        const emit = (endSequence: boolean) => {
            if (isStmt || endSequence) rows.push({ address, file: files[file] ?? '', line, endSequence })
        }
        const reset = () => {
            address = 0n
            file = version >= 5 ? 0 : 1
            line = 1
            isStmt = defaultIsStmt
        }
        while (reader.offset < unitEnd) {
            const opcode = reader.u8()
            if (opcode >= opcodeBase) {
                const adjusted = opcode - opcodeBase
                address += BigInt(Math.floor(adjusted / lineRange) * minimumInstructionLength)
                line += lineBase + (adjusted % lineRange)
                emit(false)
                continue
            }
            switch (opcode) {
                case 0: {
                    const length = Number(reader.uleb())
                    const end = reader.offset + length
                    const extended = reader.u8()
                    if (extended === DW_LNE_end_sequence) {
                        emit(true)
                        reset()
                    } else if (extended === DW_LNE_set_address) {
                        address = reader.address(length - 1 || unitAddressSize)
                    } else if (extended === DW_LNE_define_file) {
                        const name = reader.cstring()
                        const directory = Number(reader.uleb())
                        files.push(joinPath(directories[directory] ?? '', name))
                    }
                    reader.offset = end
                    break
                }
                case DW_LNS_copy:
                    emit(false)
                    break
                case DW_LNS_advance_pc:
                    address += reader.uleb() * BigInt(minimumInstructionLength)
                    break
                case DW_LNS_advance_line:
                    line += Number(reader.sleb())
                    break
                case DW_LNS_set_file:
                    file = Number(reader.uleb())
                    break
                case DW_LNS_set_column:
                    reader.uleb()
                    break
                case DW_LNS_negate_stmt:
                    isStmt = !isStmt
                    break
                case DW_LNS_set_basic_block:
                case DW_LNS_set_prologue_end:
                case DW_LNS_set_epilogue_begin:
                    break
                case DW_LNS_const_add_pc:
                    address += BigInt(Math.floor((255 - opcodeBase) / lineRange) * minimumInstructionLength)
                    break
                case DW_LNS_fixed_advance_pc:
                    address += BigInt(reader.u16())
                    break
                case DW_LNS_set_isa:
                    reader.uleb()
                    break
                default:
                    for (let i = 0; i < (opcodeLengths[opcode] ?? 0); i++) reader.uleb()
            }
        }
        unitStart = unitEnd
    }
    return rows
}
