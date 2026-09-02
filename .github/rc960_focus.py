from pathlib import Path
import re

text=Path('TESTVERSION.html').read_text(encoding='utf-8',errors='replace')
lines=text.splitlines()

GROUPS={
 'core':['saveAction','reconcileLatestSavedBeforeSave','restorePersistedCustomerForSave','setViewState','openDocuments','viewerLoad','viewerDownload','viewerPrint','renderSearchResults','rc950ScheduleShipmentSearch'],
 'shipping':['Gate41','UPS','Versandkosten','shipping','freight','Maut','country','destinationCountry','recipientCountry'],
 'pickup':['pickup','Abholtag','actualPickup','plannedPickup','POD','pod','colliTotal','totalColli','Abgeholt'],
 'admin':['release','Release','openChanges','unpublished','confirm','session','permission','Funktionsadmin','exam','Prüfung','Datenschutz','backup','Backup','audit','Audit']
}

func_re=re.compile(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(')
arrow_re=re.compile(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^;\n]*?=>')

out=[]
out.append(f'RC960_FOCUS bytes={len(text)} lines={len(lines)}')
for group,terms in GROUPS.items():
    out.append(f'\n=== {group} ===')
    seen=set()
    # First: named function / declaration lines matching any group term.
    for i,line in enumerate(lines):
        low=line.lower()
        if not any(t.lower() in low for t in terms):
            continue
        m=func_re.search(line) or arrow_re.search(line)
        if m:
            key=(i,m.group(1))
            if key in seen: continue
            seen.add(key)
            out.append(f'\nLINE {i+1} FUNCTION {m.group(1)} len={len(line)}')
            out.append(line[:12000])
    # Second: strongest literal occurrences not already represented.
    out.append(f'\n--- {group} literal hotspots ---')
    ranked=[]
    for i,line in enumerate(lines):
        score=sum(1 for t in terms if t.lower() in line.lower())
        if score:
            ranked.append((score,len(line),i,line))
    ranked.sort(key=lambda x:(-x[0],-x[1],x[2]))
    for score,ll,i,line in ranked[:30]:
        out.append(f'LINE {i+1} score={score} len={ll}: {line[:5000]}')

# Existing protected markers and build marker exact lines.
out.append('\n=== protected ===')
for token in ['version:\'RC950\'','exporthub-rc945-compact-stable-colli-layout','rc946TaskPointer','rc946WarehousePointerZone','rc950ScheduleLayout','rc950PreserveActiveInput','rc950RestoreActiveInput','Benachrichtigungscenter','Warncenter']:
    hits=[i for i,l in enumerate(lines) if token.lower() in l.lower()]
    out.append(f'{token}: {hits[:20]}')

Path('docs/superpowers/rc960-focus.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_FOCUS_WRITTEN',len(out))
