#!/usr/bin/env python3
"""Regenerates ts/src/arm-register-ids.ts from Unicorn's arm.h (run from the repo root)."""
import re

src = open('third_party/unicorn/include/unicorn/arm.h').read()
body = re.search(r'typedef enum uc_arm_reg \{(.*?)\} uc_arm_reg;', src, re.S).group(1)
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
pattern = re.compile(
    r'(R\d+|SP|LR|PC|CPSR|APSR|APSR_NZCV|SPSR|FPSCR|FPSCR_NZCV|FPEXC|FPSID|D\d+|S\d+|Q\d+'
    r'|C1_C0_2|IPSR|MSP|PSP|CONTROL|IAPSR|EAPSR|XPSR|EPSR|IEPSR|PRIMASK|BASEPRI|BASEPRI_MAX'
    r'|FAULTMASK)')
lines = ['// Generated from third_party/unicorn/include/unicorn/arm.h by scripts/gen-arm-registers.py.',
         '// Unicorn register ids, as the machine layer takes them.',
         'export const UC_ARM_REG = {']
for name, value in values.items():
    short = name[len('UC_ARM_REG_'):]
    if pattern.fullmatch(short):
        lines.append(f'    {short}: {value},')
lines += ['} as const', '', 'export type UcArmRegisterName = keyof typeof UC_ARM_REG']
open('ts/src/arm-register-ids.ts', 'w').write('\n'.join(lines) + '\n')
