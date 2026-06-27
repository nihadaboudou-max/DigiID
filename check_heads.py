#!/usr/bin/env python3
"""Check Alembic migration chain for multiple heads."""
import os, re

d = 'backend/alembic/versions'
files = [f for f in os.listdir(d) if f.endswith('.py') and f not in ('.gitkeep',)]
entries = []
for f in sorted(files):
    content = open(os.path.join(d, f), encoding='utf-8').read()
    # Handle both 'revision = "xxx"' and 'revision: str = "xxx"' formats
    rev_m = re.search(r'^revision(?:\s*:\s*[^=]+)?\s*=\s*[\"\']([^\"\']+)[\"\']', content, re.MULTILINE)
    down_m = re.search(r'^down_revision(?:\s*:\s*[^=]+)?\s*=\s*[\"\']([^\"\']+)[\"\']', content, re.MULTILINE)
    down_none = re.search(r'^down_revision(?:\s*:\s*[^=]+)?\s*=\s*None', content, re.MULTILINE)
    if rev_m:
        r = rev_m.group(1)
        d_rev = 'None' if down_none else (down_m.group(1) if down_m else '???')
        entries.append((r, d_rev, f))

revs = set(e[0] for e in entries)
parents = set(e[1] for e in entries if e[1] != 'None')
heads = revs - parents
roots = set(e[0] for e in entries if e[1] == 'None')

print('Racines:', roots)
print('Tetes:', heads)
if len(heads) > 1:
    print('PROBLEME: Multiples tetes!')
    for h in heads:
        print(f'  -> {h}')
else:
    print(f'OK: Une seule tete: {heads.pop() if heads else "AUCUNE"}')

print()
for r, d_rev, f in entries:
    m = ' <- TETE' if r in heads else ''
    print(f'{r[:45]:45s} <- {d_rev[:45]:45s}  [{f[:30]}]')
