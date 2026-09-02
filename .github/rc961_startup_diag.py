from pathlib import Path
import re

s=Path('TESTVERSION.html').read_text(encoding='utf-8')
out=[f'TESTVERSION length: {len(s)}']

def nearest_function(pos):
    start=max(0,pos-24000)
    block=s[start:pos]
    matches=list(re.finditer(r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', block))
    return matches[-1].group(1) if matches else '<none>'

def emit(token, before=2200, after=4200, limit=5):
    hits=[m.start() for m in re.finditer(re.escape(token),s)]
    out.append(f'\n=== {token!r} hits={len(hits)} ===')
    for idx,pos in enumerate(hits[:limit],1):
        lo=max(0,pos-before); hi=min(len(s),pos+after)
        out.append(f'\n--- hit {idx} pos={pos} nearest_function={nearest_function(pos)} ---')
        out.append(s[lo:hi])

for token in [
    'Azure-Teamdaten werden geladen',
    'ExportHUB wird vorbereitet',
    'Teamdaten werden geladen',
    'exporthub-state',
    'Promise.race',
    'AbortController',
]:
    emit(token)

out.append('\n=== RELEVANT FUNCTION INVENTORY ===')
for m in re.finditer(r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(',s):
    name=m.group(1)
    low=name.lower()
    if any(k in low for k in ['boot','start','team','azure','state','sync','load','init','hydrate']):
        out.append(f'{m.start()}: {name}')

Path('docs/rc961-startup-diagnosis.txt').write_text('\n'.join(out),encoding='utf-8')
print('Wrote docs/rc961-startup-diagnosis.txt')
