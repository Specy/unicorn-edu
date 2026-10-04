/*
 * unicorn-edu debugger layer. See edu.h for the contract; this file is the how.
 *
 * Per instruction, the code hook:
 *   1. finalizes the previous instruction now that its effects are visible: a call or a
 *      return it made, and the floating-point registers it changed;
 *   2. stops before a breakpoint, unless it is the one the run started on;
 *   3. stops when the run's budget is spent;
 *   4. records the instruction in the history: the core registers before it, and (for an
 *      instruction that may touch floating point) the floating-point registers too.
 * Stores reach the history through a memory-write hook, which runs before the store and
 * so can read the bytes it replaces. Steps 1-3 run with history off too; only the
 * snapshots are skipped, which is the difference between ~11 and ~3.6 million
 * instructions a second under the TCG interpreter.
 */
#include "edu.h"

#include <stdlib.h>
#include <string.h>
#include <unicorn/unicorn.h>

#define EDU_MAX_CORE 40
#define EDU_MAX_FP 40
#define EDU_MAX_MAPPINGS 64
#define EDU_MAX_FRAMES (1u << 16)
#define EDU_UNTIL_NEVER UINT64_MAX
#define EDU_EMPTY_SLOT UINT64_MAX

typedef struct {
    uint64_t target;
    uint64_t return_address;
    uint64_t sp;
    uint64_t call_site;
} edu_frame;

typedef struct {
    uint8_t kind;
    uint8_t frame_op;
    uint8_t irreversible;
    uint8_t reserved;
    uint32_t size;
    uint64_t pc;
    uint64_t register_start;
    uint32_t register_count;
    uint32_t memory_count;
    uint64_t memory_start;
    uint64_t pool_start;
    edu_frame frame;
} edu_entry;

typedef struct {
    int32_t id;
    uint32_t size;
    uint8_t old_value[16];
    uint8_t new_value[16];
} edu_register_record;

typedef struct {
    uint64_t address;
    uint32_t length;
    uint32_t reserved;
    /* old bytes at pool[position], new bytes right after them */
    uint64_t pool_position;
} edu_memory_record;

typedef struct {
    uint64_t begin;
    uint64_t end;
} edu_mapping;

struct edu_machine {
    uc_engine *uc;
    int arch;
    uc_hook code_hook;
    uc_hook write_hook;
    uc_hook interrupt_hook;

    /* the registers an entry snapshots */
    const int *core_ids;
    uint32_t core_count;
    uint32_t core_lr_index;
    int pc_id;
    int lr_id;
    int sp_id;
    int flags_id;
    void *core_pointers[EDU_MAX_CORE];
    uint64_t core_scratch[EDU_MAX_CORE];

    /* floating-point registers, saved around instructions that may change them; 16 bytes a
       slot, the width of an AArch64 V register */
    const int *fp_ids;
    const uint8_t *fp_sizes;
    uint32_t fp_count;
    void *fp_pointers[EDU_MAX_FP];
    uint8_t fp_scratch[EDU_MAX_FP][16];
    uint8_t fp_before[EDU_MAX_FP][16];
    uint64_t fp_map_base;
    uint32_t fp_map_halfwords;
    uint8_t *fp_map;

    /* the current run */
    uint64_t executed;
    uint64_t budget;
    int stop_reason;
    int interrupt_number;
    int error;
    uint64_t skip_at;
    int skip_armed;

    /* breakpoints, an open-addressing set of instruction addresses */
    uint64_t *breakpoints;
    uint32_t breakpoint_capacity;
    uint32_t breakpoint_count;

    /* the instruction that ran last, finalized when the next one starts or the run ends */
    int have_previous;
    uint64_t previous_pc;
    uint32_t previous_size;
    int previous_recorded;
    int fp_pending;
    int have_last;
    uint64_t last_pc;

    /* history: a ring of entries, and rings of the records they own */
    uint32_t capacity;
    uint32_t head;
    uint32_t length;
    edu_entry *entries;
    uint64_t *core_pool;
    edu_register_record *register_records;
    uint64_t register_capacity;
    uint64_t register_head;
    edu_memory_record *memory_records;
    uint64_t memory_capacity;
    uint64_t memory_head;
    uint8_t *pool;
    uint64_t pool_capacity;
    uint64_t pool_head;
    int poke_open;
    int poke_recording;

    /* the shadow call stack */
    edu_frame *frames;
    uint32_t frame_capacity;
    uint32_t depth;

    edu_mapping mappings[EDU_MAX_MAPPINGS];
    uint32_t mapping_count;
};

static const int ARM_CORE_IDS[] = {
    UC_ARM_REG_R0,  UC_ARM_REG_R1,  UC_ARM_REG_R2, UC_ARM_REG_R3, UC_ARM_REG_R4,  UC_ARM_REG_R5,
    UC_ARM_REG_R6,  UC_ARM_REG_R7,  UC_ARM_REG_R8, UC_ARM_REG_R9, UC_ARM_REG_R10, UC_ARM_REG_R11,
    UC_ARM_REG_R12, UC_ARM_REG_SP,  UC_ARM_REG_LR,
    /* the PC before the CPSR: restoring the PC may change the Thumb bit, the CPSR sets it */
    UC_ARM_REG_PC,  UC_ARM_REG_CPSR,
};
#define ARM_CORE_COUNT (sizeof(ARM_CORE_IDS) / sizeof(ARM_CORE_IDS[0]))
#define ARM_FP_COUNT 33
static int arm_fp_ids[ARM_FP_COUNT];
static uint8_t arm_fp_sizes[ARM_FP_COUNT];

static const int ARM64_CORE_IDS[] = {
    UC_ARM64_REG_X0,  UC_ARM64_REG_X1,  UC_ARM64_REG_X2,  UC_ARM64_REG_X3,  UC_ARM64_REG_X4,
    UC_ARM64_REG_X5,  UC_ARM64_REG_X6,  UC_ARM64_REG_X7,  UC_ARM64_REG_X8,  UC_ARM64_REG_X9,
    UC_ARM64_REG_X10, UC_ARM64_REG_X11, UC_ARM64_REG_X12, UC_ARM64_REG_X13, UC_ARM64_REG_X14,
    UC_ARM64_REG_X15, UC_ARM64_REG_X16, UC_ARM64_REG_X17, UC_ARM64_REG_X18, UC_ARM64_REG_X19,
    UC_ARM64_REG_X20, UC_ARM64_REG_X21, UC_ARM64_REG_X22, UC_ARM64_REG_X23, UC_ARM64_REG_X24,
    UC_ARM64_REG_X25, UC_ARM64_REG_X26, UC_ARM64_REG_X27, UC_ARM64_REG_X28, UC_ARM64_REG_X29,
    UC_ARM64_REG_X30, UC_ARM64_REG_SP,  UC_ARM64_REG_PC,  UC_ARM64_REG_NZCV,
};
#define ARM64_CORE_COUNT (sizeof(ARM64_CORE_IDS) / sizeof(ARM64_CORE_IDS[0]))
#define ARM64_FP_COUNT 34
static int arm64_fp_ids[ARM64_FP_COUNT];
static uint8_t arm64_fp_sizes[ARM64_FP_COUNT];

static int last_create_error = UC_ERR_OK;

/* --- small helpers ------------------------------------------------------------------ */

static edu_entry *entry_at(edu_machine *m, uint32_t index_from_oldest) {
    return &m->entries[(m->head + index_from_oldest) % m->capacity];
}

static edu_entry *newest_entry(edu_machine *m) {
    return m->length ? entry_at(m, m->length - 1) : NULL;
}

static uint64_t *core_snapshot(edu_machine *m, edu_entry *entry) {
    return &m->core_pool[(size_t)(entry - m->entries) * m->core_count];
}

static uint64_t read_register(edu_machine *m, int id) {
    uint64_t value = 0;
    uc_reg_read(m->uc, id, &value);
    return value;
}

static uint64_t current_pc(edu_machine *m) {
    uint64_t pc = read_register(m, m->pc_id);
    if (m->arch == UC_ARCH_ARM && (read_register(m, m->flags_id) & (1u << 5))) pc |= 1;
    return pc;
}

static void pool_put(edu_machine *m, uint64_t position, const uint8_t *bytes, uint32_t length) {
    for (uint32_t done = 0; done < length;) {
        uint64_t at = (position + done) % m->pool_capacity;
        uint64_t run = m->pool_capacity - at;
        if (run > length - done) run = length - done;
        memcpy(m->pool + at, bytes + done, run);
        done += (uint32_t)run;
    }
}

static void pool_get(edu_machine *m, uint64_t position, uint8_t *bytes, uint32_t length) {
    for (uint32_t done = 0; done < length;) {
        uint64_t at = (position + done) % m->pool_capacity;
        uint64_t run = m->pool_capacity - at;
        if (run > length - done) run = length - done;
        memcpy(bytes + done, m->pool + at, run);
        done += (uint32_t)run;
    }
}

/* --- call stack ----------------------------------------------------------------------- */

static void push_frame(edu_machine *m, edu_frame frame) {
    if (m->depth == m->frame_capacity) {
        if (m->frame_capacity < EDU_MAX_FRAMES) {
            uint32_t capacity = m->frame_capacity ? m->frame_capacity * 2 : 64;
            edu_frame *frames = realloc(m->frames, capacity * sizeof(edu_frame));
            if (!frames) return;
            m->frames = frames;
            m->frame_capacity = capacity;
        } else {
            /* runaway recursion: forget the outermost frame rather than the newest */
            memmove(m->frames, m->frames + 1, (m->depth - 1) * sizeof(edu_frame));
            m->depth--;
        }
    }
    m->frames[m->depth++] = frame;
}

/* --- history ---------------------------------------------------------------------------- */

static void evict_oldest(edu_machine *m) {
    m->head = (m->head + 1) % m->capacity;
    m->length--;
}

/* Makes room for records of the newest entry by forgetting the oldest entries; fails when
   the newest entry alone would not fit. */
static int ensure_room(edu_machine *m, uint64_t registers, uint64_t memories, uint64_t bytes) {
    for (;;) {
        edu_entry *oldest = m->length ? entry_at(m, 0) : NULL;
        uint64_t register_tail = oldest ? oldest->register_start : m->register_head;
        uint64_t memory_tail = oldest ? oldest->memory_start : m->memory_head;
        uint64_t pool_tail = oldest ? oldest->pool_start : m->pool_head;
        if (m->register_head + registers - register_tail <= m->register_capacity &&
            m->memory_head + memories - memory_tail <= m->memory_capacity &&
            m->pool_head + bytes - pool_tail <= m->pool_capacity) {
            return 1;
        }
        if (m->length <= 1) return 0;
        evict_oldest(m);
    }
}

static edu_entry *push_entry(edu_machine *m, int kind, uint64_t pc, uint32_t size) {
    if (m->length == m->capacity) evict_oldest(m);
    m->length++;
    edu_entry *entry = newest_entry(m);
    memset(entry, 0, sizeof(*entry));
    entry->kind = (uint8_t)kind;
    entry->pc = pc;
    entry->size = size;
    entry->register_start = m->register_head;
    entry->memory_start = m->memory_head;
    entry->pool_start = m->pool_head;
    memcpy(core_snapshot(m, entry), m->core_scratch, m->core_count * sizeof(uint64_t));
    return entry;
}

static void append_register_record(edu_machine *m, edu_entry *entry, int id, uint32_t size,
                                   const void *old_value, const void *new_value) {
    if (entry->irreversible) return;
    if (size > 16 || !ensure_room(m, 1, 0, 0)) {
        entry->irreversible = 1;
        return;
    }
    edu_register_record *record = &m->register_records[m->register_head % m->register_capacity];
    memset(record, 0, sizeof(*record));
    record->id = id;
    record->size = size;
    memcpy(record->old_value, old_value, size);
    memcpy(record->new_value, new_value, size);
    m->register_head++;
    entry->register_count++;
}

static void append_memory_record(edu_machine *m, edu_entry *entry, uint64_t address,
                                 uint32_t length, const uint8_t *old_bytes,
                                 const uint8_t *new_bytes) {
    if (entry->irreversible) return;
    if (!ensure_room(m, 0, 1, (uint64_t)length * 2)) {
        entry->irreversible = 1;
        return;
    }
    edu_memory_record *record = &m->memory_records[m->memory_head % m->memory_capacity];
    record->address = address;
    record->length = length;
    record->reserved = 0;
    record->pool_position = m->pool_head;
    pool_put(m, m->pool_head, old_bytes, length);
    pool_put(m, m->pool_head + length, new_bytes, length);
    m->pool_head += (uint64_t)length * 2;
    m->memory_head++;
    entry->memory_count++;
}

/* The entry a journaled host write belongs to: the open Poke, or else the instruction the
   host is answering (the newest one). None when history is off. */
static edu_entry *journal_target(edu_machine *m) {
    if (!m->capacity || !m->length) return NULL;
    if (m->poke_open && !m->poke_recording) return NULL;
    return newest_entry(m);
}

static int is_fp_instruction(edu_machine *m, uint64_t address) {
    if (!m->fp_count) return 0;
    /* outside the map (or with no map) the conservative answer is yes */
    if (!m->fp_map || address < m->fp_map_base) return 1;
    uint64_t halfword = (address - m->fp_map_base) >> 1;
    if (halfword >= m->fp_map_halfwords) return 1;
    return (m->fp_map[halfword >> 3] >> (halfword & 7)) & 1;
}

/* --- per-instruction work ------------------------------------------------------------------ */

/* `lr` is the link register now when the caller has it at hand, or NULL to read it only if needed. */
static void finalize_previous(edu_machine *m, uint64_t pc, const uint64_t *lr_now) {
    edu_entry *entry = (m->capacity && m->previous_recorded) ? newest_entry(m) : NULL;
    uint64_t next = m->previous_pc + m->previous_size;
    uint64_t target = pc & ~1ULL;
    /* Calls and returns are control transfers, so straight-line code costs no register read.
       A call left the return address in LR and went somewhere else. Whether LR changed does
       not matter: a loop calling the same function from the same site leaves it holding that
       return address already. */
    uint64_t lr = 0;
    if (target != next) lr = lr_now ? *lr_now : read_register(m, m->lr_id);
    if (target != next && (lr & ~1ULL) == next) {
        edu_frame frame = {target, next, read_register(m, m->sp_id), m->previous_pc};
        push_frame(m, frame);
        if (entry) {
            entry->frame_op = EDU_FRAME_PUSH;
            entry->frame = frame;
        }
    } else if (target != next && m->depth &&
               target == (m->frames[m->depth - 1].return_address & ~1ULL)) {
        edu_frame frame = m->frames[--m->depth];
        if (entry) {
            entry->frame_op = EDU_FRAME_POP;
            entry->frame = frame;
        }
    }
    if (m->fp_pending) {
        m->fp_pending = 0;
        if (entry) {
            uc_reg_read_batch(m->uc, (int *)m->fp_ids, m->fp_pointers, (int)m->fp_count);
            for (uint32_t i = 0; i < m->fp_count; i++) {
                if (!memcmp(m->fp_scratch[i], m->fp_before[i], m->fp_sizes[i])) continue;
                append_register_record(m, entry, m->fp_ids[i], m->fp_sizes[i], m->fp_before[i],
                                       m->fp_scratch[i]);
            }
        }
    }
    m->have_previous = 0;
    m->previous_recorded = 0;
}

static void on_code(uc_engine *uc, uint64_t address, uint32_t size, void *user) {
    edu_machine *m = user;
    int recording = m->capacity > 0;
    if (recording) {
        uc_reg_read_batch(uc, (int *)m->core_ids, m->core_pointers, (int)m->core_count);
    }
    if (m->have_previous) {
        finalize_previous(m, address, recording ? &m->core_scratch[m->core_lr_index] : NULL);
    }

    if (m->breakpoint_count) {
        uint32_t mask = m->breakpoint_capacity - 1;
        for (uint32_t slot = (uint32_t)((address >> 1) * 2654435761u) & mask;;
             slot = (slot + 1) & mask) {
            uint64_t candidate = m->breakpoints[slot];
            if (candidate == EDU_EMPTY_SLOT) break;
            if (candidate != address) continue;
            if (m->skip_armed && address == m->skip_at) break;
            m->stop_reason = EDU_STOP_BREAKPOINT;
            uc_emu_stop(uc);
            return;
        }
    }
    m->skip_armed = 0;
    if (m->executed >= m->budget) {
        m->stop_reason = EDU_STOP_BUDGET;
        uc_emu_stop(uc);
        return;
    }
    m->executed++;

    if (recording) {
        push_entry(m, EDU_ENTRY_INSTRUCTION, address, size);
        m->previous_recorded = 1;
        if (is_fp_instruction(m, address)) {
            uc_reg_read_batch(uc, (int *)m->fp_ids, m->fp_pointers, (int)m->fp_count);
            memcpy(m->fp_before, m->fp_scratch, sizeof(m->fp_before));
            m->fp_pending = 1;
        }
    }
    m->have_previous = 1;
    m->previous_pc = address;
    m->previous_size = size;
    m->have_last = 1;
    m->last_pc = address;
}

static void on_write(uc_engine *uc, uc_mem_type type, uint64_t address, int size,
                     int64_t value, void *user) {
    edu_machine *m = user;
    (void)type;
    /* every store during emulation belongs to the instruction recorded last */
    if (!m->capacity || !m->have_previous || !m->previous_recorded) return;
    edu_entry *entry = newest_entry(m);
    uint8_t old_bytes[8];
    uint8_t new_bytes[8];
    uint32_t length = size > 8 ? 8 : (uint32_t)size;
    if (size > 8) entry->irreversible = 1;
    if (uc_mem_read(uc, address, old_bytes, length) != UC_ERR_OK) return;
    for (uint32_t i = 0; i < length; i++) new_bytes[i] = (uint8_t)((uint64_t)value >> (8 * i));
    append_memory_record(m, entry, address, length, old_bytes, new_bytes);
}

static void on_interrupt(uc_engine *uc, uint32_t number, void *user) {
    edu_machine *m = user;
    m->interrupt_number = (int)number;
    m->stop_reason = EDU_STOP_INTERRUPT;
    uc_emu_stop(uc);
}

static void finalize_after_run(edu_machine *m) {
    if (!m->have_previous) return;
    finalize_previous(m, read_register(m, m->pc_id), NULL);
}

/* --- lifecycle ------------------------------------------------------------------------------ */

EDU_API int edu_last_create_error(void) { return last_create_error; }

EDU_API const char *edu_strerror(int error) { return uc_strerror((uc_err)error); }

static void free_history(edu_machine *m) {
    free(m->entries);
    free(m->core_pool);
    free(m->register_records);
    free(m->memory_records);
    free(m->pool);
    m->entries = NULL;
    m->core_pool = NULL;
    m->register_records = NULL;
    m->memory_records = NULL;
    m->pool = NULL;
    m->capacity = m->head = m->length = 0;
    m->register_capacity = m->register_head = 0;
    m->memory_capacity = m->memory_head = 0;
    m->pool_capacity = m->pool_head = 0;
}

EDU_API edu_machine *edu_create(int arch, int mode, int cpu_model) {
    uc_engine *uc = NULL;
    uc_err err = uc_open((uc_arch)arch, (uc_mode)mode, &uc);
    if (err != UC_ERR_OK) {
        last_create_error = err;
        return NULL;
    }
    if (cpu_model >= 0 && (err = uc_ctl_set_cpu_model(uc, cpu_model)) != UC_ERR_OK) {
        uc_close(uc);
        last_create_error = err;
        return NULL;
    }
    edu_machine *m = calloc(1, sizeof(edu_machine));
    if (!m) {
        uc_close(uc);
        last_create_error = UC_ERR_NOMEM;
        return NULL;
    }
    m->uc = uc;
    m->arch = arch;
    switch (arch) {
    case UC_ARCH_ARM: {
        m->core_ids = ARM_CORE_IDS;
        m->core_count = ARM_CORE_COUNT;
        m->core_lr_index = 14;
        m->pc_id = UC_ARM_REG_PC;
        m->lr_id = UC_ARM_REG_LR;
        m->sp_id = UC_ARM_REG_SP;
        m->flags_id = UC_ARM_REG_CPSR;
        for (int i = 0; i < 32; i++) {
            arm_fp_ids[i] = UC_ARM_REG_D0 + i;
            arm_fp_sizes[i] = 8;
        }
        arm_fp_ids[32] = UC_ARM_REG_FPSCR;
        arm_fp_sizes[32] = 4;
        m->fp_ids = arm_fp_ids;
        m->fp_sizes = arm_fp_sizes;
        m->fp_count = ARM_FP_COUNT;
        /* VFP and NEON are off at reset: grant cp10/cp11 in CPACR and set FPEXC.EN */
        uint64_t cpacr = read_register(m, UC_ARM_REG_C1_C0_2) | (0xFu << 20);
        uint64_t fpexc = 1u << 30;
        uc_reg_write(uc, UC_ARM_REG_C1_C0_2, &cpacr);
        uc_reg_write(uc, UC_ARM_REG_FPEXC, &fpexc);
        break;
    }
    case UC_ARCH_ARM64: {
        m->core_ids = ARM64_CORE_IDS;
        m->core_count = ARM64_CORE_COUNT;
        m->core_lr_index = 30;
        m->pc_id = UC_ARM64_REG_PC;
        m->lr_id = UC_ARM64_REG_X30;
        m->sp_id = UC_ARM64_REG_SP;
        m->flags_id = UC_ARM64_REG_NZCV;
        for (int i = 0; i < 32; i++) {
            arm64_fp_ids[i] = UC_ARM64_REG_V0 + i;
            arm64_fp_sizes[i] = 16;
        }
        arm64_fp_ids[32] = UC_ARM64_REG_FPCR;
        arm64_fp_sizes[32] = 4;
        arm64_fp_ids[33] = UC_ARM64_REG_FPSR;
        arm64_fp_sizes[33] = 4;
        m->fp_ids = arm64_fp_ids;
        m->fp_sizes = arm64_fp_sizes;
        m->fp_count = ARM64_FP_COUNT;
        /* floating point and SIMD are enabled at reset */
        break;
    }
    default:
        uc_close(uc);
        free(m);
        last_create_error = UC_ERR_ARCH;
        return NULL;
    }
    for (uint32_t i = 0; i < EDU_MAX_CORE; i++) m->core_pointers[i] = &m->core_scratch[i];
    for (uint32_t i = 0; i < EDU_MAX_FP; i++) m->fp_pointers[i] = m->fp_scratch[i];
    m->interrupt_number = -1;
    err = uc_hook_add(uc, &m->code_hook, UC_HOOK_CODE, (void *)on_code, m, 1, 0);
    if (err == UC_ERR_OK) {
        err = uc_hook_add(uc, &m->interrupt_hook, UC_HOOK_INTR, (void *)on_interrupt, m, 1, 0);
    }
    if (err != UC_ERR_OK) {
        uc_close(uc);
        free(m);
        last_create_error = err;
        return NULL;
    }
    return m;
}

EDU_API void edu_destroy(edu_machine *m) {
    if (!m) return;
    uc_close(m->uc);
    free_history(m);
    free(m->breakpoints);
    free(m->fp_map);
    free(m->frames);
    free(m);
}

/* --- memory ---------------------------------------------------------------------------------- */

EDU_API int edu_map(edu_machine *m, uint64_t address, uint64_t size, uint32_t perms) {
    if (m->mapping_count == EDU_MAX_MAPPINGS) return UC_ERR_NOMEM;
    uc_err err = uc_mem_map(m->uc, address, size, perms);
    if (err != UC_ERR_OK) return err;
    m->mappings[m->mapping_count].begin = address;
    m->mappings[m->mapping_count].end = address + size;
    m->mapping_count++;
    return UC_ERR_OK;
}

EDU_API uint32_t edu_read_memory(edu_machine *m, uint64_t address, uint8_t *out,
                                 uint32_t length) {
    memset(out, 0, length);
    uint64_t end = address + length;
    uint32_t unmapped = length;
    for (uint32_t i = 0; i < m->mapping_count; i++) {
        uint64_t begin = m->mappings[i].begin > address ? m->mappings[i].begin : address;
        uint64_t stop = m->mappings[i].end < end ? m->mappings[i].end : end;
        if (begin >= stop) continue;
        if (uc_mem_read(m->uc, begin, out + (begin - address), stop - begin) == UC_ERR_OK) {
            unmapped -= (uint32_t)(stop - begin);
        }
    }
    return unmapped;
}

EDU_API int edu_write_memory(edu_machine *m, uint64_t address, const uint8_t *data,
                             uint32_t length, int journal) {
    if (!length) return UC_ERR_OK;
    edu_entry *entry = journal ? journal_target(m) : NULL;
    if (entry) {
        uint8_t *old_bytes = malloc(length);
        if (!old_bytes) return UC_ERR_NOMEM;
        uc_err err = uc_mem_read(m->uc, address, old_bytes, length);
        if (err != UC_ERR_OK) {
            free(old_bytes);
            return err;
        }
        append_memory_record(m, entry, address, length, old_bytes, data);
        free(old_bytes);
    }
    uc_err err = uc_mem_write(m->uc, address, data, length);
    if (err != UC_ERR_OK) return err;
    /* translated code over these bytes would otherwise keep running the old instructions */
    return uc_ctl_remove_cache(m->uc, address, address + (uint64_t)length);
}

/* --- registers ----------------------------------------------------------------------------- */

EDU_API int edu_read_registers(edu_machine *m, const int *ids, uint32_t count, uint64_t *out) {
    for (uint32_t i = 0; i < count; i++) {
        uint64_t value[2] = {0, 0};
        uc_err err = uc_reg_read(m->uc, ids[i], value);
        if (err != UC_ERR_OK) return err;
        out[i] = value[0];
    }
    return UC_ERR_OK;
}

EDU_API int edu_read_register_bytes(edu_machine *m, int id, uint8_t *out, uint32_t size) {
    uint8_t value[64] = {0};
    uc_err err = uc_reg_read(m->uc, id, value);
    if (err != UC_ERR_OK) return err;
    memcpy(out, value, size > sizeof(value) ? sizeof(value) : size);
    return UC_ERR_OK;
}

EDU_API int edu_write_register_bytes(edu_machine *m, int id, const uint8_t *data,
                                     uint32_t size, int journal) {
    uint8_t value[64] = {0};
    if (size > 16) return UC_ERR_ARG;
    memcpy(value, data, size);
    edu_entry *entry = journal ? journal_target(m) : NULL;
    if (entry) {
        uint8_t old_value[64] = {0};
        uc_err err = uc_reg_read(m->uc, id, old_value);
        if (err != UC_ERR_OK) return err;
        append_register_record(m, entry, id, size, old_value, value);
    }
    return uc_reg_write(m->uc, id, value);
}

/* How many bytes a register holds, so that a journal record keeps its real width. */
static uint32_t register_size(edu_machine *m, int id) {
    if (m->arch == UC_ARCH_ARM) {
        if (id >= UC_ARM_REG_D0 && id <= UC_ARM_REG_D31) return 8;
        if (id >= UC_ARM_REG_Q0 && id <= UC_ARM_REG_Q15) return 16;
        return 4;
    }
    if (m->arch == UC_ARCH_ARM64) {
        if ((id >= UC_ARM64_REG_V0 && id <= UC_ARM64_REG_V31) ||
            (id >= UC_ARM64_REG_Q0 && id <= UC_ARM64_REG_Q31)) {
            return 16;
        }
        if (id >= UC_ARM64_REG_S0 && id <= UC_ARM64_REG_S31) return 4;
        if (id >= UC_ARM64_REG_H0 && id <= UC_ARM64_REG_H31) return 2;
        if (id >= UC_ARM64_REG_B0 && id <= UC_ARM64_REG_B31) return 1;
        if (id >= UC_ARM64_REG_W0 && id <= UC_ARM64_REG_W30) return 4;
        if (id == UC_ARM64_REG_NZCV || id == UC_ARM64_REG_FPCR || id == UC_ARM64_REG_FPSR ||
            id == UC_ARM64_REG_PSTATE || id == UC_ARM64_REG_WSP) {
            return 4;
        }
    }
    return 8;
}

EDU_API int edu_write_register(edu_machine *m, int id, uint64_t value, int journal) {
    uint8_t bytes[8];
    for (int i = 0; i < 8; i++) bytes[i] = (uint8_t)(value >> (8 * i));
    uint32_t size = register_size(m, id);
    return edu_write_register_bytes(m, id, bytes, size > 8 ? 8 : size, journal);
}

/* --- running ---------------------------------------------------------------------------------- */

EDU_API int edu_run(edu_machine *m, uint64_t budget, int skip_breakpoint_at_pc) {
    m->executed = 0;
    m->budget = budget;
    m->stop_reason = EDU_STOP_NONE;
    m->interrupt_number = -1;
    m->error = UC_ERR_OK;
    if (m->poke_open) {
        m->error = UC_ERR_ARG;
        m->stop_reason = EDU_STOP_ERROR;
        return m->stop_reason;
    }
    uint64_t pc = current_pc(m);
    m->skip_at = pc & ~1ULL;
    m->skip_armed = skip_breakpoint_at_pc;
    uc_err err = uc_emu_start(m->uc, pc, EDU_UNTIL_NEVER, 0, 0);
    if (err != UC_ERR_OK) {
        m->error = err;
        m->stop_reason = EDU_STOP_ERROR;
    } else if (m->stop_reason == EDU_STOP_NONE) {
        m->stop_reason = EDU_STOP_HALT;
    }
    finalize_after_run(m);
    return m->stop_reason;
}

EDU_API uint64_t edu_executed(edu_machine *m) { return m->executed; }
EDU_API int edu_stop_reason(edu_machine *m) { return m->stop_reason; }
EDU_API int edu_interrupt_number(edu_machine *m) { return m->interrupt_number; }
EDU_API int edu_error(edu_machine *m) { return m->error; }

EDU_API int edu_last_instruction(edu_machine *m, uint64_t *address) {
    if (!m->have_last) return 0;
    *address = m->last_pc;
    return 1;
}

EDU_API int edu_set_breakpoints(edu_machine *m, const uint64_t *addresses, uint32_t count) {
    uint32_t capacity = 16;
    while (capacity < count * 2) capacity *= 2;
    uint64_t *slots = malloc(capacity * sizeof(uint64_t));
    if (!slots) return UC_ERR_NOMEM;
    for (uint32_t i = 0; i < capacity; i++) slots[i] = EDU_EMPTY_SLOT;
    uint32_t stored = 0;
    for (uint32_t i = 0; i < count; i++) {
        uint64_t address = addresses[i] & ~1ULL;
        uint32_t slot = (uint32_t)((address >> 1) * 2654435761u) & (capacity - 1);
        while (slots[slot] != EDU_EMPTY_SLOT && slots[slot] != address) {
            slot = (slot + 1) & (capacity - 1);
        }
        if (slots[slot] == EDU_EMPTY_SLOT) stored++;
        slots[slot] = address;
    }
    free(m->breakpoints);
    m->breakpoints = slots;
    m->breakpoint_capacity = capacity;
    m->breakpoint_count = stored;
    return UC_ERR_OK;
}

EDU_API int edu_set_fp_map(edu_machine *m, uint64_t base, const uint8_t *bits,
                           uint32_t halfwords) {
    uint32_t bytes = (halfwords + 7) / 8;
    uint8_t *map = malloc(bytes ? bytes : 1);
    if (!map) return UC_ERR_NOMEM;
    memcpy(map, bits, bytes);
    free(m->fp_map);
    m->fp_map = map;
    m->fp_map_base = base;
    m->fp_map_halfwords = halfwords;
    return UC_ERR_OK;
}

/* --- history and Undo ------------------------------------------------------------------------- */

EDU_API int edu_set_history(edu_machine *m, uint32_t capacity) {
    free_history(m);
    m->poke_open = m->poke_recording = 0;
    m->previous_recorded = 0;
    m->fp_pending = 0;
    if (capacity) {
        m->capacity = capacity;
        m->entries = calloc(capacity, sizeof(edu_entry));
        m->core_pool = calloc((size_t)capacity * m->core_count, sizeof(uint64_t));
        m->register_capacity = (uint64_t)capacity * 4 + 64;
        m->register_records = calloc(m->register_capacity, sizeof(edu_register_record));
        m->memory_capacity = (uint64_t)capacity * 8 + 256;
        m->memory_records = calloc(m->memory_capacity, sizeof(edu_memory_record));
        m->pool_capacity = (uint64_t)capacity * 64 + (1u << 20);
        m->pool = malloc(m->pool_capacity);
        if (!m->entries || !m->core_pool || !m->register_records || !m->memory_records ||
            !m->pool) {
            free_history(m);
            return UC_ERR_NOMEM;
        }
    }
    uc_err err = UC_ERR_OK;
    if (capacity && !m->write_hook) {
        err = uc_hook_add(m->uc, &m->write_hook, UC_HOOK_MEM_WRITE, (void *)on_write, m, 1, 0);
    } else if (!capacity && m->write_hook) {
        err = uc_hook_del(m->uc, m->write_hook);
        m->write_hook = 0;
    }
    /* code translated before the change would not call (or would still call) the hook */
    uc_ctl_flush_tb(m->uc);
    return err;
}

EDU_API uint32_t edu_history_length(edu_machine *m) { return m->length; }

EDU_API int edu_can_undo(edu_machine *m) {
    edu_entry *entry = newest_entry(m);
    return !m->poke_open && entry && !entry->irreversible;
}

EDU_API int edu_undo(edu_machine *m) {
    if (!edu_can_undo(m)) return 0;
    edu_entry *entry = newest_entry(m);
    uint8_t chunk[256];
    for (int64_t i = (int64_t)entry->memory_count - 1; i >= 0; i--) {
        edu_memory_record *record =
            &m->memory_records[(entry->memory_start + (uint64_t)i) % m->memory_capacity];
        for (uint32_t done = 0; done < record->length;) {
            uint32_t run = record->length - done;
            if (run > sizeof(chunk)) run = sizeof(chunk);
            pool_get(m, record->pool_position + done, chunk, run);
            uc_mem_write(m->uc, record->address + done, chunk, run);
            done += run;
        }
        uc_ctl_remove_cache(m->uc, record->address, record->address + record->length);
    }
    for (int64_t i = (int64_t)entry->register_count - 1; i >= 0; i--) {
        edu_register_record *record =
            &m->register_records[(entry->register_start + (uint64_t)i) % m->register_capacity];
        uint8_t value[64] = {0};
        memcpy(value, record->old_value, record->size);
        uc_reg_write(m->uc, record->id, value);
    }
    uint64_t *core = core_snapshot(m, entry);
    void *pointers[EDU_MAX_CORE];
    for (uint32_t i = 0; i < m->core_count; i++) pointers[i] = &core[i];
    uc_reg_write_batch(m->uc, (int *)m->core_ids, pointers, (int)m->core_count);

    if (entry->frame_op == EDU_FRAME_PUSH && m->depth) {
        m->depth--;
    } else if (entry->frame_op == EDU_FRAME_POP) {
        push_frame(m, entry->frame);
    }
    m->register_head = entry->register_start;
    m->memory_head = entry->memory_start;
    m->pool_head = entry->pool_start;
    m->length--;
    m->have_previous = 0;
    m->previous_recorded = 0;
    m->fp_pending = 0;
    m->have_last = 0;
    for (int64_t i = (int64_t)m->length - 1; i >= 0; i--) {
        edu_entry *older = entry_at(m, (uint32_t)i);
        if (older->kind != EDU_ENTRY_INSTRUCTION) continue;
        m->have_last = 1;
        m->last_pc = older->pc;
        break;
    }
    return 1;
}

EDU_API int edu_poke_begin(edu_machine *m) {
    if (m->poke_open) return UC_ERR_ARG;
    if (m->have_previous) finalize_after_run(m);
    m->poke_open = 1;
    m->poke_recording = 0;
    if (m->capacity) {
        uc_reg_read_batch(m->uc, (int *)m->core_ids, m->core_pointers, (int)m->core_count);
        push_entry(m, EDU_ENTRY_POKE, read_register(m, m->pc_id), 0);
        m->poke_recording = 1;
    }
    return UC_ERR_OK;
}

EDU_API int edu_poke_end(edu_machine *m) {
    if (!m->poke_open) return 0;
    m->poke_open = 0;
    if (!m->poke_recording) return 0;
    m->poke_recording = 0;
    edu_entry *entry = newest_entry(m);
    if (!entry->irreversible && !entry->register_count && !entry->memory_count) {
        /* a Poke that changed nothing records nothing */
        m->register_head = entry->register_start;
        m->memory_head = entry->memory_start;
        m->pool_head = entry->pool_start;
        m->length--;
        return 0;
    }
    return 1;
}

/* --- export ------------------------------------------------------------------------------------ */

typedef struct {
    uint8_t *buffer;
    uint32_t size;
    uint32_t at;
} edu_writer;

static void put(edu_writer *w, const void *bytes, uint32_t length) {
    if (w->buffer && w->at + length <= w->size) memcpy(w->buffer + w->at, bytes, length);
    w->at += length;
}

static void put_u8(edu_writer *w, uint8_t value) { put(w, &value, 1); }
static void put_u32(edu_writer *w, uint32_t value) { put(w, &value, 4); }
static void put_u64(edu_writer *w, uint64_t value) { put(w, &value, 8); }

static void put_pool(edu_writer *w, edu_machine *m, uint64_t position, uint32_t length) {
    if (w->buffer && w->at + length <= w->size) pool_get(m, position, w->buffer + w->at, length);
    w->at += length;
}

EDU_API uint32_t edu_history_export(edu_machine *m, uint32_t max_entries, uint8_t *buffer,
                                    uint32_t size) {
    uint32_t count = m->length < max_entries ? m->length : max_entries;
    /* measure first, then write only when everything fits */
    for (int pass = 0; pass < 2; pass++) {
        edu_writer w = {pass ? buffer : NULL, size, 0};
        put_u32(&w, count);
        put_u32(&w, m->core_count);
        if (pass) uc_reg_read_batch(m->uc, (int *)m->core_ids, m->core_pointers, (int)m->core_count);
        for (uint32_t i = 0; i < m->core_count; i++) put_u64(&w, m->core_scratch[i]);
        for (uint32_t k = 0; k < count; k++) {
            edu_entry *entry = entry_at(m, m->length - 1 - k);
            put_u8(&w, entry->kind);
            put_u8(&w, entry->frame_op);
            put_u8(&w, entry->irreversible);
            put_u8(&w, 0);
            put_u32(&w, entry->size);
            put_u64(&w, entry->pc);
            put_u32(&w, entry->register_count);
            put_u32(&w, entry->memory_count);
            put(&w, core_snapshot(m, entry), m->core_count * sizeof(uint64_t));
            if (entry->frame_op != EDU_FRAME_NONE) {
                put_u64(&w, entry->frame.target);
                put_u64(&w, entry->frame.return_address);
                put_u64(&w, entry->frame.sp);
                put_u64(&w, entry->frame.call_site);
            }
            for (uint32_t i = 0; i < entry->register_count; i++) {
                edu_register_record *record =
                    &m->register_records[(entry->register_start + i) % m->register_capacity];
                put_u32(&w, (uint32_t)record->id);
                put_u32(&w, record->size);
                put(&w, record->old_value, 16);
                put(&w, record->new_value, 16);
            }
            for (uint32_t i = 0; i < entry->memory_count; i++) {
                edu_memory_record *record =
                    &m->memory_records[(entry->memory_start + i) % m->memory_capacity];
                put_u64(&w, record->address);
                put_u32(&w, record->length);
                put_u32(&w, 0);
                put_pool(&w, m, record->pool_position, record->length * 2);
                while (w.at % 8) put_u8(&w, 0);
            }
        }
        if (!pass && w.at > size) return w.at;
        if (pass) return w.at;
    }
    return 0;
}

/* --- call stack -------------------------------------------------------------------------------- */

EDU_API uint32_t edu_call_depth(edu_machine *m) { return m->depth; }

EDU_API uint32_t edu_call_stack_export(edu_machine *m, uint8_t *buffer, uint32_t size) {
    uint32_t needed = 4 + m->depth * 32;
    if (needed > size) return needed;
    edu_writer w = {buffer, size, 0};
    put_u32(&w, m->depth);
    for (uint32_t i = 0; i < m->depth; i++) {
        put_u64(&w, m->frames[i].target);
        put_u64(&w, m->frames[i].return_address);
        put_u64(&w, m->frames[i].sp);
        put_u64(&w, m->frames[i].call_site);
    }
    return needed;
}
