from pathlib import Path
import re
import sys

text = Path('TESTVERSION.html').read_text(encoding='utf-8')
errors = []

def require(needle, label=None):
    if needle not in text:
        errors.append(label or f'missing: {needle}')

def forbid(needle, label=None):
    if needle in text:
        errors.append(label or f'forbidden: {needle}')

# RC950 build + new active helpers (RED on RC946 baseline)
require("version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'", 'RC950 build marker missing')
require('function rc950ScheduleLayout(reason)', 'RC950 layout scheduler missing')
require('function rc950BusyBegin(label)', 'RC950 busy begin missing')
require('function rc950BusyEnd()', 'RC950 busy end missing')
require('function rc950WithBusy(label,fn)', 'RC950 busy wrapper missing')
require('function rc950PreserveActiveInput(root)', 'RC950 input snapshot missing')
require('function rc950RestoreActiveInput(snapshot,root)', 'RC950 input restore missing')
require('aria-busy', 'Busy accessibility state missing')

# Existing proven behavior must survive the large update.
require('exporthub-rc945-compact-stable-colli-layout', 'RC945 active Colli layout marker missing')
require('overflow-anchor:none!important', 'Colli scroll anchoring protection missing')
require('rc946TaskPointer', 'RC946 task pointer drag missing')
require('dx*dx+dy*dy<9', 'RC946 immediate drag threshold missing')
require("closest('button,input,select,textarea,a,label')", 'Interactive controls are not excluded from task drag')
require('moveTask(id,day.getAttribute', 'Task drag persistence path missing')
require('moveShipmentKey(key,Number(zone.getAttribute', 'Warehouse drag persistence path missing')
require('pointercancel', 'Pointer cancellation handling missing')

# Native HTML5 drag must not return for cards.
forbid('draggable="true" data-i218-drag=', 'Native task draggable returned')
forbid('draggable="true" data-warehouse-drag-key=', 'Native warehouse draggable returned')

# RC918 separation must remain intact.
require('Operative Probleme an Sendungen werden getrennt im Warncenter angezeigt.', 'RC918 notification/warning separation text missing')
require('Sendungswarnungen werden hier bewusst nicht doppelt angezeigt.', 'RC918 notification dedupe text missing')

# No duplicate RC950 helper definitions.
for fn in [
    'rc950ScheduleLayout', 'rc950BusyBegin', 'rc950BusyEnd', 'rc950WithBusy',
    'rc950PreserveActiveInput', 'rc950RestoreActiveInput'
]:
    count = len(re.findall(r'function\s+' + re.escape(fn) + r'\s*\(', text))
    if count > 1:
        errors.append(f'duplicate function {fn}: {count}')

if errors:
    print('RC950 REGRESSION: FAIL')
    for err in errors:
        print(' -', err)
    sys.exit(1)

print('RC950 REGRESSION: PASS')
