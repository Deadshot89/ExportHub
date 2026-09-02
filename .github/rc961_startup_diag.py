from pathlib import Path
import re

s=Path('TESTVERSION.html').read_text(encoding='utf-8')
out=[f'TESTVERSION length: {len(s)}']

def block(pos,before=4500,after=8500):
    return s[max(0,pos-before):min(len(s),pos+after)]

def emit_hits(label,pattern,regex=False,limit=12):
    if regex:
        hits=[m.start() for m in re.finditer(pattern,s)]
    else:
        hits=[m.start() for m in re.finditer(re.escape(pattern),s)]
    out.append(f'\n=== {label} hits={len(hits)} ===')
    for i,pos in enumerate(hits[:limit],1):
        out.append(f'\n--- hit {i} pos={pos} ---')
        out.append(block(pos))

emit_hits('stateCall declaration',r'(?:async\s+function\s+stateCall\s*\(|(?:const|let|var)\s+stateCall\s*=)',True,8)
emit_hits('stateCall calls','stateCall(',False,20)
emit_hits('await loadState calls','await loadState(',False,20)
emit_hits('loadState calls','loadState(',False,30)
emit_hits('startup login session','restore',False,5)
emit_hits('TEAMDATA timeout codes','TEAMDATA_',False,20)
emit_hits('request timeout','REQUEST_TIMEOUT',False,20)
emit_hits('timeout option','timeout:',False,20)

Path('docs/rc961-startup-diagnosis.txt').write_text('\n'.join(out),encoding='utf-8')
print('Wrote docs/rc961-startup-diagnosis.txt')
