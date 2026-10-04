import type { ToolModuleFactory } from './tool-module'

/** GNU ld 2.45 for arm-none-eabi, built by scripts/build-binutils.sh. One instance per run. */
declare const createLinker: ToolModuleFactory
export default createLinker
