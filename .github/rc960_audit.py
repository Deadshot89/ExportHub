from pathlib import Path
import re

p = Path('TESTVERSION.html')
text = p.read_text(encoding='utf-8', errors='replace')
lines = text.splitlines()

GROUPS = {
    'build_loading': ['RC950','rc950ScheduleLayout','rc950WithBusy','operationStart','loadingBarStart'],
    'save_state': ['saveShipment','saveState','autosave','persist','editLockActive','Abgeholt','POD vorhanden'],
    'navigation_search': ['showView','shipmentsearch','renderSearchResults','documentviewer','currentView'],
    'documents_print': ['viewerDownload','Ladeliste','CMR','print','PDF','downloadDocObject'],
    'shipping': ['Gate41','UPS','Versandkosten','shipping','Maut','Service'],
    'pickup_pod': ['pickup','Abholtag','actualPickup','plannedPickup','tatsäch','colli','POD'],
    'release_admin': ['Release Center','openChanges','unpublished','nicht veröffentlicht','confirm','scrollIntoView','scrollTo','session','permission','Funktionsadmin','Prüfung','Datenschutz','backup','Audit'],
    'protected': ['exporthub-rc945-compact-stable-colli-layout','rc946TaskPointer','rc946WarehousePointerZone','Benachrichtigungscenter','Warncenter']
}

print(f'RC960_AUDIT bytes={len(text)} lines={len(lines)}')
for group, terms in GROUPS.items():
    print(f'\n=== {group} ===')
    for term in terms:
        hits = [i for i, line in enumerate(lines) if term.lower() in line.lower()]
        print(f'{term}: {len(hits)} hit(s)')
        for i in hits[:4]:
            lo=max(0,i-2); hi=min(len(lines),i+3)
            snippet='\n'.join(f'{n+1}: {lines[n][:600]}' for n in range(lo,hi))
            print(snippet)
            print('---')

# Function declarations and event listeners likely relevant to RC960.
print('\n=== relevant function declarations ===')
for i,line in enumerate(lines):
    if re.search(r'function\s+[A-Za-z0-9_$]*(save|ship|pickup|pod|release|view|search|print|download|session|permission|country|cost)', line, re.I):
        print(f'{i+1}: {line[:900]}')

print('\n=== potentially synchronous hot event handlers ===')
for i,line in enumerate(lines):
    if 'addEventListener' in line and re.search(r'input|change|click|pointer|search', line, re.I):
        if any(k.lower() in line.lower() for k in ['shipment','colli','release','pickup','document','view','search']):
            print(f'{i+1}: {line[:900]}')

print('\nRC960_AUDIT_DONE')
