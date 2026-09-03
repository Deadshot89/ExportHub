from pathlib import Path
import re
s=Path('TESTVERSION.html').read_text(encoding='utf-8')
NAMES=['changeResultState','changeResult','changeConfirmed','changeChecklistProgress','unreleasedGroups','changeItemByKey','recordPassed','recordOpen','recordFailure','changeChecklistState']

def body(name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',s)
    if not m:return 'NOT FOUND'
    i=m.end()-1; d=0; q=''; esc=False
    for j in range(i,len(s)):
        c=s[j]
        if q:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==q:q=''
            continue
        if c in "'\"`":q=c;continue
        if c=='{':d+=1
        elif c=='}':
            d-=1
            if d==0:return s[m.start():j+1]
    return s[m.start():m.start()+12000]
for n in NAMES:
    print('\n===== '+n+' =====')
    b=body(n)
    for i in range(0,len(b),850): print(b[i:i+850])
