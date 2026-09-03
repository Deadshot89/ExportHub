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

focus = '\n'.join([
    '===== rc950PreserveActiveInput =====', function_block('function rc950PreserveActiveInput(root)', 9000),
    '===== rc950RestoreActiveInput =====', function_block('function rc950RestoreActiveInput(snapshot,root)', 9000),
])

scheduler = '\n'.join([
    '===== rc950ScheduleLayout =====', function_block('function rc950ScheduleLayout(reason)', 10000),
])

view = '\n'.join([
    '===== active route =====', function_block('function route(view,source)', 26000),
    '===== shipment back =====', function_block('function back()', 12000),
    '===== shipment overview =====', function_block('function overview()', 12000),
    '===== document viewer back =====', function_block('function viewerBack()', 12000),
])

for path, text in [
    ('.github/rc990_render_focus_audit.txt', focus),
    ('.github/rc990_render_scheduler_audit.txt', scheduler),
    ('.github/rc990_render_view_audit.txt', view),
]:
    Path(path).write_text(text, encoding='utf-8')
    print(path, len(text))
