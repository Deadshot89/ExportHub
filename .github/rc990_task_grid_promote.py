from pathlib import Path

path = Path('.github/rc990_design_apply.py')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''  /* RC990 task tile grid: current RC628 task lists and planner lists are compact responsive grids. */\n  body[data-exporthub-view="tasks"] #content .rc229-task-grid {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: var(--rc990-card-gap) !important;\n    align-items: start !important;\n  }''',
'''  /* RC990 task tile grid: current RC628 task lists and planner lists are compact responsive grids. */\n  #content .rc229-task-grid {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: var(--rc990-card-gap) !important;\n    align-items: start !important;\n  }\n  body[data-exporthub-view="tasks"] #content .rc229-task-grid {\n    display: grid !important;\n    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;\n    gap: var(--rc990-card-gap) !important;\n    align-items: start !important;\n  }'''
    ),
    (
'''  /* RC628 cards previously reserved too much vertical space; RC990 keeps all information but removes empty padding. */\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task :is(.rc628-task-ref, .rc628-task-customer) {''',
'''  /* RC628 cards previously reserved too much vertical space; RC990 keeps all information but removes empty padding. */\n  #content .rc229-task-card.rc628-unified-task :is(.rc628-task-ref, .rc628-task-customer),\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task :is(.rc628-task-ref, .rc628-task-customer) {'''
    ),
    (
'''  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-customer {\n    font-size: 15px !important;\n  }\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status {''',
'''  #content .rc229-task-card.rc628-unified-task .rc628-task-customer,\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-customer {\n    font-size: 15px !important;\n  }\n  #content .rc229-task-card.rc628-unified-task .rc628-task-status,\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status {'''
    ),
    (
'''  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status :is(.pill, span) {\n    padding: 3px 8px !important;\n    font-size: 10px !important;\n  }''',
'''  #content .rc229-task-card.rc628-unified-task .rc628-task-status :is(.pill, span),\n  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status :is(.pill, span) {\n    padding: 3px 8px !important;\n    font-size: 10px !important;\n  }'''
    ),
    (
'''  @media (max-width: 1000px) {\n    /* RC990 task tile grid: two columns on medium screens. */\n    body[data-exporthub-view="tasks"] #content .rc229-task-grid {''',
'''  @media (max-width: 1000px) {\n    /* RC990 task tile grid: two columns on medium screens. */\n    #content .rc229-task-grid,\n    body[data-exporthub-view="tasks"] #content .rc229-task-grid {'''
    ),
    (
'''  @media (max-width: 700px) {\n    /* RC990 task tile grid: one column on phones. */\n    body[data-exporthub-view="tasks"] #content .rc229-task-grid {''',
'''  @media (max-width: 700px) {\n    /* RC990 task tile grid: one column on phones. */\n    #content .rc229-task-grid,\n    body[data-exporthub-view="tasks"] #content .rc229-task-grid {'''
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one canonical target, found {count}: {old[:90]!r}')
    text = text.replace(old, new, 1)

# Stronger visible hierarchy for the current tasks surface, still inside the canonical layer.
anchor = '''  /* RC990 task card identity: compact, clearly bounded and fast to scan. */'''
visible = '''  /* Current tasks section shells: visible RC990 hierarchy without changing task logic. */\n  #content .rc229-day-section {\n    background: linear-gradient(180deg, #f8fbff 0%, #f3f8fd 100%) !important;\n    border: 1px solid var(--rc990-card-border) !important;\n    border-radius: calc(var(--rc990-radius) + 2px) !important;\n    box-shadow: 0 5px 18px rgba(15, 23, 42, .05) !important;\n    padding: 12px !important;\n  }\n  #content .rc229-task-group {\n    background: rgba(255,255,255,.72) !important;\n    border: 1px solid #d7e7f4 !important;\n    border-radius: var(--rc990-radius) !important;\n    overflow: hidden !important;\n  }\n  #content .rc229-task-group > :first-child {\n    background: #eef7fd !important;\n  }\n\n'''
if visible not in text:
    if text.count(anchor) != 1:
        raise SystemExit('Task-card identity anchor not unique')
    text = text.replace(anchor, visible + anchor, 1)

# The active RC628 cards must not depend on a body view marker. Keep this rule
# standalone so the contract and browser cascade both prove that directly.
card_anchor = '''  /* RC628 cards previously reserved too much vertical space; RC990 keeps all information but removes empty padding. */'''
direct_card = '''  #content .rc229-task-card.rc628-unified-task {\n    position: relative;\n    width: auto !important;\n    min-width: 0 !important;\n    max-width: none !important;\n    margin: 0 !important;\n    background: linear-gradient(180deg, var(--rc990-surface) 0%, var(--rc990-surface-soft) 100%) !important;\n    border: 1px solid var(--rc990-card-border) !important;\n    border-left: 5px solid var(--rc990-task-accent) !important;\n    box-shadow: var(--rc990-card-shadow) !important;\n    padding: 12px 14px !important;\n    border-radius: var(--rc990-radius) !important;\n    box-sizing: border-box !important;\n    overflow: hidden;\n  }\n\n'''
if direct_card not in text:
    if text.count(card_anchor) != 1:
        raise SystemExit('RC628 compact-card anchor not unique')
    text = text.replace(card_anchor, direct_card + card_anchor, 1)

path.write_text(text, encoding='utf-8')
print('RC990 canonical task-grid selectors promoted successfully')
