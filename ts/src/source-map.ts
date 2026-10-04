import type { LineRow } from './dwarf-line'

/** An instruction range and the source line that produced it. */
export type SourceEntry = {
    address: bigint
    /** Exclusive. */
    end: bigint
    path: string
    /** Zero-based. */
    line: number
}

/** Addresses to source lines and back, from the linked program's DWARF line table. */
export class SourceMap {
    private readonly entries: SourceEntry[]

    /**
     * `normalize` turns a path the assembler recorded into a Project path, or null for one that
     * is not part of the Project.
     */
    constructor(rows: LineRow[], normalize: (file: string) => string | null) {
        const entries: SourceEntry[] = []
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]!
            const next = rows[i + 1]
            if (row.endSequence || !next) continue
            if (next.address <= row.address) continue
            const path = normalize(row.file)
            if (path === null) continue
            entries.push({ address: row.address, end: next.address, path, line: row.line - 1 })
        }
        entries.sort((left, right) => (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))
        this.entries = entries
    }

    get size(): number {
        return this.entries.length
    }

    all(): readonly SourceEntry[] {
        return this.entries
    }

    locate(address: bigint): SourceEntry | null {
        let low = 0
        let high = this.entries.length - 1
        while (low <= high) {
            const middle = (low + high) >> 1
            const entry = this.entries[middle]!
            if (address < entry.address) high = middle - 1
            else if (address >= entry.end) low = middle + 1
            else return entry
        }
        return null
    }

    /**
     * Where execution enters a line: the first address of each run of consecutive instructions
     * the line produced. A breakpoint on a line that assembled to several instructions stops once,
     * before the first of them.
     */
    addressesForLine(path: string, line: number): bigint[] {
        const addresses: bigint[] = []
        let previous: SourceEntry | undefined
        for (const entry of this.entries) {
            const continues =
                previous !== undefined &&
                previous.end === entry.address &&
                previous.path === entry.path &&
                previous.line === entry.line
            if (entry.path === path && entry.line === line && !continues) addresses.push(entry.address)
            previous = entry
        }
        return addresses
    }
}
