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
        .eabi_attribute 30, 6
        .eabi_attribute 34, 1
        .eabi_attribute 18, 4
        .file   "example.c"
        .text
.Ltext0:
        .cfi_sections   .debug_frame
        .file 1 "/app/example.c"
        .section        .rodata
        .align  2
.LC0:
        .ascii  "zero\000"
        .align  2
.LC1:
        .ascii  "one\000"
        .align  2
.LC2:
        .ascii  "two\000"
        .data
        .align  2
        .type   names, %object
        .size   names, 12
names:
        .word   .LC0
        .word   .LC1
        .word   .LC2
        .global table
        .bss
        .align  2
        .type   table, %object
        .size   table, 32
table:
        .space  32
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
        .syntax unified
        .arm
        .type   fib, %function
fib:
.LFB0:
        .file 2 "main.c"
        .loc 2 5 23
        .cfi_startproc
        @ args = 0, pretend = 0, frame = 8
        @ frame_needed = 1, uses_anonymous_args = 0
        str     r4, [sp, #-12]!
        .cfi_def_cfa_offset 12
        .cfi_offset 4, -12
        .cfi_offset 11, -8
        .cfi_offset 14, -4
        str     fp, [sp, #4]
        str     lr, [sp, #8]
        add     fp, sp, #8
        .cfi_def_cfa 11, 4
        sub     sp, sp, #12
        str     r0, [fp, #-16]
        .loc 2 5 42
        ldr     r3, [fp, #-16]
        cmp     r3, #1
        ble     .L2
        .loc 2 5 44 discriminator 1
        ldr     r3, [fp, #-16]
        sub     r3, r3, #1
        mov     r0, r3
        bl      fib
        mov     r4, r0
        .loc 2 5 57 discriminator 1
        ldr     r3, [fp, #-16]
        sub     r3, r3, #2
        mov     r0, r3
        bl      fib
        mov     r3, r0
        .loc 2 5 42 discriminator 2
        add     r3, r4, r3
        .loc 2 5 42 is_stmt 0
        b       .L4
.L2:
        .loc 2 5 42 discriminator 2
        ldr     r3, [fp, #-16]
.L4:
        .loc 2 5 69 is_stmt 1
        mov     r0, r3
        sub     sp, fp, #8
        .cfi_def_cfa 13, 12
        @ sp needed
        ldr     r4, [sp]
        .cfi_restore 4
        ldr     fp, [sp, #4]
        .cfi_restore 11
        add     sp, sp, #8
        .cfi_def_cfa_offset 4
        ldr     pc, [sp], #4
        .cfi_restore 15
        .cfi_def_cfa_offset 0
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
        @ args = 0, pretend = 0, frame = 8
        @ frame_needed = 1, uses_anonymous_args = 0
        @ link register save eliminated.
        str     fp, [sp, #-4]!
        .cfi_def_cfa_offset 4
        .cfi_offset 11, -4
        add     fp, sp, #0
        .cfi_def_cfa_register 11
        sub     sp, sp, #12
        str     r0, [fp, #-8]
        .loc 2 8 5
        ldr     r2, [fp, #-8]
        ldr     r3, .L14
        cmp     r2, #4
        bhi     .L6
        ldr     pc, [r3, r2, lsl #2]
.Lrtx8:
        nop
        .section        .rodata
        .align  2
.L8:
        .word   .L12
        .word   .L11
        .word   .L10
        .word   .L9
        .word   .L7
        .text
        .p2align 2
.L12:
        .loc 2 9 20
        mov     r3, #10
        b       .L13
.L11:
        .loc 2 10 20
        mov     r3, #20
        b       .L13
.L10:
        .loc 2 11 20
        mov     r3, #33
        b       .L13
.L9:
        .loc 2 12 20
        mov     r3, #47
        b       .L13
.L7:
        .loc 2 13 20
        mov     r3, #51
        b       .L13
.L6:
        .loc 2 14 21
        mvn     r3, #0
.L13:
        .loc 2 16 1
        mov     r0, r3
        add     sp, fp, #0
        .cfi_def_cfa_register 13
        @ sp needed
        ldr     fp, [sp], #4
        .cfi_restore 11
        .cfi_def_cfa_offset 0
        bx      lr
.L15:
        .align  2
.L14:
        .word   .L8
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
        @ args = 0, pretend = 0, frame = 8
        @ frame_needed = 1, uses_anonymous_args = 0
        str     r4, [sp, #-12]!
        .cfi_def_cfa_offset 12
        .cfi_offset 4, -12
        .cfi_offset 11, -8
        .cfi_offset 14, -4
        str     fp, [sp, #4]
        str     lr, [sp, #8]
        add     fp, sp, #8
        .cfi_def_cfa 11, 4
        sub     sp, sp, #12
        .loc 2 19 9
        mov     r3, #0
        str     r3, [fp, #-16]
.LBB2:
        .loc 2 20 14
        mov     r3, #0
        str     r3, [fp, #-20]
        .loc 2 20 5
        b       .L17
.L18:
        .loc 2 20 46 discriminator 3
        ldr     r0, [fp, #-20]
        bl      fib
        mov     r4, r0
        .loc 2 20 55 discriminator 3
        ldr     r2, [fp, #-20]
        movw    r3, #43691
        movt    r3, 10922
        smull   r3, r1, r3, r2
        asr     r3, r2, #31
        sub     r1, r1, r3
        mov     r3, r1
        lsl     r3, r3, #1
        add     r3, r3, r1
        lsl     r3, r3, #1
        sub     r1, r2, r3
        mov     r0, r1
        bl      pick
        mov     r3, r0
        .loc 2 20 53 discriminator 3
        mul     r1, r3, r4
        .loc 2 20 44 discriminator 3
        movw    r3, #:lower16:table
        movt    r3, #:upper16:table
        ldr     r2, [fp, #-20]
        str     r1, [r3, r2, lsl #2]
        .loc 2 20 78 discriminator 3
        movw    r3, #:lower16:table
        movt    r3, #:upper16:table
        ldr     r2, [fp, #-20]
        ldr     r3, [r3, r2, lsl #2]
        .loc 2 20 70 discriminator 3
        ldr     r2, [fp, #-16]
        add     r3, r2, r3
        str     r3, [fp, #-16]
        .loc 2 20 29 discriminator 3
        ldr     r3, [fp, #-20]
        add     r3, r3, #1
        str     r3, [fp, #-20]
.L17:
        .loc 2 20 23 discriminator 2
        ldr     r3, [fp, #-20]
        cmp     r3, #7
        ble     .L18
.LBE2:
        .loc 2 21 22
        ldr     r3, [fp, #-16]
        vmov    s15, r3 @ int
        vcvt.f64.s32    d17, s15
        movw    r3, #:lower16:scale
        movt    r3, #:upper16:scale
        vldr.64 d16, [r3]
        vmul.f64        d16, d17, d16
        .loc 2 21 10
        vcvt.s32.f64    s15, d16
        vmov    r2, s15 @ int
        .loc 2 21 34
        movw    r3, #:lower16:names
        movt    r3, #:upper16:names
        ldr     r3, [r3, #4]
        .loc 2 21 37
        ldrb    r3, [r3]        @ zero_extendqisi2
        .loc 2 21 27
        add     r3, r2, r3
        .loc 2 21 7
        ldr     r2, [fp, #-16]
        add     r3, r2, r3
        str     r3, [fp, #-16]
        .loc 2 22 12
        ldr     r3, [fp, #-16]
        .loc 2 23 1
        mov     r0, r3
        sub     sp, fp, #8
        .cfi_def_cfa 13, 12
        @ sp needed
        ldr     r4, [sp]
        .cfi_restore 4
        ldr     fp, [sp, #4]
        .cfi_restore 11
        add     sp, sp, #8
        .cfi_def_cfa_offset 4
        ldr     pc, [sp], #4
        .cfi_restore 15
        .cfi_def_cfa_offset 0
        .cfi_endproc
.LFE2:
        .size   __asm_editor_main, .-__asm_editor_main
.Letext0:
        .section        .debug_info,"",%progbits
.Ldebug_info0:
        .4byte  0x73
        .2byte  0x5
        .byte   0x1
        .byte   0x4
        .4byte  .Ldebug_abbrev0
        .uleb128 0x2
        .4byte  .LASF4
        .byte   0x1d
        .4byte  .LASF5
        .4byte  .LASF6
        .4byte  .Ltext0
        .4byte  .Letext0-.Ltext0
        .4byte  .Ldebug_line0
        .uleb128 0x1
        .4byte  .LASF0
        .byte   0x2
        .byte   0x5
        .uleb128 0x5
        .byte   0x3
        .4byte  table
        .uleb128 0x1
        .4byte  .LASF1
        .byte   0x3
        .byte   0x8
        .uleb128 0x5
        .byte   0x3
        .4byte  scale
        .uleb128 0x3
        .4byte  .LASF2
        .byte   0x2
        .byte   0x12
        .byte   0x5
        .4byte  .LFB2
        .4byte  .LFE2-.LFB2
        .uleb128 0x1
        .byte   0x9c
        .uleb128 0x4
        .4byte  .LASF3
        .byte   0x2
        .byte   0x7
        .byte   0x5
        .4byte  .LFB1
        .4byte  .LFE1-.LFB1
        .uleb128 0x1
        .byte   0x9c
        .uleb128 0x5
        .ascii  "fib\000"
        .byte   0x2
        .byte   0x5
        .byte   0xc
        .4byte  .LFB0
        .4byte  .LFE0-.LFB0
        .uleb128 0x1
        .byte   0x9c
        .byte   0
        .section        .debug_abbrev,"",%progbits
.Ldebug_abbrev0:
        .uleb128 0x1
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
        .uleb128 0x2
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
        .uleb128 0x6
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
        .uleb128 0x6
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
        .uleb128 0x6
        .uleb128 0x40
        .uleb128 0x18
        .uleb128 0x7c
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
        .section        .debug_line,"",%progbits
.Ldebug_line0:
        .section        .debug_str,"MS",%progbits,1
.LASF3:
        .ascii  "pick\000"
.LASF2:
        .ascii  "__asm_editor_main\000"
.LASF1:
        .ascii  "scale\000"
.LASF4:
        .ascii  "GNU C17 14.2.0 -mcpu=cortex-a15 -mfloat-abi=hard -m"
        .ascii  "fpu=vfpv4 -marm -march=armv7ve+vfpv4 -g -g1 -O0 -st"
        .ascii  "d=c17 -ffreestanding -fno-stack-protector -fno-pie "
        .ascii  "-fno-section-anchors\000"
.LASF0:
        .ascii  "table\000"
.LASF5:
        .ascii  "/app/example.c\000"
.LASF6:
        .ascii  "/app\000"
        .ident  "GCC: (crosstool-NG UNKNOWN) 14.2.0"
