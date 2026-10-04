import { AARCH64, type Aarch64RegisterName } from './aarch64'
import { ARM, type ArmRegisterName } from './arm'
import { buildFpMap, findCodeEnd, type Architecture } from './architecture'
import { readLineTable } from './dwarf-line'
import { PF_R, PF_W, PF_X, PT_LOAD, SHN_UNDEF, parseElf, sectionBytes, type ElfFile } from './elf'
import {
    ARM_EXCEPTION_BKPT,
    ARM_EXCEPTION_SVC,
    Machine,
    StopReason,
    UC_PROT_EXEC,
    UC_PROT_READ,
    UC_PROT_WRITE,
    loadMachineModule,
    type MachineModule,
    type RawEntry,
} from './machine'
import { SourceMap } from './source-map'
import {
    DEFAULT_LAYOUT,
    WORK_DIRECTORY,
    assembleProject,
    linkProgram,
    normalizePath,
    type MemoryLayout,
} from './toolchain'
import {
    EmulatorStatus,
    RegisterSize,
    type ArmBreakpoint,
    type ArmCompileResult,
    type ArmDiagnostic,
    type ArmProject,
    type ArmRunResult,
    type ExecutionStep,
    type Instruction,
    type MaybePromise,
    type MutationOperation,
    type PokeWrite,
    type StackFrame,
} from './types'

export type EmulatorOptions = {
    /** Text the program writes to file descriptor 1, decoded as UTF-8 as it arrives. */
    stdout?: (text: string) => void
    /** Text the program writes to file descriptor 2. */
    stderr?: (text: string) => void
    /**
     * Called when the program reads file descriptor 0 and nothing is buffered: return more text
     * (a line, with its newline if it has one), or null for end of input.
     */
    stdin?: () => MaybePromise<string | null>
    /** The clock `clock_gettime` reads, in milliseconds. Defaults to `Date.now`. */
    now?: () => number
    layout?: Partial<MemoryLayout>
}

/** @deprecated the options are the same for every architecture: use EmulatorOptions. */
export type ArmEmulatorOptions = EmulatorOptions

/**
 * Thrown by a run that was waiting for input when the host loaded another program (or the same
 * one again) or disposed the emulator: the run it belonged to no longer exists.
 */
export class ArmEmulatorSupersededError extends Error {
    constructor() {
        super('The program was reloaded while it was waiting for input')
        this.name = 'ArmEmulatorSupersededError'
    }
}

/** How a program ended: exit status, ran off its last instruction, faulted, or halted (`wfi`). */
export type ArmTermination =
    | { kind: 'exit'; code: number }
    | { kind: 'end' }
    | { kind: 'fault'; message: string; address: bigint }
    | { kind: 'halt' }

type Program = {
    project: ArmProject
    elf: ElfFile
    sourceMap: SourceMap
    entry: bigint
    /** Where `.text`'s last run of instructions ends (see `findCodeEnd`). */
    codeEnd: bigint | null
    /** Labels and functions, by address, for naming call frames. */
    symbols: { name: string; address: bigint }[]
    lines: Map<string, string[]>
}

const EBADF = 9
const EFAULT = 14

const PAGE = 0x1000n
const alignDown = (value: bigint) => value & ~(PAGE - 1n)
const alignUp = (value: bigint) => (value + PAGE - 1n) & ~(PAGE - 1n)

/** CPSR and NZCV keep the condition flags in the same bits. */
const CONDITION_FLAGS = [
    { name: 'N', bit: 31n },
    { name: 'Z', bit: 30n },
    { name: 'C', bit: 29n },
    { name: 'V', bit: 28n },
] as const

function littleEndian(bytes: Uint8Array): bigint {
    let value = 0n
    for (let i = bytes.length - 1; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]!)
    return value
}

function toLittleEndian(value: bigint, size: number): Uint8Array {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i++) bytes[i] = Number((value >> BigInt(8 * i)) & 0xffn)
    return bytes
}

function registerSize(bytes: number): RegisterSize {
    if (bytes >= 16) return RegisterSize.Quad
    if (bytes >= 8) return RegisterSize.Double
    if (bytes >= 4) return RegisterSize.Long
    if (bytes >= 2) return RegisterSize.Word
    return RegisterSize.Byte
}

function frameColor(index: number): string {
    return `hsl(${(index * 137) % 360}, 40%, 60%)`
}

/**
 * A machine of the ARM family for an IDE: assembles and links a Project with GNU as and ld,
 * loads the program, and runs it under Unicorn with breakpoints, Undo, Pokes and a call stack.
 * Programs talk to the host through Linux system calls (`svc #0`). `R` names the general
 * registers of the architecture.
 */
export class UnicornEmulator<R extends string = string> {
    private program: Program | null = null
    private machine: Machine | null = null
    private readonly layout: MemoryLayout
    private termination: ArmTermination | null = null
    private pokeOpen = false
    private waitingForInput = false
    private breakpointKey = ''
    private stdinBuffer = new Uint8Array(0)
    private stdinEnded = false
    private heapStart = 0n
    private heapBreak = 0n
    private heapMapped = 0n
    private readonly stdoutDecoder = new TextDecoder()
    private readonly stderrDecoder = new TextDecoder()

    private constructor(
        readonly architecture: Architecture<R>,
        private readonly module: MachineModule,
        private readonly options: EmulatorOptions,
    ) {
        this.layout = { ...DEFAULT_LAYOUT, ...options.layout }
    }

    static async create<R extends string>(
        architecture: Architecture<R>,
        options: EmulatorOptions = {},
    ): Promise<UnicornEmulator<R>> {
        return new UnicornEmulator(architecture, await loadMachineModule(architecture), options)
    }

    private get registerBits(): number {
        return this.architecture.bits
    }

    // ----- building -----

    /** Assembles and links one source as `main.s`; see `compileProject`. */
    compile(source: string, path = 'main.s'): Promise<ArmCompileResult> {
        return this.compileProject({ entry: path, files: { [path]: source } })
    }

    /**
     * Assembles every translation unit of the Project and links them. A successful build replaces
     * the loaded program, which `initialize` then starts.
     */
    async compileProject(project: ArmProject): Promise<ArmCompileResult> {
        const build = await this.build(project)
        if (!build.program) {
            const errors = build.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
            return {
                ok: false,
                diagnostics: build.diagnostics,
                errors,
                report: errors.map((diagnostic) => diagnostic.formatted).join('\n'),
            }
        }
        this.program = build.program
        return { ok: true, diagnostics: build.diagnostics }
    }

    /** Everything the assembler and the linker say about the Project, without loading it. */
    async check(project: ArmProject): Promise<ArmDiagnostic[]> {
        return (await this.build(project)).diagnostics
    }

    private async build(project: ArmProject): Promise<{ program: Program | null; diagnostics: ArmDiagnostic[] }> {
        const assembled = await assembleProject(project, this.architecture)
        if (!assembled.ok) return { program: null, diagnostics: assembled.diagnostics }
        const linked = await linkProgram(assembled.units, project, this.architecture, this.layout)
        const diagnostics = [...assembled.diagnostics, ...linked.diagnostics]
        if (!linked.elf) return { program: null, diagnostics }
        const elf = parseElf(linked.elf)
        const defined = (name: string) =>
            elf.symbols.find((symbol) => symbol.name === name && symbol.section !== SHN_UNDEF)
        const start = defined('_start') ?? defined('main')
        if (!start) {
            const message = 'The program has no entry point: define the label _start (or main) and make it .global'
            diagnostics.push({
                file: project.entry,
                lineIndex: 0,
                column: 1,
                line: { line: '', line_index: 0 },
                message,
                formatted: message,
                severity: 'error',
                source: 'unicorn-edu',
            })
            return { program: null, diagnostics }
        }
        return { program: this.describe(project, elf, start.value), diagnostics }
    }

    private describe(project: ArmProject, elf: ElfFile, entry: bigint): Program {
        const debugLine = sectionBytes(elf, '.debug_line')
        const rows = debugLine
            ? readLineTable(debugLine, elf.bits / 8, sectionBytes(elf, '.debug_line_str'), sectionBytes(elf, '.debug_str'))
            : []
        const sourceMap = new SourceMap(rows, (file) => {
            const path = normalizePath(file.startsWith(`${WORK_DIRECTORY}/`) ? file.slice(WORK_DIRECTORY.length + 1) : file)
            return path in project.files ? path : null
        })
        const symbols = elf.symbols
            .filter(
                (symbol) =>
                    symbol.section !== SHN_UNDEF &&
                    symbol.name &&
                    !symbol.name.startsWith('$') &&
                    !symbol.name.startsWith('.L') &&
                    symbol.type <= 2,
            )
            .map((symbol) => ({ name: symbol.name, address: symbol.value & ~1n }))
            .sort((left, right) => (left.address < right.address ? -1 : left.address > right.address ? 1 : 0))
        const lines = new Map<string, string[]>()
        for (const [path, content] of Object.entries(project.files)) {
            if (typeof content === 'string') lines.set(path, content.split('\n'))
        }
        return { project, elf, sourceMap, entry, codeEnd: findCodeEnd(elf, this.architecture), symbols, lines }
    }

    /**
     * Loads the last successful build into a fresh machine with `undoSize` steps of history: its
     * segments, a stack, the return trampoline, and the registers a program starts with (all zero
     * except the stack pointer, the link register and the program counter).
     */
    initialize(undoSize: number): void {
        const program = this.program
        if (!program) throw new Error('There is no program to load: compile one first')
        const architecture = this.architecture
        this.machine?.destroy()
        this.machine = null
        this.termination = null
        this.pokeOpen = false
        this.waitingForInput = false
        this.breakpointKey = ''
        this.stdinBuffer = new Uint8Array(0)
        this.stdinEnded = false

        const machine = Machine.create(this.module, architecture.ucArch, architecture.ucMode)
        this.machine = machine
        const { elf } = program

        // Pages from every PT_LOAD segment, with the union of the permissions that share a page
        const pages = new Map<bigint, number>()
        let programEnd = 0n
        for (const segment of elf.segments) {
            if (segment.type !== PT_LOAD || !segment.memorySize) continue
            const perms =
                (segment.flags & PF_R ? UC_PROT_READ : 0) |
                (segment.flags & PF_W ? UC_PROT_WRITE : 0) |
                (segment.flags & PF_X ? UC_PROT_EXEC : 0)
            const end = segment.address + BigInt(segment.memorySize)
            for (let page = alignDown(segment.address); page < end; page += PAGE) {
                pages.set(page, (pages.get(page) ?? 0) | perms)
            }
            if (end > programEnd) programEnd = end
        }
        const sorted = [...pages.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        for (let i = 0; i < sorted.length; ) {
            const begin = sorted[i]!
            const perms = pages.get(begin)!
            let end = begin + PAGE
            i++
            while (i < sorted.length && sorted[i] === end && pages.get(sorted[i]!) === perms) {
                end += PAGE
                i++
            }
            machine.map(begin, end - begin, perms)
        }
        for (const segment of elf.segments) {
            if (segment.type !== PT_LOAD || !segment.memorySize) continue
            if (segment.fileSize) {
                machine.writeMemory(segment.address, elf.bytes.subarray(segment.offset, segment.offset + segment.fileSize))
            }
            if (segment.memorySize > segment.fileSize) {
                machine.writeMemory(
                    segment.address + BigInt(segment.fileSize),
                    new Uint8Array(segment.memorySize - segment.fileSize),
                )
            }
        }

        const trampoline = BigInt(this.layout.returnTrampoline)
        machine.map(trampoline, PAGE, UC_PROT_READ | UC_PROT_EXEC)
        machine.writeMemory(trampoline, architecture.exitTrampoline)

        const stackTop = BigInt(this.layout.stackTop)
        machine.map(stackTop - BigInt(this.layout.stackSize), BigInt(this.layout.stackSize), UC_PROT_READ | UC_PROT_WRITE)

        this.heapStart = alignUp(programEnd)
        this.heapBreak = this.heapStart
        this.heapMapped = this.heapStart

        for (const { id, value } of architecture.initialRegisters(program.entry)) machine.writeRegister(id, value)
        machine.writeRegister(architecture.spId, stackTop)
        machine.writeRegister(architecture.linkId, trampoline)
        const flags = machine.readRegister(architecture.flagsId)
        machine.writeRegister(architecture.pcId, architecture.pcValue(program.entry & ~1n, flags))

        const fpMap = buildFpMap(elf, architecture)
        if (fpMap) machine.setFpMap(fpMap.base, fpMap.bits, fpMap.halfwords)
        machine.setHistory(Number.isFinite(undoSize) ? Math.max(0, Math.floor(undoSize)) : 0)
        this.applyBreakpoints([])
    }

    dispose(): void {
        this.machine?.destroy()
        this.machine = null
        this.program = null
    }

    private requireMachine(): Machine {
        if (!this.machine) throw new Error('The program is not loaded: compile and initialize it first')
        return this.machine
    }

    private requireProgram(): Program {
        if (!this.program) throw new Error('There is no program: compile one first')
        return this.program
    }

    // ----- running -----

    /** Addresses where execution enters a line, for breakpoints. */
    getAddressesForLine(line: number, path?: string): bigint[] {
        const program = this.requireProgram()
        return program.sourceMap.addressesForLine(path ?? program.project.entry, line)
    }

    private applyBreakpoints(breakpoints: readonly ArmBreakpoint[]): void {
        const program = this.requireProgram()
        const addresses = new Set<bigint>()
        for (const breakpoint of breakpoints) {
            const location =
                typeof breakpoint === 'number' ? { path: program.project.entry, line: breakpoint } : breakpoint
            for (const address of program.sourceMap.addressesForLine(location.path, location.line)) addresses.add(address)
        }
        // falling off the last instruction stops the program instead of running into whatever follows
        if (program.codeEnd !== null) addresses.add(program.codeEnd)
        const list = [...addresses].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        const key = list.join(',')
        if (key === this.breakpointKey) return
        this.requireMachine().setBreakpoints(list)
        this.breakpointKey = key
    }

    /**
     * Runs until the program stops, at most `limit` instructions (no limit when absent). A
     * breakpoint stops it before the instruction it names, except the one the run starts on when
     * `skipBreakpointAtPc` is true (the default), which is what lets a run leave a breakpoint.
     * System calls are answered inside the run, reading standard input included.
     */
    async run(
        limit?: number,
        breakpoints: readonly ArmBreakpoint[] = [],
        options: { skipBreakpointAtPc?: boolean } = {},
    ): Promise<ArmRunResult> {
        const machine = this.requireMachine()
        if (this.pokeOpen) throw new Error('Cannot run while a poke is open: end it first')
        if (this.termination) return this.terminationResult(0)
        this.applyBreakpoints(breakpoints)
        const budget = limit === undefined ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(limit))
        let skip = options.skipBreakpointAtPc ?? true
        let executed = 0
        for (;;) {
            const reason = machine.run(budget - executed, skip)
            // the instruction after an answered system call has not run yet: a breakpoint on it stops
            skip = false
            executed += machine.executed
            switch (reason) {
                case StopReason.Budget:
                    return { kind: 'limit', executed }
                case StopReason.Breakpoint: {
                    const pc = this.getPc()
                    // gas gives a literal pool the line of its .ltorg, so only the address says it is data
                    if (pc === this.requireProgram().codeEnd) {
                        this.termination = { kind: 'end' }
                        return this.terminationResult(executed)
                    }
                    return { kind: 'breakpoint', executed, address: pc }
                }
                case StopReason.Interrupt: {
                    const number = machine.interruptNumber
                    if (number === ARM_EXCEPTION_SVC) {
                        const outcome = await this.systemCall()
                        // a read may have waited for input while the host reloaded the program
                        if (this.machine !== machine) throw new ArmEmulatorSupersededError()
                        if (outcome) return { ...outcome, executed }
                        if (executed >= budget) return { kind: 'limit', executed }
                        continue
                    }
                    if (number === ARM_EXCEPTION_BKPT) {
                        // QEMU leaves the PC on a bkpt or brk, so resuming would stop on it again
                        // for ever
                        const flags = machine.readRegister(this.architecture.flagsId)
                        const next = this.getPc() + BigInt(this.architecture.breakpointInstructionSize(flags))
                        machine.writeRegister(this.architecture.pcId, this.architecture.pcValue(next, flags), true)
                        return { kind: 'pause', executed }
                    }
                    return this.fault(`The program raised exception ${number}`, executed)
                }
                case StopReason.Error:
                    return this.fault(machine.errorText(machine.error), executed)
                case StopReason.Halt:
                    this.termination = { kind: 'halt' }
                    return this.terminationResult(executed)
                default:
                    return { kind: 'limit', executed }
            }
        }
    }

    /** Executes one instruction, answering a system call it makes; breakpoints play no part. */
    step(): Promise<ArmRunResult> {
        return this.run(1, [], { skipBreakpointAtPc: true })
    }

    private fault(reason: string, executed: number): ArmRunResult {
        const address = this.getPc()
        const location = this.requireProgram().sourceMap.locate(address)
        const where = location ? ` (${location.path}:${location.line + 1})` : ''
        const message = `${reason} at 0x${address.toString(16)}${where}`
        this.termination = { kind: 'fault', message, address }
        return { kind: 'error', executed, message, address }
    }

    private terminationResult(executed: number): ArmRunResult {
        const termination = this.termination!
        switch (termination.kind) {
            case 'exit':
                return { kind: 'exit', executed, exitCode: termination.code }
            case 'end':
                return { kind: 'exit', executed, message: 'The program ran past its last instruction' }
            case 'fault':
                return { kind: 'error', executed, message: termination.message, address: termination.address }
            case 'halt':
                return { kind: 'halt', executed }
        }
    }

    private setReturnValue(value: number | bigint): void {
        const result = this.architecture.systemCalls.argumentRegisters[0]
        this.requireMachine().writeRegister(result, BigInt.asUintN(this.registerBits, BigInt(value)), true)
    }

    private readTimespec(address: bigint): number {
        const size = this.architecture.systemCalls.timespecFieldSize
        const view = new DataView(this.requireMachine().readMemory(address, size * 2).buffer)
        const seconds = size === 8 ? Number(view.getBigUint64(0, true)) : view.getUint32(0, true)
        const nanoseconds = size === 8 ? Number(view.getBigUint64(8, true)) : view.getUint32(4, true)
        return seconds * 1000 + nanoseconds / 1e6
    }

    private encodeTimespec(milliseconds: number): Uint8Array {
        const size = this.architecture.systemCalls.timespecFieldSize
        const seconds = Math.floor(milliseconds / 1000)
        const nanoseconds = Math.floor((milliseconds - seconds * 1000) * 1e6)
        const bytes = new Uint8Array(size * 2)
        const view = new DataView(bytes.buffer)
        if (size === 8) {
            view.setBigUint64(0, BigInt(seconds), true)
            view.setBigUint64(8, BigInt(nanoseconds), true)
        } else {
            view.setUint32(0, seconds >>> 0, true)
            view.setUint32(4, nanoseconds >>> 0, true)
        }
        return bytes
    }

    /** Answers the `svc` that stopped the run; null when the program simply continues. */
    private async systemCall(): Promise<Omit<ArmRunResult, 'executed'> | null> {
        const machine = this.requireMachine()
        const calls = this.architecture.systemCalls
        const [first, second, third, number] = machine.readRegisters([...calls.argumentRegisters, calls.numberRegister])
        const call = Number(number)
        if (calls.exit.includes(call)) {
            // an exit status is an int whatever the register width
            const code = Number(BigInt.asIntN(32, first!))
            this.termination = { kind: 'exit', code }
            return { kind: 'exit', exitCode: code }
        }
        switch (call) {
            case calls.write: {
                const fd = Number(first)
                if (fd !== 1 && fd !== 2) {
                    this.setReturnValue(-EBADF)
                    return null
                }
                const length = Number(third)
                const bytes = machine.readMemory(second!, length)
                const decoder = fd === 1 ? this.stdoutDecoder : this.stderrDecoder
                const text = decoder.decode(bytes, { stream: true })
                if (text) (fd === 1 ? this.options.stdout : this.options.stderr)?.(text)
                this.setReturnValue(length)
                return null
            }
            case calls.read: {
                if (Number(first) !== 0) {
                    this.setReturnValue(-EBADF)
                    return null
                }
                const bytes = await this.readInput(Number(third))
                if (this.machine !== machine) throw new ArmEmulatorSupersededError()
                try {
                    if (bytes.length) machine.writeMemory(second!, bytes, true)
                } catch {
                    this.setReturnValue(-EFAULT)
                    return null
                }
                this.setReturnValue(bytes.length)
                return null
            }
            case calls.brk: {
                const requested = first!
                if (requested > this.heapBreak && requested <= this.heapStart + BigInt(this.layout.heapLimit)) {
                    const needed = alignUp(requested)
                    if (needed > this.heapMapped) {
                        machine.map(this.heapMapped, needed - this.heapMapped, UC_PROT_READ | UC_PROT_WRITE)
                        this.heapMapped = needed
                    }
                    this.heapBreak = requested
                } else if (requested >= this.heapStart && requested <= this.heapBreak) {
                    this.heapBreak = requested
                }
                this.setReturnValue(this.heapBreak)
                return null
            }
            case calls.clockGettime: {
                try {
                    machine.writeMemory(second!, this.encodeTimespec((this.options.now ?? Date.now)()), true)
                } catch {
                    this.setReturnValue(-EFAULT)
                    return null
                }
                this.setReturnValue(0)
                return null
            }
            case calls.nanosleep: {
                const waitMs = this.readTimespec(first!)
                this.setReturnValue(0)
                return { kind: 'wait', waitMs }
            }
            default: {
                const name = this.architecture.registerName(calls.numberRegister)
                const result = this.fault(`Unsupported system call ${call} (the number in ${name})`, 0)
                return { kind: result.kind, message: result.message, address: result.address }
            }
        }
    }

    private async readInput(maxBytes: number): Promise<Uint8Array> {
        if (!this.stdinBuffer.length && !this.stdinEnded) {
            this.waitingForInput = true
            let chunk: string | null
            try {
                chunk = this.options.stdin ? await this.options.stdin() : null
            } finally {
                this.waitingForInput = false
            }
            if (chunk === null) this.stdinEnded = true
            else this.stdinBuffer = new TextEncoder().encode(chunk)
        }
        const taken = this.stdinBuffer.subarray(0, Math.max(0, maxBytes))
        this.stdinBuffer = this.stdinBuffer.subarray(taken.length)
        return taken.slice()
    }

    // ----- state -----

    hasTerminated(): boolean {
        return this.termination !== null
    }

    getTermination(): ArmTermination | null {
        return this.termination
    }

    getStatus(): EmulatorStatus {
        if (!this.machine) return EmulatorStatus.NotReady
        if (this.termination) return EmulatorStatus.Terminated
        if (this.waitingForInput) return EmulatorStatus.WaitingForInput
        return EmulatorStatus.Running
    }

    getPc(): bigint {
        return this.requireMachine().readRegister(this.architecture.pcId)
    }

    getSp(): bigint {
        return this.requireMachine().readRegister(this.architecture.spId)
    }

    /** The register holding the condition flags: CPSR on ARM, NZCV on AArch64. */
    getFlagsRegister(): bigint {
        return this.requireMachine().readRegister(this.architecture.flagsId)
    }

    getFlags(): { name: string; value: number }[] {
        const flags = this.getFlagsRegister()
        return CONDITION_FLAGS.map(({ name, bit }) => ({ name, value: Number((flags >> bit) & 1n) }))
    }

    /** The general registers, unsigned, in `architecture.registerNames` order. */
    getRegisterValues(): bigint[] {
        const ids = this.architecture.registerNames.map((name) => this.architecture.registerIds[name])
        return this.requireMachine().readRegisters(ids)
    }

    getRegisterValuesRecord(): Record<R, bigint> {
        const values = this.getRegisterValues()
        return Object.fromEntries(this.architecture.registerNames.map((name, index) => [name, values[index]!])) as Record<
            R,
            bigint
        >
    }

    getRegisterValue(register: R): bigint {
        return this.requireMachine().readRegister(this.architecture.registerIds[register])
    }

    /** A direct write, or one value of the open Poke. */
    setRegisterValue(register: R, value: bigint): void {
        this.requireMachine().writeRegister(
            this.architecture.registerIds[register],
            BigInt.asUintN(this.registerBits, value),
            this.pokeOpen,
        )
    }

    /**
     * The floating-point and SIMD registers, unsigned, in `architecture.floatingPoint` order:
     * `d0`-`d31` and `fpscr` on ARM, `v0`-`v31` (128 bits) with `fpcr` and `fpsr` on AArch64.
     */
    getFloatingPointRegisterValues(): bigint[] {
        const machine = this.requireMachine()
        const narrow = this.architecture.floatingPoint.filter((register) => register.size <= 8)
        const values = new Map<number, bigint>()
        machine.readRegisters(narrow.map((register) => register.id)).forEach((value, index) => {
            values.set(narrow[index]!.id, value)
        })
        return this.architecture.floatingPoint.map((register) =>
            register.size <= 8
                ? values.get(register.id)!
                : littleEndian(machine.readRegisterBytes(register.id, register.size)),
        )
    }

    /** A direct write, or one value of the open Poke. */
    setFloatingPointRegister(name: string, value: bigint): void {
        const register = this.architecture.floatingPoint.find((candidate) => candidate.name === name)
        if (!register) throw new Error(`Unknown floating-point register ${name}`)
        this.requireMachine().writeRegisterBytes(
            register.id,
            toLittleEndian(BigInt.asUintN(register.size * 8, value), register.size),
            this.pokeOpen,
        )
    }

    readMemoryBytes(address: bigint, length: number): Uint8Array {
        return this.requireMachine().readMemory(address, length)
    }

    /** A direct write, or part of the open Poke. */
    writeMemoryBytes(address: bigint, data: Uint8Array): void {
        this.requireMachine().writeMemory(address, data, this.pokeOpen)
    }

    // ----- Undo and Pokes -----

    canUndo(): boolean {
        return !!this.machine && !this.pokeOpen && this.machine.canUndo()
    }

    /** Reverts the newest step; a program that had ended is running again afterwards. */
    undo(): boolean {
        if (this.pokeOpen) throw new Error('Cannot undo while a poke is open: end it first')
        const undone = this.requireMachine().undo()
        if (undone) this.termination = null
        return undone
    }

    /**
     * Opens a Poke: register and memory writes until `endPoke` become one step of the history,
     * undone like an instruction.
     */
    beginPoke(): void {
        if (this.pokeOpen) throw new Error('A poke is already open')
        this.requireMachine().pokeBegin()
        this.pokeOpen = true
    }

    /** Closes the Poke; true when it was recorded (it changed something, and history is on). */
    endPoke(): boolean {
        if (!this.pokeOpen) return false
        this.pokeOpen = false
        return this.requireMachine().pokeEnd()
    }

    isPokeOpen(): boolean {
        return this.pokeOpen
    }

    getUndoHistory(max: number): ExecutionStep[] {
        if (!this.machine) return []
        const history = this.machine.exportHistory(Math.max(0, Math.floor(max)))
        return history.entries.map((entry, index) =>
            this.describeStep(entry, index === 0 ? history.current : history.entries[index - 1]!.core),
        )
    }

    private describeStep(entry: RawEntry, after: bigint[]): ExecutionStep {
        const architecture = this.architecture
        const flagsIndex = architecture.coreSnapshot.indexOf(architecture.flagsName)
        const mutations: MutationOperation[] = []
        const writes: PokeWrite[] = []
        const coreIds = new Set<number>([
            ...architecture.registerNames.map((name) => architecture.registerIds[name]),
            architecture.flagsId,
        ])
        if (entry.kind === 'instruction') {
            architecture.coreSnapshot.forEach((name, index) => {
                if (name === architecture.pcName || name === architecture.flagsName) return
                const old = entry.core[index]!
                const value = after[index]!
                if (old !== value) {
                    mutations.push({
                        type: 'WriteRegister',
                        value: { register: name, old, new: value, size: registerSize(this.registerBits / 8) },
                    })
                }
            })
        }
        for (const record of entry.registers) {
            // an instruction's core registers are already in the snapshot difference
            if (entry.kind === 'instruction' && coreIds.has(record.id)) continue
            const name = architecture.registerName(record.id)
            const old = littleEndian(record.old)
            const value = littleEndian(record.new)
            mutations.push({ type: 'WriteRegister', value: { register: name, old, new: value, size: registerSize(record.size) } })
            if (entry.kind === 'poke') writes.push({ type: 'register', name, old, new: value })
        }
        for (const record of entry.memory) {
            const old = [...record.old]
            const value = [...record.new]
            mutations.push({ type: 'WriteMemoryBytes', value: { address: record.address, old, new: value } })
            if (entry.kind === 'poke') writes.push({ type: 'memory', address: record.address, old, new: value })
        }
        if (entry.frame && entry.frameOp === 'push') {
            mutations.push({ type: 'PushCallStack', value: { from: entry.frame.callSite, to: entry.frame.target } })
        } else if (entry.frame && entry.frameOp === 'pop') {
            mutations.push({ type: 'PopCallStack', value: { from: entry.pc, to: entry.frame.returnAddress } })
        }
        const location = entry.kind === 'instruction' ? this.program?.sourceMap.locate(entry.pc) : null
        return {
            kind: entry.kind,
            mutations,
            pc: Number(entry.pc),
            old_ccr: { bits: Number(entry.core[flagsIndex]) },
            new_ccr: { bits: Number(after[flagsIndex]) },
            line: location?.line ?? -1,
            file: location?.path,
            writes: entry.kind === 'poke' ? writes : undefined,
            reversible: !entry.irreversible,
        }
    }

    // ----- source and call stack -----

    private nearestSymbol(address: bigint): { name: string; address: bigint } | null {
        const symbols = this.program?.symbols ?? []
        let low = 0
        let high = symbols.length - 1
        let match: { name: string; address: bigint } | null = null
        while (low <= high) {
            const middle = (low + high) >> 1
            const symbol = symbols[middle]!
            if (symbol.address <= address) {
                match = symbol
                low = middle + 1
            } else {
                high = middle - 1
            }
        }
        return match
    }

    getCallStack(): StackFrame[] {
        if (!this.machine) return []
        return this.machine.callStack().map((frame, index) => {
            const location = this.program?.sourceMap.locate(frame.target)
            return {
                name: this.nearestSymbol(frame.target)?.name ?? '',
                address: frame.target,
                destination: frame.returnAddress,
                sp: frame.sp,
                line: location?.line ?? -1,
                file: location?.path,
                color: frameColor(index),
            }
        })
    }

    /** The instruction at `address`, with the source line that produced it (-1 when none did). */
    getInstructionAt(address: bigint): Instruction | null {
        const program = this.program
        if (!program) return null
        const entry = program.sourceMap.locate(address)
        if (!entry) return { address, lineNumber: -1, code: '' }
        const size = Number(entry.end - entry.address)
        return {
            address: entry.address,
            lineNumber: entry.line,
            file: entry.path,
            size,
            bytes: this.machine?.readMemory(entry.address, size),
            code: program.lines.get(entry.path)?.[entry.line]?.trim() ?? '',
        }
    }

    /** The instruction the program runs next, null once it has ended. */
    getNextInstruction(): Instruction | null {
        if (!this.machine || this.termination?.kind === 'exit' || this.termination?.kind === 'end') return null
        return this.getInstructionAt(this.getPc())
    }

    /** The instruction that ran last, or the one that faulted. */
    getLastInstruction(): Instruction | null {
        const address = this.machine?.lastInstruction()
        return address === undefined || address === null ? null : this.getInstructionAt(address)
    }

    /** Every instruction the build produced, in address order, with its source line. */
    getCompiledInstructions(): Instruction[] {
        const program = this.program
        if (!program) return []
        return program.sourceMap.all().map((entry) => {
            const size = Number(entry.end - entry.address)
            return {
                address: entry.address,
                lineNumber: entry.line,
                file: entry.path,
                size,
                bytes: this.machine?.readMemory(entry.address, size),
                code: program.lines.get(entry.path)?.[entry.line]?.trim() ?? '',
            }
        })
    }

    stringifyError(error: unknown): string {
        if (error instanceof Error) return error.message
        return String(error)
    }
}

export type ArmEmulator = UnicornEmulator<ArmRegisterName>
export type Aarch64Emulator = UnicornEmulator<Aarch64RegisterName>

export function createEmulator<R extends string>(
    architecture: Architecture<R>,
    options: EmulatorOptions = {},
): Promise<UnicornEmulator<R>> {
    return UnicornEmulator.create(architecture, options)
}

/** 32-bit ARM: ARMv7-A, A32 and Thumb-2, VFPv4 and NEON. */
export function createArmEmulator(options: EmulatorOptions = {}): Promise<ArmEmulator> {
    return UnicornEmulator.create(ARM, options)
}

/** AArch64: ARMv8-A A64 with FP and Advanced SIMD. */
export function createAarch64Emulator(options: EmulatorOptions = {}): Promise<Aarch64Emulator> {
    return UnicornEmulator.create(AARCH64, options)
}
