import createMachineModule, { type MachineModule } from './wasm/machine-arm.mjs'

export type { MachineModule }

/** Why the last `Machine.run` returned; native/edu.h's `edu_stop_reason`. */
export enum StopReason {
    None = 0,
    Budget = 1,
    Breakpoint = 2,
    Interrupt = 3,
    Error = 4,
    Halt = 5,
}

export const UC_PROT_READ = 1
export const UC_PROT_WRITE = 2
export const UC_PROT_EXEC = 4

/** ARM's exception numbers as Unicorn reports them to the interrupt hook. */
export const ARM_EXCEPTION_UNDEFINED = 1
export const ARM_EXCEPTION_SVC = 2
export const ARM_EXCEPTION_BKPT = 7

export type RawRegisterRecord = { id: number; size: number; old: Uint8Array; new: Uint8Array }
export type RawMemoryRecord = { address: bigint; old: Uint8Array; new: Uint8Array }
export type RawFrame = { target: bigint; returnAddress: bigint; sp: bigint; callSite: bigint }
export type RawEntry = {
    kind: 'instruction' | 'poke'
    frameOp: 'none' | 'push' | 'pop'
    irreversible: boolean
    size: number
    pc: bigint
    /** The core registers before the entry, in the layer's snapshot order. */
    core: bigint[]
    frame?: RawFrame
    registers: RawRegisterRecord[]
    memory: RawMemoryRecord[]
}
export type RawHistory = {
    /** The core registers now, which the newest entry's changes are measured against. */
    current: bigint[]
    /** Newest first. */
    entries: RawEntry[]
}

let modulePromise: Promise<MachineModule> | undefined

/** The machine module, instantiated once and shared by every Machine. */
export function loadMachineModule(): Promise<MachineModule> {
    modulePromise ??= createMachineModule()
    return modulePromise
}

export class MachineError extends Error {
    constructor(
        message: string,
        readonly code: number,
    ) {
        super(message)
    }
}

/**
 * One emulated CPU and its memory: a thin, typed wrapper over native/edu.c. It knows nothing about
 * programs, sources or system calls; ArmEmulator does.
 */
export class Machine {
    private scratch = 0
    private scratchSize = 0
    private disposed = false

    private constructor(
        private readonly module: MachineModule,
        private readonly rawHandle: number,
    ) {}

    /** The C machine; a destroyed one throws instead of touching freed memory. */
    private get handle(): number {
        if (this.disposed) throw new MachineError('the machine was destroyed', -1)
        return this.rawHandle
    }

    get isDestroyed(): boolean {
        return this.disposed
    }

    /** Synchronous once the module is loaded (`loadMachineModule`). */
    static create(module: MachineModule, arch: number, mode: number, cpuModel = -1): Machine {
        const handle = module._edu_create(arch, mode, cpuModel)
        if (!handle) {
            const code = module._edu_last_create_error()
            throw new MachineError(`cannot create the machine: ${module.UTF8ToString(module._edu_strerror(code))}`, code)
        }
        return new Machine(module, handle)
    }

    destroy(): void {
        if (this.disposed) return
        this.disposed = true
        if (this.scratch) this.module._free(this.scratch)
        this.module._edu_destroy(this.rawHandle)
    }

    private buffer(size: number): number {
        if (size > this.scratchSize) {
            if (this.scratch) this.module._free(this.scratch)
            this.scratchSize = Math.max(size, this.scratchSize * 2, 4096)
            this.scratch = this.module._malloc(this.scratchSize)
        }
        return this.scratch
    }

    private view(): DataView {
        return new DataView(this.module.HEAPU8.buffer)
    }

    private check(code: number, what: string): void {
        if (code !== 0) throw new MachineError(`${what}: ${this.errorText(code)}`, code)
    }

    errorText(code: number): string {
        return this.module.UTF8ToString(this.module._edu_strerror(code))
    }

    map(address: bigint, size: bigint, perms: number): void {
        this.check(this.module._edu_map(this.handle, address, size, perms), `cannot map 0x${address.toString(16)}`)
    }

    /** Unmapped bytes read as zero. */
    readMemory(address: bigint, length: number): Uint8Array {
        const pointer = this.buffer(length)
        this.module._edu_read_memory(this.handle, address, pointer, length)
        return this.module.HEAPU8.slice(pointer, pointer + length)
    }

    writeMemory(address: bigint, bytes: Uint8Array, journal = false): void {
        const pointer = this.buffer(bytes.length)
        this.module.HEAPU8.set(bytes, pointer)
        this.check(
            this.module._edu_write_memory(this.handle, address, pointer, bytes.length, journal ? 1 : 0),
            `cannot write ${bytes.length} bytes at 0x${address.toString(16)}`,
        )
    }

    readRegisters(ids: readonly number[]): bigint[] {
        const pointer = this.buffer(ids.length * 12)
        const out = pointer + ids.length * 4
        const heap = this.module.HEAP32
        ids.forEach((id, index) => (heap[(pointer >> 2) + index] = id))
        this.check(this.module._edu_read_registers(this.handle, pointer, ids.length, out), 'cannot read registers')
        const view = this.view()
        return ids.map((_, index) => view.getBigUint64(out + index * 8, true))
    }

    readRegister(id: number): bigint {
        return this.readRegisters([id])[0]!
    }

    writeRegister(id: number, value: bigint, journal = false): void {
        this.check(
            this.module._edu_write_register(this.handle, id, BigInt.asUintN(64, value), journal ? 1 : 0),
            'cannot write a register',
        )
    }

    readRegisterBytes(id: number, size: number): Uint8Array {
        const pointer = this.buffer(64)
        this.check(this.module._edu_read_register_bytes(this.handle, id, pointer, size), 'cannot read a register')
        return this.module.HEAPU8.slice(pointer, pointer + size)
    }

    writeRegisterBytes(id: number, bytes: Uint8Array, journal = false): void {
        const pointer = this.buffer(bytes.length)
        this.module.HEAPU8.set(bytes, pointer)
        this.check(
            this.module._edu_write_register_bytes(this.handle, id, pointer, bytes.length, journal ? 1 : 0),
            'cannot write a register',
        )
    }

    run(budget: number, skipBreakpointAtPc: boolean): StopReason {
        return this.module._edu_run(this.handle, BigInt(Math.max(0, Math.floor(budget))), skipBreakpointAtPc ? 1 : 0)
    }

    get executed(): number {
        return Number(this.module._edu_executed(this.handle))
    }

    get interruptNumber(): number {
        return this.module._edu_interrupt_number(this.handle)
    }

    get error(): number {
        return this.module._edu_error(this.handle)
    }

    lastInstruction(): bigint | null {
        const pointer = this.buffer(8)
        if (!this.module._edu_last_instruction(this.handle, pointer)) return null
        return this.view().getBigUint64(pointer, true)
    }

    setBreakpoints(addresses: readonly bigint[]): void {
        const pointer = this.buffer(Math.max(8, addresses.length * 8))
        const view = this.view()
        addresses.forEach((address, index) => view.setBigUint64(pointer + index * 8, address, true))
        this.check(this.module._edu_set_breakpoints(this.handle, pointer, addresses.length), 'cannot set breakpoints')
    }

    setFpMap(base: bigint, bits: Uint8Array, halfwords: number): void {
        const pointer = this.buffer(Math.max(1, bits.length))
        this.module.HEAPU8.set(bits, pointer)
        this.check(this.module._edu_set_fp_map(this.handle, base, pointer, halfwords), 'cannot set the floating-point map')
    }

    setHistory(capacity: number): void {
        this.check(this.module._edu_set_history(this.handle, Math.max(0, Math.floor(capacity))), 'cannot size the history')
    }

    get historyLength(): number {
        return this.module._edu_history_length(this.handle)
    }

    canUndo(): boolean {
        return this.module._edu_can_undo(this.handle) !== 0
    }

    undo(): boolean {
        return this.module._edu_undo(this.handle) !== 0
    }

    pokeBegin(): void {
        this.check(this.module._edu_poke_begin(this.handle), 'cannot open a poke')
    }

    pokeEnd(): boolean {
        return this.module._edu_poke_end(this.handle) !== 0
    }

    get callDepth(): number {
        return this.module._edu_call_depth(this.handle)
    }

    callStack(): RawFrame[] {
        let size = 4 + this.callDepth * 32
        let pointer = this.buffer(size)
        let needed = this.module._edu_call_stack_export(this.handle, pointer, size) >>> 0
        if (needed > size) {
            size = needed
            pointer = this.buffer(size)
            needed = this.module._edu_call_stack_export(this.handle, pointer, size) >>> 0
        }
        const view = this.view()
        const depth = view.getUint32(pointer, true)
        const frames: RawFrame[] = []
        for (let i = 0; i < depth; i++) {
            const at = pointer + 4 + i * 32
            frames.push({
                target: view.getBigUint64(at, true),
                returnAddress: view.getBigUint64(at + 8, true),
                sp: view.getBigUint64(at + 16, true),
                callSite: view.getBigUint64(at + 24, true),
            })
        }
        return frames
    }

    /** The newest `max` entries of the history; the format is native/edu.c's edu_history_export. */
    exportHistory(max: number): RawHistory {
        let needed = this.module._edu_history_export(this.handle, max, 0, 0) >>> 0
        let pointer = this.buffer(needed)
        const written = this.module._edu_history_export(this.handle, max, pointer, needed) >>> 0
        if (written > needed) {
            needed = written
            pointer = this.buffer(needed)
            this.module._edu_history_export(this.handle, max, pointer, needed)
        }
        const bytes = this.module.HEAPU8.slice(pointer, pointer + needed)
        const view = new DataView(bytes.buffer)
        let at = 0
        const u32 = () => {
            const value = view.getUint32(at, true)
            at += 4
            return value
        }
        const u64 = () => {
            const value = view.getBigUint64(at, true)
            at += 8
            return value
        }
        const count = u32()
        const coreCount = u32()
        const current = Array.from({ length: coreCount }, u64)
        const entries: RawEntry[] = []
        for (let k = 0; k < count; k++) {
            const kind = view.getUint8(at)
            const frameOp = view.getUint8(at + 1)
            const irreversible = view.getUint8(at + 2) !== 0
            at += 4
            const size = u32()
            const pc = u64()
            const registerCount = u32()
            const memoryCount = u32()
            const core = Array.from({ length: coreCount }, u64)
            let frame: RawFrame | undefined
            if (frameOp !== 0) {
                frame = { target: u64(), returnAddress: u64(), sp: u64(), callSite: u64() }
            }
            const registers: RawRegisterRecord[] = []
            for (let i = 0; i < registerCount; i++) {
                const id = u32()
                const recordSize = u32()
                registers.push({
                    id,
                    size: recordSize,
                    old: bytes.slice(at, at + recordSize),
                    new: bytes.slice(at + 16, at + 16 + recordSize),
                })
                at += 32
            }
            const memory: RawMemoryRecord[] = []
            for (let i = 0; i < memoryCount; i++) {
                const address = u64()
                const length = u32()
                at += 4
                memory.push({
                    address,
                    old: bytes.slice(at, at + length),
                    new: bytes.slice(at + length, at + 2 * length),
                })
                at += 2 * length
                at = (at + 7) & ~7
            }
            entries.push({
                kind: kind === 1 ? 'poke' : 'instruction',
                frameOp: frameOp === 1 ? 'push' : frameOp === 2 ? 'pop' : 'none',
                irreversible,
                size,
                pc,
                core,
                frame,
                registers,
                memory,
            })
        }
        return { current, entries }
    }
}
