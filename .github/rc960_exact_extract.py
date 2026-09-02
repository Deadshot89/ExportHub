from pathlib import Path
import re
text=Path('TESTVERSION.html').read_text(encoding='utf-8',errors='replace')

def fn(name):
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',text)
    if not m:return ''
    start=m.start();i=m.end()-1;depth=0;quote=None;esc=False
    while i<len(text):
        c=text[i]
        if quote:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==quote:quote=None
        else:
            if c in "'\"`":quote=c
            elif c=='{':depth+=1
            elif c=='}':
                depth-=1
                if depth==0:return text[start:i+1]
        i+=1
    return text[start:i]

names=['calcGate','syncCostFromShipment','activeShipmentRoute','shipmentLoad','changeKey','changeResultState','changeResult','changeConfirmed','changeFailed','changeItemByKey','recordPassed','recordOpen','recordFailure','applyPendingConfirmations','scheduleConfirmationSave','renderUnreleasedChangesInner','unreleasedChanges','changeChecklistProgress','refreshUnreleasedChangesCard','viewerPrint','viewerLoad']
out=[]
for n in names:
    body=fn(n);out.append(f'\n=== {n} len={len(body)} ===\n{body[:30000]}')
Path('docs/superpowers/rc960-exact-focus.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_EXACT_FOCUS_WRITTEN')
