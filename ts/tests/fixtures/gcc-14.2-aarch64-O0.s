        .arch armv8-a
        .file   "example.c"
        .text
.Ltext0:
        .file 0 "/app" "/app/example.c"
        .section        .rodata
        .align  3
.LC0:
        .string "zero"
        .align  3
.LC1:
        .string "one"
        .align  3
.LC2:
        .string "two"
        .data
        .align  3
        .type   names, %object
        .size   names, 24
names:
        .xword  .LC0
        .xword  .LC1
        .xword  .LC2
        .global table
        .bss
        .align  3
        .type   table, %object
        .size   table, 32
table:
        .zero   32
        .global scale
        .data
        .align  3
        .type   scale, %object
        .size   scale, 8
scale:
        .word   0
        .word   1073217536
        .text
        .align  2
        .type   fib, %function
fib:
.LFB0:
        .file 1 "main.c"
        .loc 1 5 23
        .cfi_startproc
        stp     x29, x30, [sp, -48]!
        .cfi_def_cfa_offset 48
        .cfi_offset 29, -48
        .cfi_offset 30, -40
        mov     x29, sp
        str     x19, [sp, 16]
        .cfi_offset 19, -32
        str     w0, [sp, 44]
        .loc 1 5 42
        ldr     w0, [sp, 44]
        cmp     w0, 1
        ble     .L2
        .loc 1 5 44 discriminator 1
        ldr     w0, [sp, 44]
        sub     w0, w0, #1
        bl      fib
        mov     w19, w0
        .loc 1 5 57 discriminator 1
        ldr     w0, [sp, 44]
        sub     w0, w0, #2
        bl      fib
        .loc 1 5 42 discriminator 2
        add     w0, w19, w0
        .loc 1 5 42 is_stmt 0
        b       .L4
.L2:
        .loc 1 5 42 discriminator 2
        ldr     w0, [sp, 44]
.L4:
        .loc 1 5 69 is_stmt 1
        ldr     x19, [sp, 16]
        ldp     x29, x30, [sp], 48
        .cfi_restore 30
        .cfi_restore 29
        .cfi_restore 19
        .cfi_def_cfa_offset 0
        ret
        .cfi_endproc
.LFE0:
        .size   fib, .-fib
        .align  2
        .global pick
        .type   pick, %function
pick:
.LFB1:
        .loc 1 7 17
        .cfi_startproc
        sub     sp, sp, #16
        .cfi_def_cfa_offset 16
        str     w0, [sp, 12]
        .loc 1 8 5
        ldr     w0, [sp, 12]
        cmp     w0, 4
        beq     .L6
        ldr     w0, [sp, 12]
        cmp     w0, 4
        bgt     .L7
        ldr     w0, [sp, 12]
        cmp     w0, 3
        beq     .L8
        ldr     w0, [sp, 12]
        cmp     w0, 3
        bgt     .L7
        ldr     w0, [sp, 12]
        cmp     w0, 2
        beq     .L9
        ldr     w0, [sp, 12]
        cmp     w0, 2
        bgt     .L7
        ldr     w0, [sp, 12]
        cmp     w0, 0
        beq     .L10
        ldr     w0, [sp, 12]
        cmp     w0, 1
        beq     .L11
        b       .L7
.L10:
        .loc 1 9 20
        mov     w0, 10
        b       .L12
.L11:
        .loc 1 10 20
        mov     w0, 20
        b       .L12
.L9:
        .loc 1 11 20
        mov     w0, 33
        b       .L12
.L8:
        .loc 1 12 20
        mov     w0, 47
        b       .L12
.L6:
        .loc 1 13 20
        mov     w0, 51
        b       .L12
.L7:
        .loc 1 14 21
        mov     w0, -1
.L12:
        .loc 1 16 1
        add     sp, sp, 16
        .cfi_def_cfa_offset 0
        ret
        .cfi_endproc
.LFE1:
        .size   pick, .-pick
        .align  2
        .global __asm_editor_main
        .type   __asm_editor_main, %function
__asm_editor_main:
.LFB2:
        .loc 1 18 16
        .cfi_startproc
        stp     x29, x30, [sp, -48]!
        .cfi_def_cfa_offset 48
        .cfi_offset 29, -48
        .cfi_offset 30, -40
        mov     x29, sp
        str     x19, [sp, 16]
        .cfi_offset 19, -32
        .loc 1 19 9
        str     wzr, [sp, 44]
.LBB2:
        .loc 1 20 14
        str     wzr, [sp, 40]
        .loc 1 20 5
        b       .L14
.L15:
        .loc 1 20 46 discriminator 3
        ldr     w0, [sp, 40]
        bl      fib
        mov     w19, w0
        .loc 1 20 55 discriminator 3
        ldr     w1, [sp, 40]
        mov     w0, 43691
        movk    w0, 0x2aaa, lsl 16
        smull   x0, w1, w0
        lsr     x2, x0, 32
        asr     w0, w1, 31
        sub     w2, w2, w0
        mov     w0, w2
        lsl     w0, w0, 1
        add     w0, w0, w2
        lsl     w0, w0, 1
        sub     w2, w1, w0
        mov     w0, w2
        bl      pick
        .loc 1 20 53 discriminator 3
        mul     w2, w19, w0
        .loc 1 20 44 discriminator 3
        adrp    x0, table
        add     x0, x0, :lo12:table
        ldrsw   x1, [sp, 40]
        str     w2, [x0, x1, lsl 2]
        .loc 1 20 78 discriminator 3
        adrp    x0, table
        add     x0, x0, :lo12:table
        ldrsw   x1, [sp, 40]
        ldr     w0, [x0, x1, lsl 2]
        .loc 1 20 70 discriminator 3
        ldr     w1, [sp, 44]
        add     w0, w1, w0
        str     w0, [sp, 44]
        .loc 1 20 29 discriminator 3
        ldr     w0, [sp, 40]
        add     w0, w0, 1
        str     w0, [sp, 40]
.L14:
        .loc 1 20 23 discriminator 2
        ldr     w0, [sp, 40]
        cmp     w0, 7
        ble     .L15
.LBE2:
        .loc 1 21 22
        ldr     w0, [sp, 44]
        scvtf   d30, w0
        adrp    x0, scale
        add     x0, x0, :lo12:scale
        ldr     d31, [x0]
        fmul    d31, d30, d31
        .loc 1 21 10
        fcvtzs  w0, d31
        .loc 1 21 34
        adrp    x1, names
        add     x1, x1, :lo12:names
        ldr     x1, [x1, 8]
        .loc 1 21 37
        ldrb    w1, [x1]
        .loc 1 21 27
        add     w0, w0, w1
        .loc 1 21 7
        ldr     w1, [sp, 44]
        add     w0, w1, w0
        str     w0, [sp, 44]
        .loc 1 22 12
        ldr     w0, [sp, 44]
        .loc 1 23 1
        ldr     x19, [sp, 16]
        ldp     x29, x30, [sp], 48
        .cfi_restore 30
        .cfi_restore 29
        .cfi_restore 19
        .cfi_def_cfa_offset 0
        ret
        .cfi_endproc
.LFE2:
        .size   __asm_editor_main, .-__asm_editor_main
.Letext0:
        .section        .debug_info,"",@progbits
.Ldebug_info0:
        .4byte  0x9b
        .2byte  0x5
        .byte   0x1
        .byte   0x8
        .4byte  .Ldebug_abbrev0
        .uleb128 0x2
        .4byte  .LASF6
        .byte   0x1d
        .4byte  .LASF0
        .4byte  .LASF1
        .8byte  .Ltext0
        .8byte  .Letext0-.Ltext0
        .4byte  .Ldebug_line0
        .uleb128 0x1
        .4byte  .LASF2
        .byte   0x2
        .byte   0x5
        .uleb128 0x9
        .byte   0x3
        .8byte  table
        .uleb128 0x1
        .4byte  .LASF3
        .byte   0x3
        .byte   0x8
        .uleb128 0x9
        .byte   0x3
        .8byte  scale
        .uleb128 0x3
        .4byte  .LASF4
        .byte   0x1
        .byte   0x12
        .byte   0x5
        .8byte  .LFB2
        .8byte  .LFE2-.LFB2
        .uleb128 0x1
        .byte   0x9c
        .uleb128 0x4
        .4byte  .LASF5
        .byte   0x1
        .byte   0x7
        .byte   0x5
        .8byte  .LFB1
        .8byte  .LFE1-.LFB1
        .uleb128 0x1
        .byte   0x9c
        .uleb128 0x5
        .string "fib"
        .byte   0x1
        .byte   0x5
        .byte   0xc
        .8byte  .LFB0
        .8byte  .LFE0-.LFB0
        .uleb128 0x1
        .byte   0x9c
        .byte   0
        .section        .debug_abbrev,"",@progbits
.Ldebug_abbrev0:
        .uleb128 0x1
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
        .uleb128 0x2
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
        .uleb128 0x3
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
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
        .uleb128 0x19
        .byte   0
        .byte   0
        .uleb128 0x4
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
        .uleb128 0x5
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
        .uleb128 0x11
        .uleb128 0x1
        .uleb128 0x12
        .uleb128 0x7
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
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
        .section        .debug_line,"",@progbits
.Ldebug_line0:
        .section        .debug_str,"MS",@progbits,1
.LASF6:
        .string "GNU C17 14.2.0 -mlittle-endian -mabi=lp64 -g -g1 -O0 -std=c17 -ffreestanding -fno-stack-protector -fno-pie -fno-section-anchors"
.LASF3:
        .string "scale"
.LASF2:
        .string "table"
.LASF5:
        .string "pick"
.LASF4:
        .string "__asm_editor_main"
        .section        .debug_line_str,"MS",@progbits,1
.LASF0:
        .string "/app/example.c"
.LASF1:
        .string "/app"
        .ident  "GCC: (GNU) 14.2.0"
        .section        .note.GNU-stack,"",@progbits
