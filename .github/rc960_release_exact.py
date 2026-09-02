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
names=['changeResultState','changeChecklistState','changeResult','changeConfirmed','changeFailed','applyPendingConfirmations','toggleReleaseChange','recordPassed','recordOpen','recordFailure','renderUnreleasedChangesInner','unreleasedChanges','changeChecklistProgress','allChecklistDone']
out=[]
for n in names:out.append(f'=== {n} ===\n{fn(n)}\n')
Path('docs/superpowers/rc960-release-exact.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_RELEASE_EXACT_WRITTEN')
