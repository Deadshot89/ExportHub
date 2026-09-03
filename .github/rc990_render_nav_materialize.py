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
    '===== canonical navigation controller =====',
    '===== setViewState =====', function_block('function setViewState(view)', 9000),
    '===== initHistory =====', function_block('function initHistory()', 9000),
    '===== recordHistory =====', function_block('function recordHistory(view,source)', 12000),
    '===== handlePopState =====', function_block('function handlePopState(event)', 12000),
    '===== active route =====', function_block('function route(view,source)', 26000),
    '===== history.back contexts =====', contexts(r'(?:window\.)?history\.back\s*\(', 1700, 12),
    '===== explicit back controls =====', contexts(r'(?:backBtn|btnBack|navBack|goBack|data-action=[\"\']back|>\s*Zurück\s*<|>\s*Zurueck\s*<)', 1500, 18),
])

for path, text in [
    ('.github/rc990_render_focus_audit.txt', focus),
    ('.github/rc990_render_scheduler_audit.txt', scheduler),
    ('.github/rc990_render_view_audit.txt', view),
]:
    Path(path).write_text(text, encoding='utf-8')
    print(path, len(text))
