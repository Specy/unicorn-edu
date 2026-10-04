        .arch armv8-a
        .file   "example.c"
        .text
.Ltext0:
        .file 0 "/app" "/app/example.c"
        .align  2
        .p2align 5,,15
        .type   fib, %function
fib:
.LFB0:
        .file 1 "main.c"
        .loc 1 5 23
        .cfi_startproc
        .loc 1 5 42
        cmp     w0, 1
        ble     .L59
        .loc 1 5 23
        stp     x29, x30, [sp, -192]!
        .cfi_def_cfa_offset 192
        .cfi_offset 29, -192
        .cfi_offset 30, -184
        sub     w1, w0, #1
        and     w2, w1, -2
        mov     x29, sp
        stp     x19, x20, [sp, 16]
        .cfi_offset 19, -176
        .cfi_offset 20, -168
        mov     w20, w1
        stp     x27, x28, [sp, 80]
        .cfi_offset 27, -112
        .cfi_offset 28, -104
        sub     w28, w0, w2
        .loc 1 5 42
        mov     w27, 0
.LBB21:
.LBB22:
        cmp     w0, w28
        beq     .L3
.L66:
        sub     w19, w0, #2
        stp     x21, x22, [sp, 32]
        .cfi_offset 22, -152
        .cfi_offset 21, -160
        and     w0, w19, -2
        sub     w21, w1, w0
        stp     x23, x24, [sp, 48]
        .cfi_offset 24, -136
        .cfi_offset 23, -144
        mov     w23, w28
        mov     w28, w21
        mov     w22, 0
        stp     x25, x26, [sp, 64]
        .cfi_offset 26, -120
        .cfi_offset 25, -128
.L32:
        sub     w0, w20, #1
.LBB23:
.LBB24:
        .loc 1 5 42
        cmp     w20, w28
        beq     .L4
        sub     w20, w20, #2
        mov     w25, w28
        and     w1, w20, -2
        mov     w28, w22
        sub     w2, w0, w1
        mov     w21, 0
        mov     w26, w2
.L29:
        sub     w1, w0, #1
.LBB25:
.LBB26:
        cmp     w26, w0
        beq     .L5
        sub     w0, w0, #2
        mov     w4, w19
        and     w2, w0, -2
        mov     w5, w0
        sub     w3, w1, w2
        mov     w0, w23
        mov     w24, w3
        mov     w23, w25
        mov     w3, w20
        mov     w19, w27
        mov     w20, w28
        mov     w22, 0
.L26:
        sub     w2, w1, #1
.LBB27:
.LBB28:
        cmp     w24, w1
        beq     .L6
        sub     w1, w1, #2
        mov     w25, 0
        and     w28, w1, -2
        mov     w8, w25
        sub     w28, w2, w28
        mov     w7, w23
        mov     w9, w28
        mov     w10, w3
        mov     w25, w26
        mov     w28, w24
        mov     w23, w21
        mov     w11, w0
        mov     w3, w22
.L23:
        sub     w6, w2, #1
.LBB29:
.LBB30:
        cmp     w9, w2
        beq     .L7
        sub     w24, w2, #2
        sub     w27, w2, #4
        and     w22, w24, -2
        mov     w26, w27
        sub     w22, w6, w22
        mov     w21, 0
.L20:
.LBB31:
.LBB32:
        cmp     w22, w6
        beq     .L8
        sub     w2, w6, #2
        sub     w13, w6, #3
        and     w12, w2, -2
        and     w0, w26, -2
        sub     w12, w13, w12
        str     w12, [sp, 108]
        sub     w6, w6, #5
        mov     w13, w26
        sub     w14, w6, w0
.LBB33:
.LBB34:
        ldr     w0, [sp, 108]
.LBE34:
.LBE33:
        .loc 1 5 44 discriminator 1
        add     w16, w13, 1
        .loc 1 5 42
        mov     w27, 0
.LBB40:
.LBB37:
        cmp     w0, w13
        beq     .L9
.L64:
        mov     w0, w4
        mov     w15, 0
        sub     w6, w13, #2
        mov     w4, w1
        mov     w18, w26
        mov     w1, w15
        mov     w12, w13
        mov     w15, w0
        mov     w26, w21
        stp     w3, w22, [sp, 112]
        mov     w22, w19
        stp     w24, w2, [sp, 120]
        mov     w24, w23
        mov     w2, w6
        mov     w23, w20
.L14:
.LBB35:
.LBB36:
        cmp     w12, 1
        beq     .L53
        sub     w3, w16, #2
        and     w21, w2, -2
        sub     w16, w16, #4
        mov     w20, 0
        sub     w19, w16, w21
        mov     w21, w3
.L11:
        .loc 1 5 44 discriminator 1
        mov     w0, w21
        .loc 1 5 42
        sub     w21, w21, #2
        stp     w8, w9, [sp, 128]
        stp     w1, w18, [sp, 136]
        stp     w14, w13, [sp, 144]
        stp     w6, w2, [sp, 152]
        stp     w12, w7, [sp, 160]
        stp     w11, w3, [sp, 168]
        stp     w10, w5, [sp, 176]
        stp     w4, w15, [sp, 184]
        .loc 1 5 44 discriminator 1
        bl      fib
        .loc 1 5 42
        ldp     w8, w9, [sp, 128]
        add     w20, w20, w0
        ldp     w1, w18, [sp, 136]
        cmp     w19, w21
        ldp     w14, w13, [sp, 144]
        ldp     w6, w2, [sp, 152]
        ldp     w12, w7, [sp, 160]
        ldp     w11, w3, [sp, 168]
        ldp     w10, w5, [sp, 176]
        ldp     w4, w15, [sp, 184]
        bne     .L11
        neg     w19, w2, lsr 1
        sub     w12, w12, #2
.LBE36:
.LBE35:
        .loc 1 5 57 discriminator 1
        mov     w16, w3
        sub     w2, w2, #2
        add     w19, w12, w19, lsl 1
        add     w19, w19, w20
        add     w1, w1, w19
        .loc 1 5 42
        cmp     w3, 1
        bne     .L14
        .p2align 5,,15
.L53:
        mov     w0, w15
        mov     w15, w1
        add     w15, w15, 1
        mov     w19, w22
        mov     w20, w23
        mov     w21, w26
        mov     w23, w24
        mov     w1, w4
        ldp     w3, w22, [sp, 112]
        mov     w26, w18
        ldp     w24, w2, [sp, 120]
        mov     w4, w0
        add     w27, w27, w15
.LBE37:
.LBE40:
        cmp     w14, w6
        beq     .L63
.LBB41:
.LBB38:
        ldr     w0, [sp, 108]
.LBE38:
.LBE41:
        mov     w13, w6
        .loc 1 5 44 discriminator 1
        add     w16, w13, 1
.LBB42:
.LBB39:
        .loc 1 5 42
        cmp     w0, w13
        bne     .L64
.L9:
        add     w27, w16, w27
.L16:
        add     w21, w21, w27
.LBE39:
.LBE42:
.LBE32:
.LBE31:
        sub     w26, w26, #2
        .loc 1 5 57 discriminator 1
        mov     w6, w2
        .loc 1 5 42
        cmp     w2, 1
        bne     .L20
        add     w21, w21, 1
        b       .L19
        .p2align 2,,3
.L8:
        .loc 1 5 44 discriminator 1
        sub     w22, w22, #1
        add     w21, w22, w21
.L19:
        add     w8, w8, w21
.LBE30:
.LBE29:
        .loc 1 5 57 discriminator 1
        mov     w2, w24
        .loc 1 5 42
        cmp     w24, 1
        bne     .L23
        mov     w21, w23
        mov     w26, w25
        mov     w22, w3
        mov     w24, w28
        mov     w23, w7
        mov     w0, w11
        mov     w3, w10
        add     w25, w8, 1
.L22:
        add     w22, w22, w25
.LBE28:
.LBE27:
        cmp     w1, 1
        bne     .L26
        mov     w27, w19
        mov     w28, w20
        mov     w25, w23
        mov     w20, w3
        mov     w23, w0
        mov     w19, w4
        mov     w0, w5
        add     w22, w22, 1
        b       .L25
        .p2align 2,,3
.L7:
        mov     w21, w23
        mov     w26, w25
        mov     w22, w3
        mov     w24, w28
        mov     w23, w7
        mov     w0, w11
        mov     w3, w10
        add     w25, w6, w8
        b       .L22
.L6:
        mov     w27, w19
        mov     w28, w20
        mov     w25, w23
        mov     w20, w3
        mov     w23, w0
        mov     w19, w4
        mov     w0, w5
        add     w22, w2, w22
.L25:
        add     w21, w21, w22
.LBE26:
.LBE25:
        cmp     w0, 1
        bne     .L29
        mov     w22, w28
        add     w21, w21, 1
        mov     w28, w25
        b       .L28
        .p2align 2,,3
.L5:
        mov     w22, w28
        add     w21, w1, w21
        mov     w28, w25
.L28:
        add     w22, w22, w21
.LBE24:
.LBE23:
        cmp     w20, 1
        bne     .L32
        add     w22, w22, 1
        mov     w28, w23
.LBE22:
.LBE21:
        .loc 1 5 57 discriminator 1
        mov     w0, w19
        add     w27, w27, w22
        .loc 1 5 42
        cmp     w19, 1
        bne     .L65
.L52:
        ldp     x21, x22, [sp, 32]
        .cfi_remember_state
        .cfi_restore 22
        .cfi_restore 21
        add     w0, w27, 1
        ldp     x23, x24, [sp, 48]
        .cfi_restore 24
        .cfi_restore 23
        ldp     x25, x26, [sp, 64]
        .cfi_restore 26
        .cfi_restore 25
        .loc 1 5 69
        ldp     x19, x20, [sp, 16]
        ldp     x27, x28, [sp, 80]
        ldp     x29, x30, [sp], 192
        .cfi_restore 30
        .cfi_restore 29
        .cfi_restore 27
        .cfi_restore 28
        .cfi_restore 19
        .cfi_restore 20
        .cfi_def_cfa_offset 0
        ret
        .p2align 2,,3
.L4:
        .cfi_restore_state
        add     w22, w0, w22
        mov     w28, w23
        .loc 1 5 57 discriminator 1
        mov     w0, w19
        add     w27, w27, w22
        .loc 1 5 42
        cmp     w19, 1
        beq     .L52
.L65:
        sub     w1, w19, #1
        ldp     x21, x22, [sp, 32]
        .cfi_restore 22
        .cfi_restore 21
        mov     w20, w1
        ldp     x23, x24, [sp, 48]
        .cfi_restore 24
        .cfi_restore 23
        ldp     x25, x26, [sp, 64]
        .cfi_restore 26
        .cfi_restore 25
.LBB44:
.LBB43:
        cmp     w0, w28
        bne     .L66
.L3:
.LBE43:
.LBE44:
        .loc 1 5 69
        ldp     x19, x20, [sp, 16]
        add     w0, w1, w27
        ldp     x27, x28, [sp, 80]
        ldp     x29, x30, [sp], 192
        .cfi_restore 30
        .cfi_restore 29
        .cfi_restore 27
        .cfi_restore 28
        .cfi_restore 19
        .cfi_restore 20
        .cfi_def_cfa_offset 0
        ret
.L59:
        ret
.L63:
        .cfi_def_cfa_offset 192
        .cfi_offset 19, -176
        .cfi_offset 20, -168
        .cfi_offset 21, -160
        .cfi_offset 22, -152
        .cfi_offset 23, -144
        .cfi_offset 24, -136
        .cfi_offset 25, -128
        .cfi_offset 26, -120
        .cfi_offset 27, -112
        .cfi_offset 28, -104
        .cfi_offset 29, -192
        .cfi_offset 30, -184
        add     w27, w13, w27
        b       .L16
        .cfi_endproc
.LFE0:
        .size   fib, .-fib
        .align  2
        .p2align 5,,15
        .global pick
        .type   pick, %function
pick:
.LFB1:
        .loc 1 7 17
        .cfi_startproc
        cmp     w0, 4
        bhi     .L69
        adrp    x1, CSWTCH.4
        add     x1, x1, :lo12:CSWTCH.4
        ldr     w0, [x1, w0, uxtw 2]
        .loc 1 16 1
        ret
        .p2align 2,,3
.L69:
        .loc 1 7 17
        mov     w0, -1
        .loc 1 16 1
        ret
        .cfi_endproc
.LFE1:
        .size   pick, .-pick
        .align  2
        .p2align 5,,15
        .global __asm_editor_main
        .type   __asm_editor_main, %function
__asm_editor_main:
.LFB2:
        .loc 1 18 16
        .cfi_startproc
        stp     x29, x30, [sp, -96]!
        .cfi_def_cfa_offset 96
        .cfi_offset 29, -96
        .cfi_offset 30, -88
        mov     x29, sp
        stp     x25, x26, [sp, 64]
        .cfi_offset 25, -32
        .cfi_offset 26, -24
        adrp    x25, table
        adrp    x26, CSWTCH.4
        add     x25, x25, :lo12:table
        add     x26, x26, :lo12:CSWTCH.4
        str     x27, [sp, 80]
        .cfi_offset 27, -16
.LBB49:
        .loc 1 20 55 discriminator 3
        mov     w27, 43691
        movk    w27, 0xaaaa, lsl 16
.LBE49:
        .loc 1 18 16
        stp     x19, x20, [sp, 16]
        stp     x21, x22, [sp, 32]
        .cfi_offset 19, -80
        .cfi_offset 20, -72
        .cfi_offset 21, -64
        .cfi_offset 22, -56
.LBB58:
.LBB50:
.LBB51:
        .loc 1 5 42
        mov     x21, 0
.LBE51:
.LBE50:
.LBE58:
        .loc 1 18 16
        stp     x23, x24, [sp, 48]
        .cfi_offset 23, -48
        .cfi_offset 24, -40
        .loc 1 19 9
        mov     w24, 0
        .p2align 5,,15
.L71:
.LBB59:
        .loc 1 20 55 discriminator 3
        umull   x20, w21, w27
        mov     w23, w21
        mov     w19, w21
.LBB55:
.LBB52:
        .loc 1 5 42
        mov     w22, 0
.LBE52:
.LBE55:
        .loc 1 20 55 discriminator 3
        lsr     x20, x20, 34
        add     w20, w20, w20, lsl 1
        sub     w20, w21, w20, lsl 1
.LBB56:
.LBB53:
        .loc 1 5 42
        cmp     x21, 1
        bls     .L81
.L72:
        .loc 1 5 44 discriminator 1
        sub     w0, w19, #1
        .loc 1 5 57 discriminator 1
        sub     w19, w19, #2
        .loc 1 5 44 discriminator 1
        bl      fib
        add     w22, w22, w0
        .loc 1 5 42
        cmp     w19, 1
        bgt     .L72
        and     w23, w23, 1
        add     w23, w23, w22
        cmp     w20, 5
        beq     .L76
        ldr     w0, [x26, w20, uxtw 2]
.L73:
.LBE53:
.LBE56:
        .loc 1 20 53 discriminator 3
        mul     w0, w0, w23
        .loc 1 20 44 discriminator 3
        str     w0, [x25, x21, lsl 2]
        .loc 1 20 23 discriminator 2
        add     x21, x21, 1
        .loc 1 20 70 discriminator 3
        add     w24, w24, w0
        .loc 1 20 23 discriminator 2
        cmp     x21, 8
        bne     .L71
.LBE59:
        .loc 1 21 22
        adrp    x0, scale
        scvtf   d31, w24
        .loc 1 23 1
        ldr     x27, [sp, 80]
        .loc 1 21 22
        ldr     d30, [x0, #:lo12:scale]
        .loc 1 23 1
        ldp     x19, x20, [sp, 16]
        .loc 1 21 22
        fmul    d30, d31, d30
        .loc 1 23 1
        ldp     x21, x22, [sp, 32]
        ldp     x25, x26, [sp, 64]
        .loc 1 21 10
        fcvtzs  w0, d30
        .loc 1 21 27
        add     w0, w0, 111
        .loc 1 23 1
        add     w0, w0, w24
        ldp     x23, x24, [sp, 48]
        ldp     x29, x30, [sp], 96
        .cfi_remember_state
        .cfi_restore 30
        .cfi_restore 29
        .cfi_restore 27
        .cfi_restore 25
        .cfi_restore 26
        .cfi_restore 23
        .cfi_restore 24
        .cfi_restore 21
        .cfi_restore 22
        .cfi_restore 19
        .cfi_restore 20
        .cfi_def_cfa_offset 0
        ret
        .p2align 2,,3
.L81:
        .cfi_restore_state
.LBB60:
        .loc 1 20 53 discriminator 3
        ldr     w0, [x26, w20, uxtw 2]
        mul     w0, w0, w21
        .loc 1 20 44 discriminator 3
        str     w0, [x25, x21, lsl 2]
        .loc 1 20 23 discriminator 2
        add     x21, x21, 1
        .loc 1 20 70 discriminator 3
        add     w24, w24, w0
        b       .L71
.L76:
.LBB57:
.LBB54:
        .loc 1 5 42
        mov     w0, -1
        b       .L73
.LBE54:
.LBE57:
.LBE60:
        .cfi_endproc
.LFE2:
        .size   __asm_editor_main, .-__asm_editor_main
        .section        .rodata
        .align  3
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
        .align  3
        .type   table, %object
        .size   table, 32
table:
        .zero   32
        .text
.Letext0:
        .section        .debug_info,"",@progbits
.Ldebug_info0:
        .4byte  0x16f
        .2byte  0x5
        .byte   0x1
        .byte   0x8
        .4byte  .Ldebug_abbrev0
        .uleb128 0x4
        .4byte  .LASF4
        .byte   0x1d
        .4byte  .LASF0
        .4byte  .LASF1
        .8byte  .Ltext0
        .8byte  .Letext0-.Ltext0
        .4byte  .Ldebug_line0
        .uleb128 0x2
        .4byte  .LASF2
        .byte   0x2
        .byte   0x5
        .uleb128 0x9
        .byte   0x3
        .8byte  table
        .uleb128 0x2
        .4byte  .LASF3
        .byte   0x3
        .byte   0x8
        .uleb128 0x9
        .byte   0x3
        .8byte  scale
        .uleb128 0x5
        .4byte  .LASF5
        .byte   0x1
        .byte   0x12
        .byte   0x5
        .8byte  .LFB2
        .8byte  .LFE2-.LFB2
        .uleb128 0x1
        .byte   0x9c
        .4byte  0x83
        .uleb128 0x6
        .4byte  0x8c
        .8byte  .LBB50
        .4byte  .LLRL2
        .byte   0x1
        .byte   0x14
        .byte   0x2e
        .byte   0
        .uleb128 0x7
        .4byte  .LASF6
        .byte   0x1
        .byte   0x7
        .byte   0x5
        .byte   0x1
        .uleb128 0x8
        .string "fib"
        .byte   0x1
        .byte   0x5
        .byte   0xc
        .byte   0x1
        .uleb128 0x9
        .4byte  0x8c
        .8byte  .LFB0
        .8byte  .LFE0-.LFB0
        .uleb128 0x1
        .byte   0x9c
        .4byte  0x15b
        .uleb128 0x3
        .4byte  0x8c
        .8byte  .LBB21
        .4byte  .LLRL0
        .uleb128 0x1
        .4byte  0x8c
        .8byte  .LBB23
        .8byte  .LBE23-.LBB23
        .uleb128 0x1
        .4byte  0x8c
        .8byte  .LBB25
        .8byte  .LBE25-.LBB25
        .uleb128 0x1
        .4byte  0x8c
        .8byte  .LBB27
        .8byte  .LBE27-.LBB27
        .uleb128 0x1
        .4byte  0x8c
        .8byte  .LBB29
        .8byte  .LBE29-.LBB29
        .uleb128 0x1
        .4byte  0x8c
        .8byte  .LBB31
        .8byte  .LBE31-.LBB31
        .uleb128 0x3
        .4byte  0x8c
        .8byte  .LBB33
        .4byte  .LLRL1
        .uleb128 0xa
        .4byte  0x8c
        .8byte  .LBB35
        .8byte  .LBE35-.LBB35
        .byte   0x1
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
        .uleb128 0xb
        .4byte  0x83
        .8byte  .LFB1
        .8byte  .LFE1-.LFB1
        .uleb128 0x1
        .byte   0x9c
        .byte   0
        .section        .debug_abbrev,"",@progbits
.Ldebug_abbrev0:
        .uleb128 0x1
        .uleb128 0x1d
        .byte   0x1
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x58
        .uleb128 0x21
        .sleb128 1
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
        .sleb128 1
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
        .sleb128 1
        .uleb128 0x59
        .uleb128 0x21
        .sleb128 5
        .uleb128 0x57
        .uleb128 0x21
        .sleb128 44
        .byte   0
        .byte   0
        .uleb128 0x4
        .uleb128 0x11
        .byte   0x1
        .uleb128 0x25
        .uleb128 0xe
        .uleb128 0x13
        .uleb128 0xb
        .uleb128 0x3
        .uleb128 0x1f
        .uleb128 0x1b
        .uleb128 0x1f
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x10
        .uleb128 0x17
        .byte   0
        .byte   0
        .uleb128 0x5
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
        .uleb128 0x7
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
        .uleb128 0x19
        .uleb128 0x1
        .uleb128 0x13
        .byte   0
        .byte   0
        .uleb128 0x6
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
        .uleb128 0x7
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
        .uleb128 0x8
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
        .uleb128 0x9
        .uleb128 0x2e
        .byte   0x1
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
        .uleb128 0x19
        .uleb128 0x1
        .uleb128 0x13
        .byte   0
        .byte   0
        .uleb128 0xa
        .uleb128 0x1d
        .byte   0
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x58
        .uleb128 0xb
        .uleb128 0x59
        .uleb128 0xb
        .uleb128 0x57
        .uleb128 0xb
        .byte   0
        .byte   0
        .uleb128 0xb
        .uleb128 0x2e
        .byte   0
        .uleb128 0x31
        .uleb128 0x13
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7a
        .uleb128 0x19
        .byte   0
        .byte   0
        .byte   0
        .section        .debug_aranges,"",@progbits
        .4byte  0x2c
        .2byte  0x2
        .4byte  .Ldebug_info0
        .byte   0x8
        .byte   0
        .2byte  0
        .2byte  0
        .8byte  .Ltext0
        .8byte  .Letext0-.Ltext0
        .8byte  0
        .8byte  0
        .section        .debug_rnglists,"",@progbits
.Ldebug_ranges0:
        .4byte  .Ldebug_ranges3-.Ldebug_ranges2
.Ldebug_ranges2:
        .2byte  0x5
        .byte   0x8
        .byte   0
        .4byte  0
.LLRL0:
        .byte   0x4
        .uleb128 .LBB21-.Ltext0
        .uleb128 .LBE21-.Ltext0
        .byte   0x4
        .uleb128 .LBB44-.Ltext0
        .uleb128 .LBE44-.Ltext0
        .byte   0
.LLRL1:
        .byte   0x4
        .uleb128 .LBB33-.Ltext0
        .uleb128 .LBE33-.Ltext0
        .byte   0x4
        .uleb128 .LBB40-.Ltext0
        .uleb128 .LBE40-.Ltext0
        .byte   0x4
        .uleb128 .LBB41-.Ltext0
        .uleb128 .LBE41-.Ltext0
        .byte   0x4
        .uleb128 .LBB42-.Ltext0
        .uleb128 .LBE42-.Ltext0
        .byte   0
.LLRL2:
        .byte   0x4
        .uleb128 .LBB50-.Ltext0
        .uleb128 .LBE50-.Ltext0
        .byte   0x4
        .uleb128 .LBB55-.Ltext0
        .uleb128 .LBE55-.Ltext0
        .byte   0x4
        .uleb128 .LBB56-.Ltext0
        .uleb128 .LBE56-.Ltext0
        .byte   0x4
        .uleb128 .LBB57-.Ltext0
        .uleb128 .LBE57-.Ltext0
        .byte   0
.Ldebug_ranges3:
        .section        .debug_line,"",@progbits
.Ldebug_line0:
        .section        .debug_str,"MS",@progbits,1
.LASF6:
        .string "pick"
.LASF3:
        .string "scale"
.LASF2:
        .string "table"
.LASF4:
        .string "GNU C17 14.2.0 -mlittle-endian -mabi=lp64 -g -g1 -O2 -std=c17 -ffreestanding -fno-stack-protector -fno-pie -fno-section-anchors"
.LASF5:
        .string "__asm_editor_main"
        .section        .debug_line_str,"MS",@progbits,1
.LASF0:
        .string "/app/example.c"
.LASF1:
        .string "/app"
        .ident  "GCC: (GNU) 14.2.0"
        .section        .note.GNU-stack,"",@progbits
