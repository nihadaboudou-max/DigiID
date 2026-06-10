"""Verifie que tous les modules exportent correctement leur routeur."""
import ast, os, glob

modules_with_issues = []
for module_dir in glob.glob('src/modules/*/'):
    init_file = os.path.join(module_dir, '__init__.py')
    if os.path.exists(init_file):
        with open(init_file, 'r', encoding='utf-8') as f:
            content = f.read()
            tree = ast.parse(content)
            exports = []
            for node in ast.walk(tree):
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    for alias in node.names:
                        name = alias.name if alias.asname else alias.name
                        exports.append(name)
            module_name = module_dir.split(os.sep)[-2]
            routeur_name = f'routeur_{module_name}'
            if not any(routeur_name in e for e in exports):
                modules_with_issues.append(f'{module_name}: pas de {routeur_name}. Exporte: {exports}')

if modules_with_issues:
    for m in modules_with_issues:
        print(f'ISSUE: {m}')
else:
    print('OK: Tous les modules exportent correctement leurs routeurs')
