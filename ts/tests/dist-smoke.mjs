// Loads the built package the way a consumer would, outside vitest: `npm run build` first.
import { createAarch64Emulator, createArmEmulator } from '../dist/index.mjs'

let stdout = ''
const emulator = await createArmEmulator({ stdout: (text) => (stdout += text) })
const result = await emulator.compile(`
    .data
message: .asciz "dist ok\\n"
    .text
    .global _start
_start:
    mov r0, #1
    ldr r1, =message
    mov r2, #8
    mov r7, #4
    svc #0
    mov r0, #7
    mov r7, #1
    svc #0
`)
if (!result.ok) throw new Error(result.report)
emulator.initialize(100)
const run = await emulator.run(1000)
if (run.kind !== 'exit' || run.exitCode !== 7 || stdout !== 'dist ok\n') {
    throw new Error(`unexpected result ${JSON.stringify({ run, stdout })}`)
}
let stdout64 = ''
const aarch64 = await createAarch64Emulator({ stdout: (text) => (stdout64 += text) })
const built = await aarch64.compile(`
    .data
message: .asciz "dist ok\\n"
    .text
    .global _start
_start:
    mov x0, #1
    adr x1, message
    mov x2, #8
    mov x8, #64
    svc #0
    mov x0, #9
    mov x8, #93
    svc #0
`)
if (!built.ok) throw new Error(built.report)
aarch64.initialize(100)
const run64 = await aarch64.run(1000)
if (run64.kind !== 'exit' || run64.exitCode !== 9 || stdout64 !== 'dist ok\n') {
    throw new Error(`unexpected AArch64 result ${JSON.stringify({ run64, stdout64 })}`)
}
console.log('dist smoke test passed (arm, aarch64)')
