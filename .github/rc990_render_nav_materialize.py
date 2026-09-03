from pathlib import Path
import re

html = Path('TESTVERSION.html').read_text(encoding='utf-8')


def collect(terms, radius=1300, max_hits=8):
    out=[f'chars={len(html)}\n']
    for term in terms:
        matches=list(re.finditer(re.escape(term), html, re.I))
        out.append(f'\n===== {term} :: {len(matches)} =====\n')
        for i,m in enumerate(matches[:max_hits],1):
            lo=max(0,m.start()-radius); hi=min(len(html),m.end()+radius)
            out.append(f'--- hit {i} @{m.start()} ---\n{html[lo:hi].replace(chr(13), "")}\n')
    return ''.join(out)

focus = collect([
    'rc950PreserveActiveInput','rc950RestoreActiveInput','document.activeElement',
    'selectionStart','selectionEnd','setSelectionRange','scrollTop','window.scrollTo'
], 1800, 5)

scheduler = collect([
    'rc950LayoutFrame','rc950ScheduleLayout','schedulePatch','deferFullPatch',
    'requestAnimationFrame','cancelAnimationFrame','renderAll','renderDashboard'
], 1800, 6)

# Target the actual main-view functions/assignments instead of early diagnostics helpers.
view_out=[f'chars={len(html)}\n']
patterns=[
    ('view functions', r'function\s+([A-Za-z_$][\w$]*(?:View|view|Navigate|navigate|Back|back|Route|route)[\w$]*)\s*\('),
    ('view assignments', r'(?:\bstate|\bs|\bruntime|\bst)\.view\s*=|\bview\s*:\s*[A-Za-z_$]|data-exporthub-view'),
    ('history api', r'history\.(?:pushState|replaceState|back)|addEventListener\s*\(\s*[\'\"]popstate'),
    ('back handlers', r'(?:backBtn|btnBack|navBack|goBack|Zurück|zurück|back-button|data-action=[\'\"]back)'),
]
for label,pat in patterns:
    matches=list(re.finditer(pat,html,re.I))
    view_out.append(f'\n===== {label} :: {len(matches)} =====\n')
    for i,m in enumerate(matches[:35],1):
        lo=max(0,m.start()-1300); hi=min(len(html),m.end()+2300)
        name=m.group(1) if m.lastindex else ''
        view_out.append(f'--- hit {i} @{m.start()} {name} ---\n{html[lo:hi].replace(chr(13), "")}\n')
view=''.join(view_out)

for path,text in [
    ('.github/rc990_render_focus_audit.txt',focus),
    ('.github/rc990_render_scheduler_audit.txt',scheduler),
    ('.github/rc990_render_view_audit.txt',view),
]:
    if len(text)>110000:
        text=text[:110000]+'\n...[truncated]...\n'
    Path(path).write_text(text,encoding='utf-8')
    print(path, len(text))
