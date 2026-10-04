/**
 * Unicorn 2.1.4 (AArch64, under QEMU's TCG interpreter) with the debugger layer of
 * native/edu.c, built by `scripts/build-unicorn.sh aarch64`. The same interface as the ARM module.
 */
import type { MachineModule, MachineModuleOptions } from './machine-arm.mjs'

export type { MachineModule, MachineModuleOptions }

export default function createMachineModule(options?: MachineModuleOptions): Promise<MachineModule>
