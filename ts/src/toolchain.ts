import createAssembler from './wasm/arm-as.mjs'
import createLinker from './wasm/arm-ld.mjs'
import type { ToolModuleFactory } from './wasm/tool-module'
import type { ArmDiagnostic, ArmProject } from './types'

/** Where a tool sees the Project: Files keep their root-relative paths below it. */
export const WORK_DIRECTORY = '/work'

/** The CPU the emulator models (Unicorn's default for ARM mode): ARMv7-A with VFPv4 and NEON. */
export const ASSEMBLER_FLAGS = ['-mcpu=cortex-a15', '-mfpu=neon-vfpv4', '-mfloat-abi=hard']

export type MemoryLayout = {
    /** Where `.text` starts. */
    textAddress: number
    /** One past the highest stack address; the stack grows down from here. */
    stackTop: number
    stackSize: number
    /** How far `brk` may grow the heap above the program. */
    heapLimit: number
    /** A page of code that turns a return from the entry point into `exit(r0)`. */
    returnTrampoline: number
}

export const DEFAULT_LAYOUT: MemoryLayout = {
    textAddress: 0x0001_0000,
    stackTop: 0x8000_0000,
    stackSize: 0x10_0000,
    heapLimit: 0x100_0000,
    returnTrampoline: 0x0000_1000,
}

/**
 * The linker script: code and read-only data from `textAddress`, writable data on the next page.
 * Sections it does not name are placed by ld after the ones it does.
 */
export function linkerScript(layout: MemoryLayout): string {
    return `ENTRY(_start)
SECTIONS
{
  . = 0x${layout.textAddress.toString(16)};
  .text : { *(.text.startup .text.startup.*) *(.text .text.*) *(.glue_7 .glue_7t .vfp11_veneer .v4_bx) }
  .rodata : { *(.rodata .rodata.*) }
  .ARM.extab : { *(.ARM.extab*) }
  .ARM.exidx : { *(.ARM.exidx*) }
  . = ALIGN(0x1000);
  .data : { *(.data .data.*) }
  .bss : { *(.bss .bss.*) *(COMMON) }
  . = ALIGN(8);
  end = .;
  _end = .;
}
`
}

export type ToolRun = {
    status: number
    stdout: string
    stderr: string
    outputs: Map<string, Uint8Array>
}

const compiledModules = new Map<string, Promise<WebAssembly.Module>>()

async function compileWasm(url: URL): Promise<WebAssembly.Module> {
    if (url.protocol === 'file:') {
        const { readFile } = await import('node:fs/promises')
        const { fileURLToPath } = await import('node:url')
        return WebAssembly.compile(await readFile(fileURLToPath(url)))
    }
    const response = await fetch(url)
    if (!response.ok) throw new Error(`cannot load ${url}: HTTP ${response.status}`)
    return WebAssembly.compile(await response.arrayBuffer())
}

/**
 * Each URL is a literal `new URL(..., import.meta.url)`, the form bundlers recognize and copy
 * the asset for.
 */
const TOOL_WASM: Record<string, () => URL> = {
    'arm-as': () => new URL('./wasm/arm-as.wasm', import.meta.url),
    'arm-ld': () => new URL('./wasm/arm-ld.wasm', import.meta.url),
}

/** Compiles a tool's .wasm once; every run instantiates it afresh, which takes milliseconds. */
function wasmModule(name: string): Promise<WebAssembly.Module> {
    let compiled = compiledModules.get(name)
    if (!compiled) {
        const url = TOOL_WASM[name]
        if (!url) throw new Error(`unknown tool ${name}`)
        compiled = compileWasm(url())
        compiledModules.set(name, compiled)
        compiled.catch(() => compiledModules.delete(name))
    }
    return compiled
}

/**
 * Runs one binutils program over a fresh in-memory filesystem: writes `files` below the work
 * directory, calls main with `args` from there, and reads `outputs` back. The tools keep global
 * state between runs, so an instance is never reused.
 */
export async function runTool(
    factory: ToolModuleFactory,
    name: string,
    args: string[],
    files: Readonly<Record<string, string | Uint8Array>>,
    outputs: readonly string[],
): Promise<ToolRun> {
    let stdout = ''
    let stderr = ''
    const compiled = await wasmModule(name)
    const module = await factory({
        thisProgram: name.endsWith('-as') ? 'as' : 'ld',
        print: (line) => (stdout += `${line}\n`),
        printErr: (line) => (stderr += `${line}\n`),
        instantiateWasm: (imports, receive) => {
            WebAssembly.instantiate(compiled, imports).then((instance) => receive(instance, compiled))
            return {}
        },
    })
    module.FS.mkdirTree(WORK_DIRECTORY)
    for (const [path, content] of Object.entries(files)) {
        const slash = path.lastIndexOf('/')
        if (slash > 0) module.FS.mkdirTree(`${WORK_DIRECTORY}/${path.slice(0, slash)}`)
        module.FS.writeFile(`${WORK_DIRECTORY}/${path}`, content)
    }
    module.FS.chdir(WORK_DIRECTORY)

    // Emscripten sets the host's process.exitCode from the program's status under Node; the
    // status belongs to the caller here, never to the host process.
    const host = (globalThis as { process?: { exitCode?: number | string } }).process
    const hostExitCode = host?.exitCode
    let status: number
    try {
        status = module.callMain(args)
    } catch (error) {
        const exit = error as { name?: string; status?: number }
        if (exit?.name !== 'ExitStatus' || typeof exit.status !== 'number') throw error
        status = exit.status
    } finally {
        if (host) host.exitCode = hostExitCode
    }

    const read = new Map<string, Uint8Array>()
    for (const path of outputs) {
        const full = `${WORK_DIRECTORY}/${path}`
        if (module.FS.analyzePath(full).exists) read.set(path, module.FS.readFile(full))
    }
    return { status, stdout, stderr, outputs: read }
}

/** Assembly Files by extension, which are the ones the assembler is pointed at. */
export function isAssemblyPath(path: string): boolean {
    return /\.(s|S|asm)$/.test(path)
}

/**
 * The Files that are translation units: the Entry, and every other assembly File that no
 * assembly File `.include`s. Included Files are assembled as part of whatever includes them.
 */
export function translationUnits(project: ArmProject): string[] {
    const included = new Set<string>()
    for (const [path, content] of Object.entries(project.files)) {
        if (!isAssemblyPath(path) || typeof content !== 'string') continue
        const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
        for (const match of content.matchAll(/^\s*\.include\s+"([^"]+)"/gm)) {
            const target = match[1]!
            for (const candidate of [normalizePath(directory + target), normalizePath(target)]) {
                if (candidate in project.files) included.add(candidate)
            }
        }
    }
    const units = [project.entry]
    for (const path of Object.keys(project.files).sort()) {
        if (path !== project.entry && isAssemblyPath(path) && !included.has(path)) units.push(path)
    }
    return units
}

export function normalizePath(path: string): string {
    const parts: string[] = []
    for (const part of path.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

export type AssembledUnit = { path: string; object: Uint8Array }

export type AssembleResult = {
    units: AssembledUnit[]
    diagnostics: ArmDiagnostic[]
    ok: boolean
}

/** Assembles every translation unit with line information (`-g`) for the debugger. */
export async function assembleProject(project: ArmProject): Promise<AssembleResult> {
    const diagnostics: ArmDiagnostic[] = []
    const units: AssembledUnit[] = []
    let ok = true
    for (const path of translationUnits(project)) {
        if (!(path in project.files)) {
            diagnostics.push(projectDiagnostic(`The Entry File ${path} does not exist`, project.entry))
            ok = false
            continue
        }
        const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.'
        const objectPath = `${path}.o`
        const run = await runTool(
            createAssembler,
            'arm-as',
            [...ASSEMBLER_FLAGS, '-g', '-I', directory, '-o', objectPath, path],
            project.files,
            [objectPath],
        )
        diagnostics.push(...parseAssemblerOutput(run.stderr, project))
        const object = run.outputs.get(objectPath)
        if (run.status !== 0 || !object) {
            ok = false
            continue
        }
        units.push({ path, object })
    }
    if (!ok && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        diagnostics.push(projectDiagnostic('The assembler failed without saying why', project.entry))
    }
    return { units, diagnostics, ok }
}

export type LinkResult = { elf: Uint8Array | null; diagnostics: ArmDiagnostic[] }

export async function linkProgram(
    units: AssembledUnit[],
    project: ArmProject,
    layout: MemoryLayout = DEFAULT_LAYOUT,
): Promise<LinkResult> {
    const files: Record<string, string | Uint8Array> = { 'link.ld': linkerScript(layout) }
    for (const unit of units) files[`${unit.path}.o`] = unit.object
    const run = await runTool(
        createLinker,
        'arm-ld',
        ['-T', 'link.ld', '-o', 'program.elf', ...units.map((unit) => `${unit.path}.o`)],
        files,
        ['program.elf'],
    )
    const diagnostics = parseLinkerOutput(run.stderr, project)
    const elf = run.status === 0 ? (run.outputs.get('program.elf') ?? null) : null
    if (!elf && !diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        diagnostics.push(projectDiagnostic('The linker failed without saying why', project.entry))
    }
    return { elf, diagnostics }
}

function projectLines(project: ArmProject, path: string): string[] {
    const content = project.files[path]
    return typeof content === 'string' ? content.split('\n') : []
}

function projectDiagnostic(message: string, file: string, source: ArmDiagnostic['source'] = 'unicorn-edu'): ArmDiagnostic {
    return {
        file,
        lineIndex: 0,
        column: 1,
        line: { line: '', line_index: 0 },
        message,
        formatted: message,
        severity: 'error',
        source,
    }
}

/**
 * The span a message is about: the first name it quotes (`foo' in "bad instruction `foo r3,r4'")
 * when the line contains it, else the line's text without its leading blanks.
 */
function locateSpan(text: string, message: string): { column: number; endColumn: number } {
    const quoted = /`([^']*)'/.exec(message)?.[1]?.trim()
    const word = quoted?.split(/[\s,]+/)[0]
    if (word) {
        const at = text.indexOf(word)
        if (at >= 0) return { column: at + 1, endColumn: at + 1 + word.length }
    }
    const start = text.search(/\S/)
    const content = text.replace(/\s*(@.*)?$/, '')
    if (start < 0 || content.length <= start) return { column: 1, endColumn: Math.max(2, text.length + 1) }
    return { column: start + 1, endColumn: content.length + 1 }
}

function sourceDiagnostic(
    project: ArmProject,
    path: string | undefined,
    line: number,
    message: string,
    severity: ArmDiagnostic['severity'],
    source: ArmDiagnostic['source'],
): ArmDiagnostic {
    const file = path && path in project.files ? path : project.entry
    const lines = projectLines(project, file)
    const lineIndex = Math.max(0, Math.min(line, Math.max(0, lines.length - 1)))
    const text = lines[lineIndex] ?? ''
    const span = locateSpan(text, message)
    return {
        file,
        lineIndex,
        column: span.column,
        endColumn: span.endColumn,
        line: { line: text, line_index: lineIndex },
        message,
        formatted: `${file}:${lineIndex + 1}: ${severity}: ${message}`,
        severity,
        source,
    }
}

/** `main.s:4: Error: bad instruction ...` and `main.s: Error: ...`, as GNU as prints them. */
export function parseAssemblerOutput(stderr: string, project: ArmProject): ArmDiagnostic[] {
    const diagnostics: ArmDiagnostic[] = []
    for (const raw of stderr.split('\n')) {
        const line = raw.trimEnd()
        const located = /^(.+?):(\d+): (Error|Warning): (.*)$/.exec(line)
        if (located) {
            diagnostics.push(
                sourceDiagnostic(
                    project,
                    normalizePath(located[1]!),
                    Number(located[2]) - 1,
                    located[4]!,
                    located[3] === 'Error' ? 'error' : 'warning',
                    'as',
                ),
            )
            continue
        }
        const unlocated = /^(.+?): (Error|Warning): (.*)$/.exec(line)
        if (unlocated) {
            diagnostics.push(
                sourceDiagnostic(
                    project,
                    normalizePath(unlocated[1]!),
                    0,
                    unlocated[3]!,
                    unlocated[2] === 'Error' ? 'error' : 'warning',
                    'as',
                ),
            )
        }
    }
    return diagnostics
}

/**
 * GNU ld's messages: `main.s:5:(.text+0x4): undefined reference to 'f'`, `x.s:4: multiple
 * definition of ...`, and unlocated ones. The missing-`_start` warning is not reported, because
 * the emulator then starts at `main`.
 */
export function parseLinkerOutput(stderr: string, project: ArmProject): ArmDiagnostic[] {
    const diagnostics: ArmDiagnostic[] = []
    for (const raw of stderr.split('\n')) {
        const line = raw.trimEnd().replace(/^ld: /, '')
        if (!line || /: in function `[^']*':$/.test(line) || /^.*: in function/.test(line)) continue
        if (/cannot find entry symbol _start/.test(line)) continue
        const located = /^(.+?):(\d+):(?:\([^)]*\):)? (.*)$/.exec(line)
        if (located && !/\.o$/.test(located[1]!)) {
            const message = located[3]!
            diagnostics.push(
                sourceDiagnostic(
                    project,
                    normalizePath(located[1]!),
                    Number(located[2]) - 1,
                    message.replace(/^(warning|error): /, ''),
                    /^warning: /.test(message) ? 'warning' : 'error',
                    'ld',
                ),
            )
            continue
        }
        const warning = /^warning: (.*)$/.exec(line)
        const message = warning ? warning[1]! : line.replace(/^error: /, '')
        diagnostics.push({
            ...projectDiagnostic(message, project.entry, 'ld'),
            severity: warning ? 'warning' : 'error',
            formatted: `ld: ${line}`,
        })
    }
    return diagnostics
}
