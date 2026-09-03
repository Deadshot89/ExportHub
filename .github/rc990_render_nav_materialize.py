from pathlib import Path
import re

html = Path('TESTVERSION.html').read_text(encoding='utf-8')


def function_block(signature: str, limit: int = 22000) -> str:
    start = html.find(signature)
    if start < 0:
        return f'NOT FOUND: {signature}\n'
    brace = html.find('{', start)
    if brace < 0:
        return f'NO BRACE: {signature}\n'
    depth = 0
    quote = None
    escaped = False
    i = brace
    while i < len(html) and i - start < limit:
        ch = html[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('\"', "'", '`'):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return html[start:i + 1].replace('\r', '') + '\n'
        i += 1
    return html[start:min(len(html), start + limit)].replace('\r', '') + '\n...[block truncated]...\n'


def contexts(pattern: str, radius: int = 1200, max_hits: int = 12) -> str:
    out = []
    matches = list(re.finditer(pattern, html, re.I | re.S))
    out.append(f'PATTERN {pattern} :: {len(matches)} hit(s)\n')
    for n, m in enumerate(matches[:max_hits], 1):
        lo = max(0, m.start() - radius)
        hi = min(len(html), m.end() + radius)
        out.append(f'--- hit {n} @{m.start()} ---\n{html[lo:hi].replace(chr(13), "")}\n')
    return ''.join(out)

focus = '\n'.join([
    '===== rc950PreserveActiveInput =====', function_block('function rc950PreserveActiveInput(root)', 9000),
    '===== rc950RestoreActiveInput =====', function_block('function rc950RestoreActiveInput(snapshot,root)', 9000),
])

scheduler = '\n'.join([
    '===== rc950ScheduleLayout =====', function_block('function rc950ScheduleLayout(reason)', 10000),
    '===== RAF contexts =====', contexts(r'(?:requestAnimationFrame|cancelAnimationFrame)', 900, 10),
])

view = '\n'.join([
    '===== active route =====', function_block('function route(view,source)', 26000),
    '===== click listeners near navigation =====', contexts(r'addEventListener\s*\(\s*[\"\']click[\"\']', 2200, 24),
    '===== delegated view controls =====', contexts(r'(?:data-view|data-nav|data-route|dataset\.view|dataset\.nav|closest\([^\n]{0,120}(?:data-view|data-nav|data-route))', 1900, 24),
    '===== shipment back control contexts =====', contexts(r'data-rc776-back', 2400, 12),
    '===== likely application back controls =====', contexts(r'(?:data-[\w-]*back|id=[\"\'][^\"\']*back[^\"\']*[\"\']|class=[\"\'][^\"\']*back[^\"\']*[\"\'])', 1700, 24),
])

for path, text in [
    ('.github/rc990_render_focus_audit.txt', focus),
    ('.github/rc990_render_scheduler_audit.txt', scheduler),
    ('.github/rc990_render_view_audit.txt', view),
]:
    Path(path).write_text(text, encoding='utf-8')
    print(path, len(text))
