from pathlib import Path
import re

p=Path('TESTVERSION.html')
s=p.read_text(encoding='utf-8')

tokens=[
    'Azure-Teamdaten werden geladen',
    'ExportHUB wird vorbereitet',
    'Teamdaten werden geladen',
    'exporthub-state',
    'bootstrap-status',
    'startup',
    'Startup',
    'boot',
    'Boot',
]

print('TESTVERSION length', len(s))
for token in tokens:
    hits=[m.start() for m in re.finditer(re.escape(token), s)]
    print(f'\n=== TOKEN {token!r}: {len(hits)} hits ===')
    for n,pos in enumerate(hits[:12],1):
        lo=max(0,pos-4500); hi=min(len(s),pos+6500)
        ctx=s[lo:hi]
        funcs=list(re.finditer(r'(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(', s[max(0,pos-16000):pos]))
        fname=funcs[-1].group(0) if funcs else '<none>'
        print(f'--- hit {n} pos={pos} nearest={fname} ---')
        print(ctx)
        print('--- end hit ---')
