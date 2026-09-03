from pathlib import Path
import re

p=Path('TESTVERSION.html')
s=p.read_text(encoding='utf-8')
lines=s.splitlines()
terms=[
    r'release.?center', r'releasecenter', r'unpublished', r'nicht veröffentlicht',
    r'confirm', r'bestätig', r'approve', r'freig', r'openchanges', r'pendingchanges',
    r'scrollinto', r'scrollto', r'published'
]
rx=re.compile('|'.join(terms),re.I)
hits=[]
for i,line in enumerate(lines,1):
    if rx.search(line):
        hits.append(i)
print(f'FILE_LINES={len(lines)} HITS={len(hits)}')
# Cluster nearby hits and print bounded context.
clusters=[]
for n in hits:
    if not clusters or n-clusters[-1][-1]>18:
        clusters.append([n])
    else:
        clusters[-1].append(n)
# Prefer clusters containing release-specific tokens.
scored=[]
for c in clusters:
    a=max(1,c[0]-12); b=min(len(lines),c[-1]+16)
    text='\n'.join(lines[a-1:b])
    score=sum(4 for t in ['release','unpublished','nicht veröffentlicht','bestät','freig'] if t in text.lower())
    score+=sum(1 for t in ['scroll','confirm','approve','pending','publish'] if t in text.lower())
    scored.append((score,a,b,text))
for idx,(score,a,b,text) in enumerate(sorted(scored,reverse=True)[:18],1):
    print(f'\n===== CLUSTER {idx} SCORE={score} LINES={a}-{b} =====')
    for no,line in enumerate(lines[a-1:b],a):
        print(f'{no:06d}: {line[:1200]}')

# Function names around release terms.
funcs=[]
for m in re.finditer(r'function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{',s):
    start=m.start(); frag=s[start:start+9000]
    if re.search(r'release|publish|bestät|freig|unpublished|pending.?change',frag,re.I):
        funcs.append(m.group(1))
print('\nRELEVANT_FUNCTIONS=' + ','.join(dict.fromkeys(funcs) )[:8000])
