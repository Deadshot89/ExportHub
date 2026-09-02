from pathlib import Path
import re

src = Path('TESTVERSION.html')
text = src.read_text(encoding='utf-8')
out = []


def line_of(pos):
    return text.count('\n', 0, pos) + 1


def contexts(label, needle, limit=8, radius=1800):
    positions = []
    start = 0
    while True:
        pos = text.find(needle, start)
        if pos < 0:
            break
        positions.append(pos)
        start = pos + max(1, len(needle))
    out.append(f'\n## {label}\nneedle={needle!r}\ncount={len(positions)}')
    for pos in positions[-limit:]:
        lo = max(0, pos - radius)
        hi = min(len(text), pos + radius)
        snippet = text[lo:hi]
        out.append(f'\n### line~{line_of(pos)} pos={pos}\n```text\n{snippet}\n```')


def extract_named_function(name, occurrence=-1):
    token = f'function {name}('
    positions=[]
    start=0
    while True:
        pos=text.find(token,start)
        if pos<0:
            break
        positions.append(pos)
        start=pos+len(token)
    if not positions:
        return None
    pos=positions[occurrence]
    brace=text.find('{',pos)
    if brace<0:
        return None
    depth=0
    quote=None
    esc=False
    i=brace
    while i < len(text):
        ch=text[i]
        if quote:
            if esc:
                esc=False
            elif ch=='\\':
                esc=True
            elif ch==quote:
                quote=None
        else:
            if ch in ('\"', "'", '`'):
                quote=ch
            elif ch=='{':
                depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:
                    return pos, text[pos:i+1]
        i+=1
    return pos, text[pos:min(len(text),pos+12000)]


build = re.search(r"version:'RC\d+',cache:'\d+',loginReturn:'/TESTVERSION\.html\?v=\d+'", text)
out.append('# RC950 Active Path Audit')
out.append(f'file_bytes={len(text.encode("utf-8"))}')
out.append(f'file_lines={text.count(chr(10)) + 1}')
out.append(f'build={build.group(0) if build else "NOT FOUND"}')

needles = [
    ('renderView', 'function renderView'),
    ('generic render()', 'function render('),
    ('ResizeObserver', 'ResizeObserver'),
    ('resize listeners', "addEventListener('resize'"),
    ('requestAnimationFrame', 'requestAnimationFrame'),
    ('persist()', 'function persist('),
    ('save functions', 'function save'),
    ('await persist', 'await persist'),
    ('window.print', 'window.print('),
    ('print marker', 'print('),
    ('PDF marker', 'PDF'),
    ('navigate functions', 'function navigate'),
    ('viewchange', 'viewchange'),
    ('currentView', 'currentView'),
    ('setView', 'setView'),
    ('search lowercase', 'search'),
    ('Suche', 'Suche'),
    ('data-search', 'data-search'),
    ('RC945 Colli marker', 'exporthub-rc945-compact-stable-colli-layout'),
    ('Colli card', 'rc573ColliCard'),
    ('RC946 task pointer', 'rc946TaskPointer'),
    ('warehouse bind', 'bindWarehouseDnD'),
    ('warehouse move', 'moveShipmentKey('),
    ('busy/loader', 'busy'),
    ('loading', 'loading'),
]

for label, needle in needles:
    contexts(label, needle)

hot_functions = [
    'loadingBarStart','loadingBarDone','operationStart','operationDone','operationFail',
    'scheduleEditSave','flushEditSave','queueShipmentEdit','safePatchDuringEdit','deferFullPatch',
    'schedulePatch','patch','renderSearchResults','renderSearch','rc843EnsureView','rc843ScheduleViewGuard',
    'dashboardMasonrySchedule','dashboardMasonryBind','renderDashboard','saveAction','printAll','openDocuments',
    'viewerDownload','viewerPrint'
]
out.append('\n## Exact hot function bodies')
for name in hot_functions:
    found=extract_named_function(name)
    if not found:
        out.append(f'\n### {name}\nNOT FOUND')
        continue
    pos,body=found
    out.append(f'\n### {name} line~{line_of(pos)} pos={pos}\n```javascript\n{body}\n```')

# Function inventory for likely active areas.
func_re = re.compile(r'function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)')
interesting = []
for m in func_re.finditer(text):
    name = m.group(1)
    if re.search(r'(render|layout|masonry|resize|save|persist|print|pdf|view|nav|search|shipment|colli|busy|load|sync)', name, re.I):
        interesting.append((line_of(m.start()), name))
out.append('\n## Interesting function inventory')
for line, name in interesting[-350:]:
    out.append(f'{line}: {name}')

# Event listener inventory for hot events.
listener_patterns = [
    r"addEventListener\(['\"]resize['\"]",
    r"addEventListener\(['\"]scroll['\"]",
    r"addEventListener\(['\"]input['\"]",
    r"addEventListener\(['\"]change['\"]",
    r"addEventListener\(['\"]exporthub:viewchange['\"]",
    r"addEventListener\(['\"]exporthub:sync['\"]",
]
out.append('\n## Event listener counts')
for pat in listener_patterns:
    matches = list(re.finditer(pat, text))
    out.append(f'{pat}: {len(matches)} lines={[line_of(m.start()) for m in matches[-30:]]}')

Path('docs/superpowers/rc950-audit.txt').write_text('\n'.join(out), encoding='utf-8')
print('RC950 audit written:', len(out), 'sections/lines')
