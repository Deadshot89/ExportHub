from pathlib import Path
import re

lines=Path('TESTVERSION.html').read_text(encoding='utf-8',errors='replace').splitlines()
GROUPS={
 'core':['saveAction','newestSavedForSave','reconcileLatestSavedBeforeSave','restorePersistedCustomerForSave','viewerLoad','viewerPrint','viewerDownload','renderSearchResults','rc950ScheduleShipmentSearch','shipmentViewReturnView'],
 'shipping':['Gate41','gate41','Versandkosten','shippingCost','freightCost','destinationCountry','recipientCountry','countryCode','Maut'],
 'pickup':['pickupConfirm','confirmPickup','totalColli','colliTotal','actualPickup','plannedPickup','pickupDate','Abholtag','POD','podFiles','Abgeholt'],
 'release':['releaseCenter','Release-Center','pendingChanges','openChanges','unpublished','nicht veröffentlicht','confirmedChanges','scrollIntoView','scrollTo'],
 'admin':['Funktionsadmin','functionAdmin','exam','Prüfung','100 Punkte','50 Fragen','session','terminateSession','permission','Datenschutz','backup','Audit']
}
func_re=re.compile(r'function\s+([A-Za-z_$][\w$]*)\s*\(')
out=[f'RC960_RUNTIME_FOCUS lines={len(lines)}']
for group,terms in GROUPS.items():
    out.append(f'\n=== {group} ===')
    hits=[]
    for i,line in enumerate(lines):
        if len(line)>50000: continue
        matched=[t for t in terms if t.lower() in line.lower()]
        if not matched: continue
        m=func_re.search(line)
        score=len(matched)+(3 if m else 0)+(2 if i>=18000 else 0)
        hits.append((score,i,line,matched,m.group(1) if m else ''))
    hits.sort(key=lambda x:(-x[0],-x[1]))
    out.append('hit_count='+str(len(hits)))
    for score,i,line,matched,fn in hits[:80]:
        out.append(f'LINE {i+1} score={score} fn={fn or "-"} terms={",".join(matched)} len={len(line)}')
        out.append(line[:8000])
Path('docs/superpowers/rc960-runtime-focus.txt').write_text('\n'.join(out),encoding='utf-8')
print('RC960_RUNTIME_FOCUS_WRITTEN')
