/**
 * The shapes this package hands to an IDE. They follow `@specy/x86` (and through it the asm-editor's
 * own `commonLanguageFeatures`), so that an editor adapter for ARM can be written the way the x86
 * one is.
 */

export type MaybePromise<T> = T | PromiseLike<T>

export enum RegisterSize {
    Byte = 1,
    Word = 2,
    Long = 4,
    Double = 8,
    /** 128 bits, the width of a NEON Q register. */
    Quad = 16,
}

export enum EmulatorStatus {
    Terminated = 0,
    Running = 1,
    WaitingForInput = 2,
    NotReady = 3,
}

export type DiagnosticSeverity = 'error' | 'warning'

/**
 * One finding of the assembler or the linker, in the editor's coordinates: a zero-based line, and
 * one-based UTF-16 columns with an exclusive end.
 */
export type ArmDiagnostic = {
    /** Project-relative path; absent when the tool named no file. */
    file?: string
    lineIndex: number
    column: number
    endColumn?: number
    line: {
        line: string
        line_index: number
    }
    message: string
    formatted: string
    severity: DiagnosticSeverity
    /** Which tool said it. */
    source: 'as' | 'ld' | 'unicorn-edu'
}

/** A Project: an Entry and its Files, text or binary, keyed by root-relative path. */
export type ArmProject = {
    entry: string
    files: Readonly<Record<string, string | Uint8Array>>
}

export type ArmCompileResult =
    | { ok: true; diagnostics: ArmDiagnostic[] }
    | { ok: false; diagnostics: ArmDiagnostic[]; errors: ArmDiagnostic[]; report: string }

/** A source position: Project-relative path and zero-based line. */
export type ArmSourceLocation = {
    path: string
    line: number
}

/** A zero-based line of the Entry, or a line of any Project File. */
export type ArmBreakpoint = number | ArmSourceLocation

export type Instruction = {
    address: bigint
    /** Zero-based source line, -1 when no source line produced it. */
    lineNumber: number
    file?: string
    size?: number
    bytes?: Uint8Array
    /** The source line's text, trimmed. */
    code: string
}

export type StackFrame = {
    /** The called function: the nearest symbol at or below `address`, or empty. */
    name: string
    /** Where the call went. */
    address: bigint
    /** Where it returns to. */
    destination: bigint
    /** SP when the callee started. */
    sp: bigint
    /** Source line of `address`, -1 when unknown. */
    line: number
    file?: string
    color: string
}

/**
 * Why a run returned:
 * - `limit`: it executed the whole instruction budget;
 * - `breakpoint`: the next instruction is one a breakpoint names;
 * - `exit`: the program exited (`exitCode`), or returned from `main`;
 * - `wait`: it asked to sleep `waitMs` milliseconds; the sleep is already answered, so the host
 *   resumes it whenever it likes;
 * - `pause`: it executed a `bkpt`;
 * - `halt`: emulation stopped by itself, as on a `wfi`;
 * - `error`: it faulted (`message`), with the PC left on the faulting instruction.
 */
export type ArmStopKind = 'limit' | 'breakpoint' | 'exit' | 'wait' | 'pause' | 'halt' | 'error'

export type ArmRunResult = {
    kind: ArmStopKind
    /** Instructions executed by this call, a faulting one included. */
    executed: number
    exitCode?: number
    waitMs?: number
    message?: string
    /** Where it stopped, for `breakpoint` and `error`. */
    address?: bigint
}

export type ExecutionStepKind = 'instruction' | 'poke'

export type PokeWrite =
    | { type: 'register'; name: string; old: bigint; new: bigint }
    | { type: 'memory'; address: bigint; old: number[]; new: number[] }

/** What one history entry changed; both sides of every write. */
export type MutationOperation =
    | {
          type: 'WriteRegister'
          value: { register: string; old: bigint; new: bigint; size: RegisterSize }
      }
    | {
          type: 'WriteMemoryBytes'
          value: { address: bigint; old: number[]; new: number[] }
      }
    | { type: 'PushCallStack'; value: { from: bigint; to: bigint } }
    | { type: 'PopCallStack'; value: { from: bigint; to: bigint } }
    | { type: 'Other'; value: string }

export type ExecutionStep = {
    kind: ExecutionStepKind
    mutations: MutationOperation[]
    pc: number
    /** CPSR before and after the step. */
    old_ccr: { bits: number }
    new_ccr: { bits: number }
    line: number
    file?: string
    /** Only on a `poke` entry: what the host wrote. */
    writes?: PokeWrite[]
    /** False when the step's writes were too large to journal: Undo stops before it. */
    reversible: boolean
}
