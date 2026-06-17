import re

files = [
    'alembic/versions/20260610_1200_d5e6f7a8b9c0_ui_role_config.py',
    'alembic/versions/20260612_1000_professionnels_services.py',
    'alembic/versions/20260617_1900_facteur_attestations_score.py',
]

for f in files:
    with open(f) as fh:
        content = fh.read()
    rev = re.search(r"revision:\s*['\"]([^'\"]+)['\"]", content)
    down = re.search(r"down_revision:\s*['\"]([^'\"]+)['\"]", content)
    name = f.split("/")[-1]
    rev_id = rev.group(1) if rev else "?"
    down_id = down.group(1) if down else "?"
    ok = "✓" if rev_id == name.replace(".py", "") or len(rev_id) > 6 else "?"
    print(f"{name:55s} rev={rev_id:40s} down={down_id:40s}")
