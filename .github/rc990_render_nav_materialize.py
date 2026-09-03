from pathlib import Path
import re

html = Path('TESTVERSION.html').read_text(encoding='utf-8')
out = []

TERMS = [
    'rc950PreserveActiveInput',
    'rc950RestoreActiveInput',
    'requestAnimationFrame',
    'document.activeElement',
    'selectionStart',
    'setSelectionRange',
    'history.pushState',
    'history.replaceState',
    'popstate',
    'history.back',
    'currentView',
    'data-exporthub-view',
    'renderAll',
    'renderDashboard',
    'BroadcastChannel',
]

out.append(f'chars={len(html)}\n')

for term in TERMS:
    matches = list(re.finditer(re.escape(term), html, re.I))
    out.append(f'\n===== {term} :: {len(matches)} =====\n')
    for i, m in enumerate(matches[:10], 1):
        lo = max(0, m.start() - 650)
        hi = min(len(html), m.end() + 950)
        snippet = html[lo:hi].replace('\r', '')
        out.append(f'--- hit {i} @{m.start()} ---\n{snippet}\n')

out.append('\n===== function candidates =====\n')
patterns = [
    r'function\s+([A-Za-z_$][\w$]*)\s*\(',
    r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)',
]
seen = set()
keywords = ('render','view','nav','focus','scroll','frame','batch','route','history','activeinput','restore','preserve')
for pat in patterns:
    for m in re.finditer(pat, html):
        name = m.group(1)
        if name in seen or not any(k in name.lower() for k in keywords):
            continue
        seen.add(name)
        out.append(f'{m.start():>9} {name}\n')

# Keep the diagnostic easy to fetch through the connector.
text = ''.join(out)
if len(text) > 90000:
    text = text[:90000] + '\n...[truncated by rc990 materializer]...\n'
Path('.github/rc990_render_nav_audit_result.txt').write_text(text, encoding='utf-8')
print(f'wrote {len(text)} chars')
