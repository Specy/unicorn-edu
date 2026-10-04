import { it } from 'vitest'
import { load, loadAarch64 } from './helpers'

/**
 * Instructions per second for a loop of add/eor/str/cmp/branch, run the way an IDE runs a program:
 * slices of a fixed instruction budget. Best of five, because a single pass on a shared machine
 * swings by tens of percent.
 */
const ITERATIONS = 400_000
const INSTRUCTIONS = 3 + 5 * ITERATIONS + 3

const ARM_SOURCE = `
    .data
cell: .word 0
    .text
    .global _start
_start:
    mov r0, #0
    ldr r1, =${ITERATIONS}
    ldr r4, =cell
loop:
    add r0, r0, #1
    eor r2, r2, r0
    str r2, [r4]
    cmp r0, r1
    bne loop
    mov r0, #0
    mov r7, #1
    svc #0
`

const AARCH64_SOURCE = `
    .data
cell: .quad 0
    .text
    .global _start
_start:
    mov x0, #0
    ldr x1, =${ITERATIONS}
    adr x4, cell
loop:
    add x0, x0, #1
    eor x2, x2, x0
    str x2, [x4]
    cmp x0, x1
    b.ne loop
    mov x0, #0
    mov x8, #93
    svc #0
`

it('measures throughput', async () => {
    const rows: string[] = []
    for (const [name, loader, source] of [
        ['arm', load, ARM_SOURCE],
        ['aarch64', loadAarch64, AARCH64_SOURCE],
    ] as const) {
        for (const undo of [0, 200]) {
            for (const slice of [10_000, 100_000]) {
                let best = Infinity
                for (let repeat = 0; repeat < 5; repeat++) {
                    const { emulator } = await loader(source, { undo })
                    const start = performance.now()
                    let executed = 0
                    for (;;) {
                        const result = await emulator.run(slice)
                        executed += result.executed
                        if (result.kind !== 'limit') break
                    }
                    best = Math.min(best, performance.now() - start)
                    if (executed !== INSTRUCTIONS) throw new Error(`${name}: executed ${executed}, expected ${INSTRUCTIONS}`)
                }
                rows.push(
                    `${name.padEnd(8)} undo ${String(undo).padStart(3)}  slice ${String(slice).padStart(6)}  ` +
                        `${best.toFixed(1).padStart(7)} ms  ${(INSTRUCTIONS / best / 1000).toFixed(2).padStart(6)} M instructions/s`,
                )
            }
        }
    }
    console.log(`${INSTRUCTIONS} instructions\n${rows.join('\n')}`)
})
