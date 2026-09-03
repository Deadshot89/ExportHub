from pathlib import Path
import re

s=Path('TESTVERSION.html').read_text(encoding='utf-8')

NAMES=[
 'releaseItemsForCurrentVersion','unreleasedChanges','changeKey','rerender','save',
 'markTested','resetTest','toggleReleaseChange','setReleaseChangeStatus',
 'scheduleConfirmationSave','refresh','renderUnreleasedChangesInner'
]

def function_body(name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',s)
    if not m:
        return None
    start=m.start(); i=m.end()-1; depth=0; quote=None; esc=False; template_depth=0
    while i<len(s):
        ch=s[i]
        if quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=None
        else:
            if ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    return s[start:i+1]
        i+=1
    return s[start:start+20000]

for name in NAMES:
    print('\n===== FUNCTION '+name+' =====')
    body=function_body(name)
    if body is None:
        print('NOT FOUND')
        continue
    for i in range(0,len(body),900):
        print(body[i:i+900])

print('\n===== RELEASE SCRIPT PREAMBLE =====')
marker='window.__EXPORTHUB_RELEASE_CENTER_562__'
pos=s.find(marker)
if pos<0: pos=s.lower().find('release-center')
print(s[max(0,pos-2500):pos+4500])

print('\n===== RERENDER/SAVE CALLS NEAR RELEASE =====')
for needle in ['scheduleConfirmationSave(','save(\'Release-Center','rerender()','setTimeout(rerender','preserveReleaseScroll(']:
    print('\n-- '+needle+' --')
    p=0; n=0
    while True:
        p=s.find(needle,p)
        if p<0: break
        if 1200000 < p < 1800000 or 'Release-Center' in s[max(0,p-1200):p+1200]:
            n+=1; print(s[max(0,p-500):p+1200])
        p+=len(needle)
        if n>=12: break
