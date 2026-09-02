from pathlib import Path

html=Path('TESTVERSION.html').read_text()
pickup=Path('pickup.html').read_text()
store=Path('api/shared/pickup-store.js').read_text()
init=Path('api/pickup-init/index.js').read_text()
confirm=Path('api/pickup-confirm-v2/index.js').read_text()
errors=[]

def need(desc, condition):
    if not condition:
        errors.append(desc)

def between(text, start_token, end_token):
    start=text.find(start_token)
    if start < 0:
        return ''
    end=text.find(end_token,start+len(start_token))
    if end < 0:
        return text[start:]
    return text[start:end]

need('RC960 build marker', "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'" in html)
need('RC945 Colli layout preserved', 'exporthub-rc945-compact-stable-colli-layout' in html)
need('RC946 pointer drag preserved', 'rc946TaskPointer' in html)
need('RC950 frame scheduler preserved', 'rc950ScheduleLayout' in html and 'rc950PreserveActiveInput' in html and 'rc950RestoreActiveInput' in html)
need('RC950 search scheduler preserved', 'rc950ScheduleShipmentSearch' in html)
need('notification center preserved', 'Benachrichtigungscenter' in html and 'Warncenter' in html)

readonly=between(html,'function shipmentReadOnly(sh)','function lockedShipment()')
locked=between(html,'function lockedShipment()','function lockEvidencePatch')
need('shipment lock protects Abgeholt/POD', bool(
    readonly and locked and
    'abgeholt|pod vorhanden' in readonly and
    'sh.pickupQrUsed===true' in readonly and
    'sh.podAvailable===true' in readonly and
    'sh.signatureAvailable===true' in readonly and
    'arr(sh.podFiles).some' in readonly and
    'shipmentReadOnly(latest)' in locked and
    'shipmentReadOnly(saved)' in locked and
    'shipmentReadOnly(local)' in locked
))

save=between(html,'async function saveAction()','function selectSaved()')
persist_at=save.find('persistenceSave()')
refresh_positions=[]
pos=0
while True:
    pos=save.find('refreshShipmentLock(true)',pos)
    if pos < 0:
        break
    refresh_positions.append(pos)
    pos += 1
need('save rechecks authoritative lock before persist', bool(
    save and persist_at > 0 and
    len(refresh_positions) >= 2 and
    refresh_positions[-1] < persist_at and
    save.find('locked=lockedShipment()') >= 0 and
    save.find('locked=lockedShipment()') < persist_at and
    'Sendungssperre wird vor dem Speichern erneut geprüft' in save
))

cost=between(html,'function costState()','function syncCostFromShipment()')
sync=between(html,'function syncCostFromShipment()','function upsFuelDefault')
calc_start=html.find('function calcGate()')
calc_end=html.find('\nfunction ',calc_start+1) if calc_start >= 0 else -1
calc=html[calc_start:calc_end if calc_end > calc_start else calc_start+12000] if calc_start >= 0 else ''
need('Gate41 service removed', bool(
    cost and calc and
    'delete g.service;' in cost and
    'delete g.serviceName;' in cost and
    'delete g.gate41Service;' in cost and
    'g.service' not in calc and
    'gate41Service' not in calc
))
route=between(html,'function activeLocation(sh,c)','function shipmentRows()')
need('structured recipient country kept', bool(
    route and
    all(x in route for x in ['locationData','siteData','deliveryLocation','recipient=']) and
    "firstValue(recipient,['country'" in route and
    "firstValue(loc,['country'" in route
))
need('cost sync keeps route/load logic', bool(
    sync and
    'activeShipmentRoute()' in sync and
    'shipmentLoad()' in sync and
    "setRouteData(g,'country')" in sync and
    "setRouteData(u,'destinationCountry')" in sync
))

# Pickup Colli contract: physical rows > trusted aggregate > ambiguous legacy fallback.
need('pickup server uses shared expectedCollis', 'expectedCollis' in store and 'store.expectedCollis(b)' in init and 'store.expectedCollis(r)' in confirm)
need('pickup client keeps aggregate and legacy fallbacks', "['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount']" in pickup and "['pickupColliCount','enteredColliCount','colliCount']" in pickup)
need('old init single-row pattern removed', 'expectedColliCount||b.totalColli||b.colliCount' not in init)
need('pickup actual date kept', 'sh.actualPickupDate=day' in store and "sh.pickupStatus='abgeholt'" in store)
need('Abholtag task completion kept', "String(t.area||'').toLowerCase()==='abholtag'" in store and "t.status='erledigt'" in store and 't.done=true' in store and 't.completedAt=record.confirmedAt||now()' in store)
need('POD status kept', "sh.podStatus='POD vorhanden'" in store and "sh.status='POD vorhanden'" in store and "sh.processStatus='POD vorhanden'" in store)
need('expected Colli helper is exported', 'expectedCollis};' in store)
need('expected Colli helper scans nested row sources', all(x in store for x in ["stack=[src]","Object.keys(node).forEach","lists=['rows','colli','collis','packages','packageRows','items']"]))
need('expected Colli helper treats decimal row totals as physical pieces', 'function physicalColliCount' in store and 'Math.ceil(n)' in store)
need('expected Colli helper leaves aggregate totals rounded', 'function positiveColliCount' in store and 'Math.round(n)' in store)
helper=between(store,'function expectedCollis(source)','function signatureUrl')
row_loop=helper.find('while(stack.length)')
row_return=helper.find('if(best>0)return best')
trusted_loop=helper.find('for(i=0;i<trusted.length;i+=1)')
legacy_loop=helper.find("var legacy=['pickupColliCount','enteredColliCount','colliCount']")
need('expected Colli precedence rows > aggregate > legacy', bool(helper and 0<=row_loop<row_return<trusted_loop<legacy_loop))
need('ambiguous top-level colliCount is legacy only', bool(helper and "trusted=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount']" in helper and "var legacy=['pickupColliCount','enteredColliCount','colliCount']" in helper))
client=between(pickup,'function pickupExpectedCollis(data){','function resetColliCheck')
need('pickup client precedence rows > aggregate > legacy', bool(client and 0<=client.find('var lists=[]')<client.find('if(best>0)return best')<client.find('for(var e=0;e<explicitNames.length;e++)')<client.find("['pickupColliCount','enteredColliCount','colliCount']")))
need('pickup init preserves physical rows', 'const physicalRows=' in init and 'record.rows=physicalRows.map(row=>store.clone(row))' in init)
need('pickup init version RC960', "registrationVersion='RC960'" in init and 'metadataVersion=15' in init and 'pickup-init RC960' in init)
need('pickup confirm version RC960', "confirmationVersion='RC960'" in confirm and "version:'RC960'" in confirm and 'pickup-confirm-v2 RC960' in confirm)

result=between(html,'function changeResult(item)','function changeFailed(item)')
need('release result merges persisted checklist', bool(result and 'changeResultState(false)' in result and 'changeChecklistState(false)' in result and "return{status:'passed',legacy:true}" in result))
need('release confirm uses shared result', "function changeConfirmed(item){return q(changeResult(item).status)==='passed'}" in html)
need('release toggle persists checklist', 'function toggleReleaseChange' in html and 'changeChecklistState(true)' in html)
need('release recordPassed updates state', 'function recordPassed' in html and "status:'passed'" in html and 'changeChecklistState(true)[key]=true' in html)
need('release scroll preservation', all(x in html for x in ['captureReleaseScroll','restoreReleaseScroll','preserveReleaseScroll']))
need('release rendering uses shared result', 'function renderUnreleasedChangesInner()' in html and 'result=changeResult(item)' in html)
need('pruefcenter 50/100 preserved', '50 Fragen' in html and '100 Punkte' in html)
need('functional admin guard preserved', 'r.functionAdmin===true' in html and 'if(!ihkAdmin())' in html)
need('document print exposes busy feedback', 'function viewerPrint()' in html and 'ExportHUBRC950Busy' in html and 'Druck wird vorbereitet' in html and 'Druckansicht wird geladen' in html)

if errors:
    print('RC960 regression failures:')
    for e in errors:
        print('- '+e)
    raise SystemExit(1)
print('RC960 regression contract passed')
