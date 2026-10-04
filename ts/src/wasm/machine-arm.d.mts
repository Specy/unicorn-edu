/**
 * Unicorn 2.1.4 (ARM, under QEMU's TCG interpreter) with the debugger layer of native/edu.c,
 * built by scripts/build-unicorn.sh. One module instance hosts any number of machines; every
 * function takes the machine pointer `edu_create` returned. 64-bit values are BigInts.
 */
export interface MachineModule {
    HEAPU8: Uint8Array
    HEAP32: Int32Array
    HEAPU32: Uint32Array
    HEAPF64: Float64Array
    UTF8ToString(pointer: number): string
    _malloc(size: number): number
    _free(pointer: number): void

    _edu_create(arch: number, mode: number, cpuModel: number): number
    _edu_last_create_error(): number
    _edu_destroy(machine: number): void
    _edu_strerror(error: number): number

    _edu_map(machine: number, address: bigint, size: bigint, perms: number): number
    _edu_read_memory(machine: number, address: bigint, out: number, length: number): number
    _edu_write_memory(
        machine: number,
        address: bigint,
        data: number,
        length: number,
        journal: number,
    ): number

    _edu_read_registers(machine: number, ids: number, count: number, out: number): number
    _edu_read_register_bytes(machine: number, id: number, out: number, size: number): number
    _edu_write_register_bytes(
        machine: number,
        id: number,
        data: number,
        size: number,
        journal: number,
    ): number
    _edu_write_register(machine: number, id: number, value: bigint, journal: number): number

    _edu_run(machine: number, budget: bigint, skipBreakpointAtPc: number): number
    _edu_executed(machine: number): bigint
    _edu_stop_reason(machine: number): number
    _edu_interrupt_number(machine: number): number
    _edu_error(machine: number): number
    _edu_last_instruction(machine: number, out: number): number
    _edu_set_breakpoints(machine: number, addresses: number, count: number): number
    _edu_set_fp_map(machine: number, base: bigint, bits: number, halfwords: number): number

    _edu_set_history(machine: number, capacity: number): number
    _edu_history_length(machine: number): number
    _edu_can_undo(machine: number): number
    _edu_undo(machine: number): number
    _edu_history_export(machine: number, maxEntries: number, buffer: number, size: number): number
    _edu_poke_begin(machine: number): number
    _edu_poke_end(machine: number): number

    _edu_call_depth(machine: number): number
    _edu_call_stack_export(machine: number, buffer: number, size: number): number
}

export interface MachineModuleOptions {
    instantiateWasm?: (
        imports: WebAssembly.Imports,
        receiveInstance: (instance: WebAssembly.Instance, module?: WebAssembly.Module) => void,
    ) => WebAssembly.Exports | Record<string, never>
    locateFile?: (path: string, prefix: string) => string
}

export default function createMachineModule(options?: MachineModuleOptions): Promise<MachineModule>
