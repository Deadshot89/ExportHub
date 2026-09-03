from pathlib import Path

html = Path('TESTVERSION.html').read_text(encoding='utf-8')
out = []


def function_span(signature: str):
    start = html.find(signature)
    if start < 0:
        return None
    brace = html.find('{', start)
    if brace < 0:
        return None
    depth = 0
    quote = None
    escaped = False
    i = brace
    while i < len(html):
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
        if ch in ('"', "'", '`'):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None

for signature in [
    'function rc990ScheduleRender(',
    'function toggleReleaseChange(',
    'function setReleaseChangeStatus(',
    'function scheduleConfirmationSave(',
    'function save(',
    'function operationFail(',
    'function loadingBarFail(',
]:
    out.append(f'===== {signature} =====')
    span = function_span(signature)
    if not span:
        out.append('NOT FOUND')
    else:
        out.append(html[span[0]:span[1]])
    out.append('')

for term in ['ExportHUBOperationStatus', 'rc990CaptureReleasePosition', 'rc990RestoreReleasePosition', 'rc990ArmReleasePosition']:
    out.append(f'===== CONTEXT {term} =====')
    pos = html.find(term)
    if pos < 0:
        out.append('NOT FOUND')
    else:
        out.append(html[max(0,pos-1200):min(len(html),pos+2200)])
    out.append('')

Path('.github/rc990_error_audit_result.txt').write_text('\n'.join(out), encoding='utf-8')
print('RC990 error audit materialized.')
