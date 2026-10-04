// Loads the built package the way a consumer would, outside vitest: `npm run build` first.
import { createArmEmulator } from '../dist/index.mjs'

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
console.log('dist smoke test passed')
