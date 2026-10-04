        .cpu cortex-a15
        .arch armv7-a
        .arch_extension virt
        .arch_extension idiv
        .arch_extension sec
        .arch_extension mp
        .fpu vfpv4
        .eabi_attribute 28, 1
        .eabi_attribute 20, 1
        .eabi_attribute 21, 1
        .eabi_attribute 23, 3
        .eabi_attribute 24, 1
        .eabi_attribute 25, 1
        .eabi_attribute 26, 1
        .eabi_attribute 30, 2
        .eabi_attribute 34, 1
        .eabi_attribute 18, 4
        .file   "example.c"
        .text
.Ltext0:
        .cfi_sections   .debug_frame
        .file 1 "/app/example.c"
        .align  2
        .syntax unified
        .arm
        .type   fib, %function
fib:
.LFB0:
        .file 2 "main.c"
        .loc 2 5 23
        .cfi_startproc
        @ args = 0, pretend = 0, frame = 96
        @ frame_needed = 0, uses_anonymous_args = 0
        .loc 2 5 42
        cmp     r0, #1
        bxle    lr
        sub     r3, r0, #1
        .loc 2 5 23
        strd    r4, [sp, #-36]!
        .cfi_def_cfa_offset 36
        .cfi_offset 4, -36
        .cfi_offset 5, -32
        .cfi_offset 6, -28
        .cfi_offset 7, -24
        .cfi_offset 8, -20
        .cfi_offset 9, -16
        .cfi_offset 10, -12
        .cfi_offset 11, -8
        .cfi_offset 14, -4
        bic     r2, r3, #1
        strd    r6, [sp, #8]
        .loc 2 5 42
        mov     r7, #0
        .loc 2 5 23
        strd    r8, [sp, #16]
        sub     r8, r0, r2
.LBB21:
.LBB22:
        .loc 2 5 42
        cmp     r0, r8
.LBE22:
.LBE21:
        .loc 2 5 23
        strd    r10, [sp, #24]
        mov     fp, r3
        str     lr, [sp, #32]
        sub     sp, sp, #100
        .cfi_def_cfa_offset 136
.LBB63:
.LBB59:
        .loc 2 5 42
        beq     .L3
.L68:
        sub     r5, r0, #2
        mov     r6, #0
        str     r8, [sp, #44]
        bic     r3, r5, #1
        sub     r10, fp, r3
        mov     r8, r10
        mov     r10, r7
        mov     r7, r5
.L32:
.LBB23:
.LBB24:
        cmp     fp, r8
        sub     r9, fp, #1
        beq     .L4
        sub     fp, fp, #2
        mov     r5, #0
        str     r6, [sp, #48]
        bic     r3, fp, #1
        str     r8, [sp, #52]
        sub     r3, r9, r3
        str     fp, [sp, #56]
        mov     r4, r3
.L29:
.LBB25:
.LBB26:
        cmp     r4, r9
        sub     r1, r9, #1
        beq     .L5
        sub     r9, r9, #2
        mov     fp, #0
        str     r10, [sp, #60]
        bic     r2, r9, #1
        mov     r10, fp
        str     r5, [sp, #64]
        sub     ip, r1, r2
        mov     r5, r7
        str     r4, [sp, #68]
        mov     fp, ip
        str     r9, [sp, #72]
.L26:
.LBB27:
.LBB28:
        cmp     fp, r1
        sub     r2, r1, #1
        beq     .L6
        sub     r4, r1, #2
        mov     r7, #0
        str     fp, [sp, #76]
        bic     r3, r4, #1
        mov     r6, r4
        str     r10, [sp, #80]
        sub     r8, r2, r3
        mov     r1, r5
        mov     r4, r8
        mov     fp, r7
.L23:
.LBB29:
.LBB30:
        cmp     r4, r2
        sub     r3, r2, #1
        beq     .L7
        sub     r5, r2, #2
        sub     r7, r2, #4
        bic     r2, r5, #1
        mov     r10, #0
        sub     r9, r3, r2
        mov     r2, r3
        mov     r3, r1
        mov     r1, fp
        mov     fp, r4
.L20:
.LBB31:
.LBB32:
        cmp     r9, r2
        beq     .L8
        sub     r8, r2, #2
        sub     ip, r2, #3
        str     r5, [sp, #4]
        bic     r0, r8, #1
        sub     r2, r2, #5
        sub     r0, ip, r0
        mov     r4, r7
        mov     ip, #0
        str     r0, [sp, #16]
        bic     r0, r7, #1
        mov     r5, ip
        sub     lr, r2, r0
        mov     ip, r1
        mov     r2, fp
        mov     r1, r8
        str     lr, [sp, #12]
        mov     lr, r3
.LBB33:
.LBB34:
        ldr     r3, [sp, #16]
        mov     r8, r6
.LBE34:
.LBE33:
        .loc 2 5 44 discriminator 1
        add     r0, r4, #1
        mov     r6, r10
.LBB43:
.LBB37:
        .loc 2 5 42
        cmp     r3, r4
        beq     .L9
.L66:
        sub     r3, r4, #2
        mov     r10, r4
        str     ip, [sp, #20]
        mov     fp, r3
        mov     r3, #0
        str     fp, [sp, #8]
        str     r7, [sp, #28]
        mov     r7, r6
        str     r8, [sp, #36]
        mov     r8, r5
        str     r1, [sp, #40]
        mov     r1, r4
        mov     r4, fp
        mov     fp, r10
        str     r2, [sp, #24]
        str     lr, [sp, #32]
.L14:
.LBB35:
.LBB36:
        cmp     fp, #1
        beq     .L53
        sub     r2, r0, #2
        bic     r5, r4, #1
        sub     r0, r0, #4
        mov     r6, r2
        sub     r10, r0, r5
        mov     r5, #0
.L11:
        .loc 2 5 44 discriminator 1
        mov     r0, r6
        .loc 2 5 42
        sub     r6, r6, #2
        str     r3, [sp, #84]
        str     r1, [sp, #88]
        str     r2, [sp, #92]
        .loc 2 5 44 discriminator 1
        bl      fib
        .loc 2 5 42
        cmp     r10, r6
        ldr     r3, [sp, #84]
        add     r5, r5, r0
        ldr     r1, [sp, #88]
        ldr     r2, [sp, #92]
        bne     .L11
        bic     ip, r4, #1
        sub     fp, fp, #2
        sub     ip, fp, ip
.LBE36:
.LBE35:
        cmp     r2, #1
        add     ip, ip, r5
        .loc 2 5 57 discriminator 1
        mov     r0, r2
        sub     r4, r4, #2
        add     r3, r3, ip
        .loc 2 5 42
        bne     .L14
.L53:
        add     r0, r3, #1
.LBE37:
.LBE43:
        ldr     r3, [sp, #12]
.LBB44:
.LBB38:
        add     r2, sp, #24
        add     r5, r8, r0
.LBE38:
.LBE44:
        ldr     r0, [sp, #8]
.LBB45:
.LBB39:
        mov     r6, r7
        ldm     r2, {r2, r7, lr}
        mov     r4, r1
        ldr     ip, [sp, #20]
.LBE39:
.LBE45:
        cmp     r3, r0
.LBB46:
.LBB40:
        ldr     r8, [sp, #36]
        ldr     r1, [sp, #40]
.LBE40:
.LBE46:
        beq     .L65
        ldr     r4, [sp, #8]
.LBB47:
.LBB41:
        ldr     r3, [sp, #16]
.LBE41:
.LBE47:
        .loc 2 5 44 discriminator 1
        add     r0, r4, #1
.LBB48:
.LBB42:
        .loc 2 5 42
        cmp     r3, r4
        bne     .L66
.L9:
        mov     r10, r6
        mov     r6, r8
        mov     r8, r1
        mov     r1, ip
        add     ip, r0, r5
        ldr     r5, [sp, #4]
        mov     fp, r2
        mov     r3, lr
.L16:
.LBE42:
.LBE48:
.LBE32:
.LBE31:
        cmp     r8, #1
        add     r10, r10, ip
        .loc 2 5 57 discriminator 1
        mov     r2, r8
        .loc 2 5 42
        sub     r7, r7, #2
        bne     .L20
        mov     r4, fp
        add     r10, r10, #1
        mov     fp, r1
        mov     r1, r3
        b       .L19
.L8:
        .loc 2 5 44 discriminator 1
        sub     r9, r9, #1
        mov     r4, fp
        add     r10, r9, r10
        mov     fp, r1
        mov     r1, r3
.L19:
.LBE30:
.LBE29:
        .loc 2 5 42
        cmp     r5, #1
        add     fp, fp, r10
        .loc 2 5 57 discriminator 1
        mov     r2, r5
        .loc 2 5 42
        bne     .L23
        ldr     r10, [sp, #80]
        add     r7, fp, #1
        mov     r5, r1
        ldr     fp, [sp, #76]
        mov     r4, r6
.L22:
.LBE28:
.LBE27:
        cmp     r4, #1
        add     r10, r10, r7
        .loc 2 5 57 discriminator 1
        mov     r1, r4
        .loc 2 5 42
        bne     .L26
        ldr     r4, [sp, #68]
        mov     r7, r5
        add     fp, r10, #1
        ldr     r10, [sp, #60]
        ldr     r5, [sp, #64]
        ldr     r9, [sp, #72]
        b       .L25
.L7:
        ldr     r10, [sp, #80]
        add     r7, r3, fp
        mov     r5, r1
        ldr     fp, [sp, #76]
        mov     r4, r6
        b       .L22
.L6:
        ldr     r4, [sp, #68]
        mov     r7, r5
        add     fp, r2, r10
        ldr     r10, [sp, #60]
        ldr     r5, [sp, #64]
        ldr     r9, [sp, #72]
.L25:
.LBE26:
.LBE25:
        cmp     r9, #1
        add     r5, r5, fp
        bne     .L29
        add     r6, sp, #48
        add     r5, r5, #1
        ldm     r6, {r6, r8, fp}
        b       .L28
.L5:
        add     r6, sp, #48
        add     r5, r1, r5
        ldm     r6, {r6, r8, fp}
.L28:
.LBE24:
.LBE23:
        cmp     fp, #1
        add     r6, r6, r5
        bne     .L32
        mov     r5, r7
        add     r6, r6, #1
        ldr     r8, [sp, #44]
.LBE59:
.LBE63:
        cmp     r5, #1
.LBB64:
.LBB60:
        mov     r7, r10
.LBE60:
.LBE64:
        .loc 2 5 57 discriminator 1
        mov     r0, r5
        add     r7, r7, r6
        .loc 2 5 42
        bne     .L67
.L52:
        add     r0, r7, #1
        b       .L2
.L4:
        mov     r5, r7
        add     r6, r9, r6
        ldr     r8, [sp, #44]
        cmp     r5, #1
        mov     r7, r10
        .loc 2 5 57 discriminator 1
        mov     r0, r5
        add     r7, r7, r6
        .loc 2 5 42
        beq     .L52
.L67:
.LBB65:
.LBB61:
        cmp     r0, r8
        sub     r3, r5, #1
        mov     fp, r3
        bne     .L68
.L3:
        add     r0, r3, r7
.L2:
.LBE61:
.LBE65:
        .loc 2 5 69
        add     sp, sp, #100
        .cfi_remember_state
        .cfi_def_cfa_offset 36
        ldrd    r4, [sp]
        .cfi_restore 5
        .cfi_restore 4
        ldrd    r6, [sp, #8]
        .cfi_restore 7
        .cfi_restore 6
        @ sp needed
        ldrd    r8, [sp, #16]
        .cfi_restore 9
        .cfi_restore 8
        ldrd    r10, [sp, #24]
        .cfi_restore 11
        .cfi_restore 10
        add     sp, sp, #32
        .cfi_def_cfa_offset 4
        ldr     pc, [sp], #4
        .cfi_restore 15
        .cfi_def_cfa_offset 0
.L65:
        .cfi_restore_state
.LBB66:
.LBB62:
.LBB58:
.LBB57:
.LBB56:
.LBB55:
.LBB54:
.LBB53:
.LBB52:
.LBB51:
.LBB50:
.LBB49:
        mov     r10, r6
        mov     fp, r2
        mov     r6, r8
        mov     r3, lr
        mov     r8, r1
        mov     r1, ip
        add     ip, r4, r5
        ldr     r5, [sp, #4]
        b       .L16
.LBE49:
.LBE50:
.LBE51:
.LBE52:
.LBE53:
.LBE54:
.LBE55:
.LBE56:
.LBE57:
.LBE58:
.LBE62:
.LBE66:
        .cfi_endproc
.LFE0:
        .size   fib, .-fib
        .align  2
        .global pick
        .syntax unified
        .arm
        .type   pick, %function
pick:
.LFB1:
        .loc 2 7 17
        .cfi_startproc
        @ args = 0, pretend = 0, frame = 0
        @ frame_needed = 0, uses_anonymous_args = 0
        @ link register save eliminated.
        cmp     r0, #4
        movwls  r3, #:lower16:CSWTCH.4
        movtls  r3, #:upper16:CSWTCH.4
        ldrls   r0, [r3, r0, lsl #2]
        .loc 2 7 17
        mvnhi   r0, #0
        .loc 2 16 1
        bx      lr
        .cfi_endproc
.LFE1:
        .size   pick, .-pick
        .align  2
        .global __asm_editor_main
        .syntax unified
        .arm
        .type   __asm_editor_main, %function
__asm_editor_main:
.LFB2:
        .loc 2 18 16
        .cfi_startproc
        @ args = 0, pretend = 0, frame = 0
        @ frame_needed = 0, uses_anonymous_args = 0
        strd    r4, [sp, #-36]!
        .cfi_def_cfa_offset 36
        .cfi_offset 4, -36
        .cfi_offset 5, -32
        .cfi_offset 6, -28
        .cfi_offset 7, -24
        .cfi_offset 8, -20
        .cfi_offset 9, -16
        .cfi_offset 10, -12
        .cfi_offset 11, -8
        .cfi_offset 14, -4
        strd    r6, [sp, #8]
.LBB71:
        .loc 2 20 14
        mov     r7, #0
.LBE71:
        .loc 2 18 16
        strd    r8, [sp, #16]
        ldr     r9, .L83
        .loc 2 19 9
        mov     r8, r7
        .loc 2 18 16
        strd    r10, [sp, #24]
.LBB76:
        .loc 2 20 55 discriminator 3
        movw    fp, #43691
        .loc 2 20 53 discriminator 3
        movw    r10, #:lower16:CSWTCH.4
        .loc 2 20 55 discriminator 3
        movt    fp, 43690
        .loc 2 20 53 discriminator 3
        movt    r10, #:upper16:CSWTCH.4
.LBE76:
        .loc 2 18 16
        str     lr, [sp, #32]
        sub     sp, sp, #4
        .cfi_def_cfa_offset 40
.L73:
.LBB77:
        .loc 2 20 55 discriminator 3
        umull   r3, r5, fp, r7
.LBB72:
.LBB73:
        .loc 2 5 42
        cmp     r7, #1
        movgt   r4, r7
        movgt   r6, #0
.LBE73:
.LBE72:
        .loc 2 20 55 discriminator 3
        lsr     r5, r5, #2
        add     r5, r5, r5, lsl #1
        sub     r5, r7, r5, lsl #1
.LBB75:
.LBB74:
        .loc 2 5 42
        ble     .L82
.L74:
        .loc 2 5 44 discriminator 1
        sub     r0, r4, #1
        .loc 2 5 57 discriminator 1
        sub     r4, r4, #2
        .loc 2 5 44 discriminator 1
        bl      fib
        .loc 2 5 42
        cmp     r4, #1
        add     r6, r6, r0
        bgt     .L74
        cmp     r5, #5
        and     r2, r7, #1
        ldrne   r3, [r10, r5, lsl #2]
        mvneq   r3, #0
        add     r2, r2, r6
.LBE74:
.LBE75:
        .loc 2 20 29 discriminator 3
        add     r7, r7, #1
        .loc 2 20 23 discriminator 2
        cmp     r7, #8
        .loc 2 20 53 discriminator 3
        mul     r3, r2, r3
        .loc 2 20 70 discriminator 3
        add     r8, r8, r3
        .loc 2 20 44 discriminator 3
        str     r3, [r9, #4]!
        .loc 2 20 23 discriminator 2
        bne     .L73
.LBE77:
        .loc 2 21 22
        vmov    s15, r8 @ int
        movw    r3, #:lower16:scale
        movt    r3, #:upper16:scale
        vldr.64 d17, [r3]
        vcvt.f64.s32    d16, s15
        vmul.f64        d16, d16, d17
        .loc 2 21 10
        vcvt.s32.f64    s15, d16
        vmov    r0, s15 @ int
        .loc 2 21 27
        add     r0, r0, #111
        .loc 2 23 1
        add     r0, r0, r8
        add     sp, sp, #4
        .cfi_remember_state
        .cfi_def_cfa_offset 36
        ldrd    r4, [sp]
        .cfi_restore 5
        .cfi_restore 4
        ldrd    r6, [sp, #8]
        .cfi_restore 7
        .cfi_restore 6
        @ sp needed
        ldrd    r8, [sp, #16]
        .cfi_restore 9
        .cfi_restore 8
        ldrd    r10, [sp, #24]
        .cfi_restore 11
        .cfi_restore 10
        add     sp, sp, #32
        .cfi_def_cfa_offset 4
        ldr     pc, [sp], #4
        .cfi_restore 15
        .cfi_def_cfa_offset 0
.L82:
        .cfi_restore_state
.LBB78:
        .loc 2 20 53 discriminator 3
        ldr     r3, [r10, r5, lsl #2]
        mul     r3, r3, r7
        .loc 2 20 70 discriminator 3
        add     r7, r7, #1
        add     r8, r8, r3
        .loc 2 20 44 discriminator 3
        str     r3, [r9, #4]!
        b       .L73
.L84:
        .align  2
.L83:
        .word   table-4
.LBE78:
        .cfi_endproc
.LFE2:
        .size   __asm_editor_main, .-__asm_editor_main
        .section        .rodata
        .align  2
        .type   CSWTCH.4, %object
        .size   CSWTCH.4, 20
CSWTCH.4:
        .word   10
        .word   20
        .word   33
        .word   47
        .word   51
        .global scale
        .data
        .align  3
        .type   scale, %object
        .size   scale, 8
scale:
        .word   0
        .word   1073217536
        .global table
        .bss
        .align  2
        .type   table, %object
        .size   table, 32
table:
        .space  32
        .text
.Letext0:
        .section        .debug_info,"",%progbits
.Ldebug_info0:
        .4byte  0x10b
        .2byte  0x5
        .byte   0x1
        .byte   0x4
        .4byte  .Ldebug_abbrev0
        .uleb128 0x3
        .4byte  .LASF2
        .byte   0x1d
        .4byte  .LASF3
        .4byte  .LASF4
        .4byte  .Ltext0
        .4byte  .Letext0-.Ltext0
        .4byte  .Ldebug_line0
        .uleb128 0x2
        .4byte  .LASF0
        .byte   0x2
        .byte   0x5
        .uleb128 0x5
        .byte   0x3
        .4byte  table
        .uleb128 0x2
        .4byte  .LASF1
        .byte   0x3
        .byte   0x8
        .uleb128 0x5
        .byte   0x3
        .4byte  scale
        .uleb128 0x4
        .4byte  .LASF5
        .byte   0x2
        .byte   0x12
        .byte   0x5
        .4byte  .LFB2
        .4byte  .LFE2-.LFB2
        .uleb128 0x1
        .byte   0x9c
        .4byte  0x67
        .uleb128 0x5
        .4byte  0x70
        .4byte  .LBB72
        .4byte  .LLRL7
        .byte   0x2
        .byte   0x14
        .byte   0x2e
        .byte   0
        .uleb128 0x6
        .4byte  .LASF6
        .byte   0x2
        .byte   0x7
        .byte   0x5
        .byte   0x1
        .uleb128 0x7
        .ascii  "fib\000"
        .byte   0x2
        .byte   0x5
        .byte   0xc
        .byte   0x1
        .uleb128 0x8
        .4byte  0x70
        .4byte  .LFB0
        .4byte  .LFE0-.LFB0
        .uleb128 0x1
        .byte   0x9c
        .4byte  0xff
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB21
        .4byte  .LLRL0
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB23
        .4byte  .LLRL1
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB25
        .4byte  .LLRL2
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB27
        .4byte  .LLRL3
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB29
        .4byte  .LLRL4
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB31
        .4byte  .LLRL5
        .uleb128 0x1
        .4byte  0x70
        .4byte  .LBB33
        .4byte  .LLRL6
        .uleb128 0x9
        .4byte  0x70
        .4byte  .LBB35
        .4byte  .LBE35-.LBB35
        .byte   0x2
        .byte   0x5
        .byte   0x2c
        .byte   0
        .byte   0
        .byte   0
        .byte   0
        .byte   0
        .byte   0
        .byte   0
        .byte   0
        .uleb128 0xa
        .4byte  0x67
        .4byte  .LFB1
        .4byte  .LFE1-.LFB1
        .uleb128 0x1
        .byte   0x9c
        .byte   0
        .section        .debug_abbrev,"",%progbits
.Ldebug_abbrev0:
        .uleb128 0x1
        .uleb128 0x1d
        .byte   0x1
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x52
        .uleb128 0x1
        .uleb128 0x55
        .uleb128 0x17
        .uleb128 0x58
        .uleb128 0x21
        .sleb128 2
        .uleb128 0x59
        .uleb128 0x21
        .sleb128 5
        .uleb128 0x57
        .uleb128 0x21
        .sleb128 44
        .byte   0
        .byte   0
        .uleb128 0x2
        .uleb128 0x34
        .byte   0
        .uleb128 0x3
        .uleb128 0xe
        .uleb128 0x3a
        .uleb128 0x21
        .sleb128 2
        .uleb128 0x3b
        .uleb128 0xb
        .uleb128 0x39
        .uleb128 0xb
        .uleb128 0x3f
        .uleb128 0x19
        .uleb128 0x2
        .uleb128 0x18
        .byte   0
        .byte   0
        .uleb128 0x3
        .uleb128 0x11
        .byte   0x1
        .uleb128 0x25
        .uleb128 0xe
        .uleb128 0x13
        .uleb128 0xb
        .uleb128 0x3
        .uleb128 0xe
        .uleb128 0x1b
        .uleb128 0xe
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x6
        .uleb128 0x10
        .uleb128 0x17
        .byte   0
        .byte   0
        .uleb128 0x4
        .uleb128 0x2e
        .byte   0x1
        .uleb128 0x3f
        .uleb128 0x19
        .uleb128 0x3
        .uleb128 0xe
        .uleb128 0x3a
        .uleb128 0xb
        .uleb128 0x3b
        .uleb128 0xb
        .uleb128 0x39
        .uleb128 0xb
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x6
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
        .uleb128 0x19
        .uleb128 0x1
        .uleb128 0x13
        .byte   0
        .byte   0
        .uleb128 0x5
        .uleb128 0x1d
        .byte   0
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x52
        .uleb128 0x1
        .uleb128 0x55
        .uleb128 0x17
        .uleb128 0x58
        .uleb128 0xb
        .uleb128 0x59
        .uleb128 0xb
        .uleb128 0x57
        .uleb128 0xb
        .byte   0
        .byte   0
        .uleb128 0x6
        .uleb128 0x2e
        .byte   0
        .uleb128 0x3f
        .uleb128 0x19
        .uleb128 0x3
        .uleb128 0xe
        .uleb128 0x3a
        .uleb128 0xb
        .uleb128 0x3b
        .uleb128 0xb
        .uleb128 0x39
        .uleb128 0xb
        .uleb128 0x20
        .uleb128 0xb
        .byte   0
        .byte   0
        .uleb128 0x7
        .uleb128 0x2e
        .byte   0
        .uleb128 0x3
        .uleb128 0x8
        .uleb128 0x3a
        .uleb128 0xb
        .uleb128 0x3b
        .uleb128 0xb
        .uleb128 0x39
        .uleb128 0xb
        .uleb128 0x20
        .uleb128 0xb
        .byte   0
        .byte   0
        .uleb128 0x8
        .uleb128 0x2e
        .byte   0x1
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x6
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
        .uleb128 0x19
        .uleb128 0x1
        .uleb128 0x13
        .byte   0
        .byte   0
        .uleb128 0x9
        .uleb128 0x1d
        .byte   0
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x6
        .uleb128 0x58
        .uleb128 0xb
        .uleb128 0x59
        .uleb128 0xb
        .uleb128 0x57
        .uleb128 0xb
        .byte   0
        .byte   0
        .uleb128 0xa
        .uleb128 0x2e
        .byte   0
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x6
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7a
        .uleb128 0x19
        .byte   0
        .byte   0
        .byte   0
        .section        .debug_aranges,"",%progbits
        .4byte  0x1c
        .2byte  0x2
        .4byte  .Ldebug_info0
        .byte   0x4
        .byte   0
        .2byte  0
        .2byte  0
        .4byte  .Ltext0
        .4byte  .Letext0-.Ltext0
        .4byte  0
        .4byte  0
        .section        .debug_rnglists,"",%progbits
.Ldebug_ranges0:
        .4byte  .Ldebug_ranges3-.Ldebug_ranges2
.Ldebug_ranges2:
        .2byte  0x5
        .byte   0x4
        .byte   0
        .4byte  0
.LLRL0:
        .byte   0x4
        .uleb128 .LBB21-.Ltext0
        .uleb128 .LBE21-.Ltext0
        .byte   0x4
        .uleb128 .LBB63-.Ltext0
        .uleb128 .LBE63-.Ltext0
        .byte   0x4
        .uleb128 .LBB64-.Ltext0
        .uleb128 .LBE64-.Ltext0
        .byte   0x4
        .uleb128 .LBB65-.Ltext0
        .uleb128 .LBE65-.Ltext0
        .byte   0x4
        .uleb128 .LBB66-.Ltext0
        .uleb128 .LBE66-.Ltext0
        .byte   0
.LLRL1:
        .byte   0x4
        .uleb128 .LBB23-.Ltext0
        .uleb128 .LBE23-.Ltext0
        .byte   0x4
        .uleb128 .LBB58-.Ltext0
        .uleb128 .LBE58-.Ltext0
        .byte   0
.LLRL2:
        .byte   0x4
        .uleb128 .LBB25-.Ltext0
        .uleb128 .LBE25-.Ltext0
        .byte   0x4
        .uleb128 .LBB56-.Ltext0
        .uleb128 .LBE56-.Ltext0
        .byte   0
.LLRL3:
        .byte   0x4
        .uleb128 .LBB27-.Ltext0
        .uleb128 .LBE27-.Ltext0
        .byte   0x4
        .uleb128 .LBB54-.Ltext0
        .uleb128 .LBE54-.Ltext0
        .byte   0
.LLRL4:
        .byte   0x4
        .uleb128 .LBB29-.Ltext0
        .uleb128 .LBE29-.Ltext0
        .byte   0x4
        .uleb128 .LBB52-.Ltext0
        .uleb128 .LBE52-.Ltext0
        .byte   0
.LLRL5:
        .byte   0x4
        .uleb128 .LBB31-.Ltext0
        .uleb128 .LBE31-.Ltext0
        .byte   0x4
        .uleb128 .LBB50-.Ltext0
        .uleb128 .LBE50-.Ltext0
        .byte   0
.LLRL6:
        .byte   0x4
        .uleb128 .LBB33-.Ltext0
        .uleb128 .LBE33-.Ltext0
        .byte   0x4
        .uleb128 .LBB43-.Ltext0
        .uleb128 .LBE43-.Ltext0
        .byte   0x4
        .uleb128 .LBB44-.Ltext0
        .uleb128 .LBE44-.Ltext0
        .byte   0x4
        .uleb128 .LBB45-.Ltext0
        .uleb128 .LBE45-.Ltext0
        .byte   0x4
        .uleb128 .LBB46-.Ltext0
        .uleb128 .LBE46-.Ltext0
        .byte   0x4
        .uleb128 .LBB47-.Ltext0
        .uleb128 .LBE47-.Ltext0
        .byte   0x4
        .uleb128 .LBB48-.Ltext0
        .uleb128 .LBE48-.Ltext0
        .byte   0
.LLRL7:
        .byte   0x4
        .uleb128 .LBB72-.Ltext0
        .uleb128 .LBE72-.Ltext0
        .byte   0x4
        .uleb128 .LBB75-.Ltext0
        .uleb128 .LBE75-.Ltext0
        .byte   0
.Ldebug_ranges3:
        .section        .debug_line,"",%progbits
.Ldebug_line0:
        .section        .debug_str,"MS",%progbits,1
.LASF6:
        .ascii  "pick\000"
.LASF2:
        .ascii  "GNU C17 14.2.0 -mcpu=cortex-a15 -mfloat-abi=hard -m"
        .ascii  "fpu=vfpv4 -marm -march=armv7ve+vfpv4 -g -g1 -O2 -st"
        .ascii  "d=c17 -ffreestanding -fno-stack-protector -fno-pie "
        .ascii  "-fno-section-anchors\000"
.LASF1:
        .ascii  "scale\000"
.LASF5:
        .ascii  "__asm_editor_main\000"
.LASF0:
        .ascii  "table\000"
.LASF3:
        .ascii  "/app/example.c\000"
.LASF4:
        .ascii  "/app\000"
        .ident  "GCC: (crosstool-NG UNKNOWN) 14.2.0"
