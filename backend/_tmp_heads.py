import glob
import re

rev = {}
down = set()
for p in glob.glob("alembic/versions/*.py"):
    s = open(p, encoding="utf-8").read()
    m = re.search(r"^revision(?::\s*str)?\s*=\s*['\"]([^'\"]+)", s, re.M)
    d = re.search(r"^down_revision(?::[^=]+)?\s*=\s*['\"]([^'\"]+)", s, re.M)
    if m:
        rev[m.group(1)] = p
    if d:
        down.add(d.group(1))
print("heads:", [r for r in rev if r not in down])
