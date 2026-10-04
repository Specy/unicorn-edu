#!/usr/bin/env python3
"""Regenerates ts/src/{arm,arm64}-register-ids.ts from Unicorn's headers (run from the repo root)."""
import re


def enum_values(header, enum):
    src = open(header).read()
    body = re.search(r'typedef enum %s \{(.*?)\} %s;' % (enum, enum), src, re.S).group(1)
    body = re.sub(r'//[^\n]*', '', body)
    body = re.sub(r'/\*.*?\*/', '', body, flags=re.S)
    values = {}
    n = 0
    for token in [t.strip() for t in body.split(',')]:
        if not token:
            continue
        if '=' in token:
            name, expr = [x.strip() for x in token.split('=')]
            n = values[expr] if expr in values else int(expr, 0)
        else:
            name = token
        values[name] = n
        n += 1
    return values


def write(path, header, enum, prefix, constant, keep):
    pattern = re.compile(keep)
    lines = [f'// Generated from {header} by scripts/gen-register-ids.py.',
             '// Unicorn register ids, as the machine layer takes them.',
             f'export const {constant} = {{']
    for name, value in enum_values(header, enum).items():
        short = name[len(prefix):]
        if pattern.fullmatch(short):
            lines.append(f'    {short}: {value},')
    lines += ['} as const', '']
    open(path, 'w').write('\n'.join(lines))


write('ts/src/arm-register-ids.ts', 'third_party/unicorn/include/unicorn/arm.h', 'uc_arm_reg',
      'UC_ARM_REG_', 'UC_ARM_REG',
      r'(R\d+|SP|LR|PC|CPSR|APSR|APSR_NZCV|SPSR|FPSCR|FPSCR_NZCV|FPEXC|FPSID|D\d+|S\d+|Q\d+|C1_C0_2)')
write('ts/src/arm64-register-ids.ts', 'third_party/unicorn/include/unicorn/arm64.h', 'uc_arm64_reg',
      'UC_ARM64_REG_', 'UC_ARM64_REG',
      r'(X\d+|W\d+|SP|WSP|PC|NZCV|PSTATE|FPCR|FPSR|V\d+|Q\d+|D\d+|S\d+|H\d+|B\d+|FP|LR|XZR|WZR|TPIDR_EL0)')
