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

view = collect([
    'currentView','data-exporthub-view','showView','setView','navigate',
    'history.pushState','history.replaceState','history.back','popstate',
    'goBack','backBtn','Zurück'
], 1900, 10)

for path,text in [
    ('.github/rc990_render_focus_audit.txt',focus),
    ('.github/rc990_render_scheduler_audit.txt',scheduler),
    ('.github/rc990_render_view_audit.txt',view),
]:
    if len(text)>70000:
        text=text[:70000]+'\n...[truncated]...\n'
    Path(path).write_text(text,encoding='utf-8')
    print(path, len(text))
