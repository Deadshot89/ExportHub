from pathlib import Path
import re,sys

root=Path('.')
html=(root/'TESTVERSION.html').read_text(encoding='utf-8',errors='replace')
pickup=(root/'pickup.html').read_text(encoding='utf-8',errors='replace')
store=(root/'api/shared/pickup-store.js').read_text(encoding='utf-8',errors='replace')
init=(root/'api/pickup-init/index.js').read_text(encoding='utf-8',errors='replace')
confirm=(root/'api/pickup-confirm-v2/index.js').read_text(encoding='utf-8',errors='replace')
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

def function(src,name):
    m=re.search(r'(?:async\s+)?function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',src)
    if not m:return ''
    i=m.end()-1;start=m.start();depth=0;quote=None;esc=False
    while i<len(src):
        c=src[i]
        if quote:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==quote:quote=None
        else:
            if c in "'\"`":quote=c
            elif c=='{':depth+=1
            elif c=='}':
                depth-=1
                if depth==0:return src[start:i+1]
        i+=1
    return src[start:i]

# RC960 marker must be the single active test build.
need("version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'" in html,'RC960 Buildmarker fehlt')

# Protected previous releases / architecture.
for marker in ['exporthub-rc945-compact-stable-colli-layout','rc946TaskPointer','rc946WarehousePointerZone','rc950ScheduleLayout','rc950PreserveActiveInput','rc950RestoreActiveInput','rc950ScheduleShipmentSearch']:
    need(marker in html,'Schutzmarker fehlt: '+marker)
need('Benachrichtigungscenter' in html and 'Warncenter' in html,'Benachrichtigungs-/Warncenter-Schutzmarker fehlen')
need('function shipmentReadOnly' in html and 'POD vorhanden' in function(html,'shipmentReadOnly'),'Schreibsperre ab Pickup/POD fehlt')

# Shipment save must re-check the authoritative lock before persistence.
save_action=function(html,'saveAction')
need('refreshShipmentLock(true)' in save_action,'Save prüft Server-Schreibsperre nicht vor Bearbeitung')
need(save_action.find('lockedShipment()') < save_action.find('persistenceSave()') if 'persistenceSave()' in save_action else False,'Save prüft Schreibsperre nicht unmittelbar vor Persistenz')

# Gate41: service remains removed; route/country remains structured.
cost_state=function(html,'costState')
calc_gate=function(html,'calcGate')
country_fn=function(html,'shipmentRecipientCountry')
need('delete g.service' in cost_state and 'delete g.serviceName' in cost_state and 'delete g.gate41Service' in cost_state,'Gate41-Service wird nicht konsequent entfernt')
need('service' not in calc_gate.lower(),'Gate41-Berechnung enthält wieder Service-Logik')
need('locationData' in country_fn and 'destinationCountry' in country_fn and 'recipientCountry' in country_fn,'Strukturierte Zielland-Ermittlung fehlt')

# Pickup: trusted total -> row sum -> ambiguous legacy fallback.
pickup_expected=function(pickup,'pickupExpectedCollis')
need("'colliCount'" not in re.search(r"explicitNames=\[[^\]]*\]",pickup_expected).group(0) if re.search(r"explicitNames=\[[^\]]*\]",pickup_expected) else False,'Pickup-Client behandelt colliCount weiterhin als vertrauenswürdige Gesamtsumme')
need(pickup_expected.find('if(best>0)return best')>=0 and pickup_expected.find("['pickupColliCount','enteredColliCount','colliCount']")>pickup_expected.find('if(best>0)return best'),'Pickup-Client summiert Colli-Zeilen nicht vor Legacy-Fallback')
need('function expectedCollis' in store,'Zentrale serverseitige Colli-Gesamtermittlung fehlt')
store_expected=function(store,'expectedCollis')
need('rows' in store_expected and 'colliCount' in store_expected,'Server-Colli-Gesamtermittlung enthält nicht Zeilensumme + Legacy-Fallback')
need('store.expectedCollis(b)' in init,'pickup-init verwendet nicht die zentrale physische Colli-Gesamtermittlung')
need('store.expectedCollis(r)' in confirm,'pickup-confirm-v2 verwendet nicht die zentrale physische Colli-Gesamtermittlung')
need('sh.actualPickupDate=day' in store and "t.status='erledigt'" in store,'Abholdatum/Abholtag-Aufgabe wurden regressiert')
need("sh.status='POD vorhanden'" in store and "sh.processStatus='POD vorhanden'" in store,'POD-Statuspfad wurde regressiert')

# Release Center: both explicit PASS result and persisted confirmation state must count as confirmed.
change_confirmed=function(html,'changeConfirmed')
need('changeChecklistState' in change_confirmed and "status)==='passed'" in change_confirmed.replace(' ',''),'Release-Center zählt gespeicherte Bestätigungen nicht zuverlässig als bestätigt')
need('preserveReleaseScroll' in function(html,'toggleReleaseChange'),'Release-Center Scrollschutz fehlt')
need('preserveReleaseScroll' in function(html,'setReleaseChangeStatus'),'Release-Center Status-Scrollschutz fehlt')

# Document print must visibly enter the existing operation/busy system rather than silently fail.
viewer_print=function(html,'viewerPrint')
need(('ExportHUBRC950Busy' in viewer_print or 'ExportHUBOperationStatus' in viewer_print) and ('Druck' in viewer_print),'Dokumentdruck nutzt keinen sichtbaren Arbeitsstatus')

# Exam/admin safeguards stay intact.
ihk_admin=function(html,'ihkAdmin')
need('functionAdmin' in ihk_admin and "level==='admin'" in ihk_admin,'Prüfcenter-Funktionsadminschutz fehlt')
need('50 Fragen' in html and ('100 Punkte' in html or 'maximal 100' in html),'Prüfcenter 50/100-Regel fehlt')

if errors:
    print('RC960 REGRESSION FAIL')
    for e in errors:print(' -',e)
    sys.exit(1)
print('RC960 REGRESSION PASS')
