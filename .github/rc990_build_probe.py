from pathlib import Path
import re
s=Path('TESTVERSION.html').read_text(encoding='utf-8')
for pat in [r'var\s+BUILD\b',r'BUILD\s*=\s*Object\.freeze',r'version\s*:\s*["\']RC980["\']',r'RC980']:
    m=re.search(pat,s,re.I)
    print('PATTERN',pat,'FOUND',bool(m),'AT',m.start() if m else -1)
    if m:
        a=max(0,m.start()-350);b=min(len(s),m.start()+900)
        print(repr(s[a:b]))
        print('---PLAIN---')
        print(s[a:b])
        print('---END---')
