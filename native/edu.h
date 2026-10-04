/*
 * unicorn-edu: the debugger layer an educational IDE needs on top of Unicorn.
 *
 * Unicorn executes; this layer decides when it stops and remembers what each step
 * changed. Everything that has to happen once per instruction (counting the slice's
 * budget, checking breakpoints, journaling the step for Undo, following calls and
 * returns) runs here, in C, so that no instruction ever crosses into JavaScript.
 * JavaScript sees the machine between two instructions only: after a run stopped on its
 * budget, on a breakpoint, on an interrupt the host has to answer (an `svc`), on an error,
 * or because the program halted.
 *
 * Addresses and register values cross the boundary as 64-bit integers so that the same
 * layer serves 64-bit architectures. Register ids are Unicorn's (`UC_ARM_REG_*`).
 */
#ifndef UNICORN_EDU_H
#define UNICORN_EDU_H

#include <stdint.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define EDU_API EMSCRIPTEN_KEEPALIVE
#else
#define EDU_API
#endif

typedef struct edu_machine edu_machine;

/* Why the last `edu_run` returned. */
enum edu_stop_reason {
    EDU_STOP_NONE = 0,
    /* The run executed the whole budget it was given. */
    EDU_STOP_BUDGET = 1,
    /* The next instruction is one a breakpoint names; it has not executed. */
    EDU_STOP_BREAKPOINT = 2,
    /* The program raised an exception the host answers (`svc`, `bkpt`, `udf`); see
       `edu_interrupt_number`. The PC is already past the instruction that raised it. */
    EDU_STOP_INTERRUPT = 3,
    /* Unicorn refused to continue (unmapped access, invalid instruction...); see
       `edu_error`. The PC is on the instruction that failed. */
    EDU_STOP_ERROR = 4,
    /* Emulation ended without any of the above, such as on a `wfi`. */
    EDU_STOP_HALT = 5,
};

/* What a history entry records. */
enum edu_entry_kind {
    EDU_ENTRY_INSTRUCTION = 0,
    /* Values the host wrote between two instructions, inside edu_poke_begin/end. */
    EDU_ENTRY_POKE = 1,
};

enum edu_frame_op {
    EDU_FRAME_NONE = 0,
    EDU_FRAME_PUSH = 1,
    EDU_FRAME_POP = 2,
};

/* --- lifecycle ---------------------------------------------------------------------- */

/* A machine for `arch`/`mode` (Unicorn's UC_ARCH_*, UC_MODE_*): UC_ARCH_ARM or UC_ARCH_ARM64.
   `cpu_model` is a UC_CPU_* value, or -1 for Unicorn's default (Cortex-A15, Cortex-A72).
   32-bit ARM starts with VFP/NEON enabled, as AArch64 starts with FP/SIMD.
   Returns NULL on failure; `edu_last_create_error` says why. */
EDU_API edu_machine *edu_create(int arch, int mode, int cpu_model);
EDU_API int edu_last_create_error(void);
EDU_API void edu_destroy(edu_machine *m);
EDU_API const char *edu_strerror(int error);

/* --- memory ------------------------------------------------------------------------- */

/* Maps `size` bytes at `address` (both page aligned) with UC_PROT_* `perms`. */
EDU_API int edu_map(edu_machine *m, uint64_t address, uint64_t size, uint32_t perms);
/* Reads `length` bytes. Bytes outside any mapping read as zero; returns how many did. */
EDU_API uint32_t edu_read_memory(edu_machine *m, uint64_t address, uint8_t *out,
                                 uint32_t length);
/* Writes `length` bytes and drops any translated code they overlap. With `journal`, the
   bytes they replace join the newest history entry (an open Poke, or the instruction a
   system call is answering), so that undoing it puts them back. */
EDU_API int edu_write_memory(edu_machine *m, uint64_t address, const uint8_t *data,
                             uint32_t length, int journal);

/* --- registers ---------------------------------------------------------------------- */

/* Reads `count` registers, each into a 64-bit slot (narrower ones zero-extended). */
EDU_API int edu_read_registers(edu_machine *m, const int *ids, uint32_t count,
                               uint64_t *out);
/* Raw access for registers wider than 64 bits (Q registers): `size` bytes, little endian. */
EDU_API int edu_read_register_bytes(edu_machine *m, int id, uint8_t *out, uint32_t size);
/* Writes one register from `size` little-endian bytes. With `journal`, the old value
   joins the newest history entry, as for memory. */
EDU_API int edu_write_register_bytes(edu_machine *m, int id, const uint8_t *data,
                                     uint32_t size, int journal);
EDU_API int edu_write_register(edu_machine *m, int id, uint64_t value, int journal);

/* --- running ------------------------------------------------------------------------ */

/* Runs at most `budget` instructions from the current PC (Thumb state included) and
   returns an `edu_stop_reason`. A breakpoint on the instruction the run starts on is
   ignored when `skip_breakpoint_at_pc` is set, which is what lets a Run continue from the
   breakpoint it is parked on. */
EDU_API int edu_run(edu_machine *m, uint64_t budget, int skip_breakpoint_at_pc);
/* Instructions the last run executed, including one that faulted. */
EDU_API uint64_t edu_executed(edu_machine *m);
EDU_API int edu_stop_reason(edu_machine *m);
EDU_API int edu_interrupt_number(edu_machine *m);
EDU_API int edu_error(edu_machine *m);
/* The address of the last instruction executed, or of the one that faulted; 0 when nothing
   ran since the program was loaded or the last Undo emptied the history. */
EDU_API int edu_last_instruction(edu_machine *m, uint64_t *address);

/* Instruction addresses to stop before. Replaces the previous set. */
EDU_API int edu_set_breakpoints(edu_machine *m, const uint64_t *addresses, uint32_t count);

/* Which instructions may change the floating-point registers, one bit per halfword from
   `base`. History saves those registers only around such instructions, which is what
   keeps journaling cheap for programs that do not use floating point. */
EDU_API int edu_set_fp_map(edu_machine *m, uint64_t base, const uint8_t *bits,
                           uint32_t halfwords);

/* --- history and Undo ---------------------------------------------------------------- */

/* Keeps the newest `capacity` steps (0 turns history off) and clears what was kept. */
EDU_API int edu_set_history(edu_machine *m, uint32_t capacity);
EDU_API uint32_t edu_history_length(edu_machine *m);
EDU_API int edu_can_undo(edu_machine *m);
/* Reverts the newest entry: its memory writes, register writes, registers and call-stack
   change. Returns 1 when something was undone. */
EDU_API int edu_undo(edu_machine *m);
/* Serializes up to `max_entries` entries, newest first, into `buffer` (format in
   ts/src/machine.ts). Returns the bytes needed; nothing is written when that is more
   than `size`. */
EDU_API uint32_t edu_history_export(edu_machine *m, uint32_t max_entries, uint8_t *buffer,
                                    uint32_t size);

/* Opens a Poke: register and memory writes made with `journal` until edu_poke_end become
   one entry of the history. */
EDU_API int edu_poke_begin(edu_machine *m);
/* Closes it; returns 1 when an entry was recorded (nothing changed, or history off: 0). */
EDU_API int edu_poke_end(edu_machine *m);

/* --- call stack ----------------------------------------------------------------------- */

EDU_API uint32_t edu_call_depth(edu_machine *m);
/* Frames, outermost first: target, return address, sp after the call, call site (u64 each).
   Returns the bytes needed, as edu_history_export does. */
EDU_API uint32_t edu_call_stack_export(edu_machine *m, uint8_t *buffer, uint32_t size);

#endif
