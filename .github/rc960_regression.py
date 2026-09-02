from pathlib import Path
import re

html=Path('TESTVERSION.html').read_text()
pickup=Path('pickup.html').read_text()
store=Path('api/shared/pickup-store.js').read_text()
init=Path('api/pickup-init/index.js').read_text()
confirm=Path('api/pickup-confirm-v2/index.js').read_text()
errors=[]

def need(desc, condition):
    if not condition: errors.append(desc)

need('RC960 build marker', "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'" in html)
need('RC945 Colli layout preserved', 'exporthub-rc945-compact-stable-colli-layout' in html)
need('RC946 pointer drag preserved', 'rc946TaskPointer' in html and 'rc946WarehousePointerZone' in html)
need('RC950 frame scheduler preserved', 'rc950ScheduleLayout' in html and 'rc950PreserveActiveInput' in html and 'rc950RestoreActiveInput' in html)
need('RC950 search scheduler preserved', 'rc950ScheduleShipmentSearch' in html)
need('notification center preserved', 'Benachrichtigungscenter' in html and 'Warncenter' in html)

lock_match=re.search(r'function lockedShipment\(opts\)\{.*?function renderLockState\(\)',html,re.S)
need('shipment lock protects Abgeholt/POD', bool(lock_match and 'shipmentIsImmutable(s)' in lock_match.group(0) and "q(s.status)==='Abgeholt'" in lock_match.group(0) and 'podStatusExists(s)' in lock_match.group(0)))
save_match=re.search(r'async function saveAction\(\)\{.*?async function localFallbackSave',html,re.S)
need('save rechecks authoritative lock before persist', bool(save_match and save_match.group(0).count('lockedShipment()')>=2 and 'persistenceSave()' in save_match.group(0) and save_match.group(0).find('lockedShipment()',save_match.group(0).find('persistenceSave()')-3000)<save_match.group(0).find('persistenceSave()')))

cost_match=re.search(r'function costState\(\)\{.*?function calcGate\(data\)\{(.*?)\}function formatEuro',html,re.S)
need('Gate41 service removed', bool(cost_match and 'delete g.service' in cost_match.group(0) and 'var service=' not in cost_match.group(1) and 'g.service||' not in cost_match.group(1)))
country_match=re.search(r"function shipmentRecipientCountry\(s\)\{.*?return countryName\(fallback\)\|\|'Deutschland'\}",html,re.S)
need('structured recipient country kept', bool(country_match and 'locationData' in country_match.group(0) and 'deliveryLocation' in country_match.group(0)))
need('cost sync keeps route/load logic', all(x in html for x in ['function syncCostFromShipment','activeShipmentRoute()','shipmentLoad(s)']))

need('pickup server uses shared expectedCollis', 'expectedCollis' in store and 'store.expectedCollis(b)' in init and 'store.expectedCollis(r)' in confirm)
need('pickup client totals before legacy row count', "['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount']" in pickup and "['pickupColliCount','enteredColliCount','colliCount']" in pickup)
need('old init single-row pattern removed', 'expectedColliCount||b.totalColli||b.colliCount' not in init)
need('pickup actual date kept', 'sh.actualPickupDate=day' in store and "sh.pickupStatus='abgeholt'" in store)
need('Abholtag task completion kept', "if(area==='abholtag'" in store and "t.status='erledigt'" in store and 't.done=true' in store)
need('POD status kept', "sh.podStatus='POD vorhanden'" in store and "sh.status='POD vorhanden'" in store)
need('expected Colli helper is exported', 'expectedCollis};' in store)
need('expected Colli helper scans nested row sources', all(x in store for x in ["stack=[src]","Object.keys(node).forEach","lists=['rows','colli','collis','packages','packageRows','items']"]))
need('expected Colli helper treats decimal row totals as physical pieces', 'function physicalColliCount' in store and 'Math.ceil(n)' in store)
need('expected Colli helper leaves aggregate totals rounded', 'function positiveColliCount' in store and 'Math.round(n)' in store)
helper_start=store.find('function expectedCollis(source)')
helper_end=store.find('function signatureUrl',helper_start)
helper=store[helper_start:helper_end] if helper_start>=0 and helper_end>helper_start else ''
trusted_loop=helper.find('for(i=0;i<trusted.length;i+=1)')
row_loop=helper.find('while(stack.length)')
row_return=helper.find('if(best>0)return best')
legacy_loop=helper.find("var legacy=['pickupColliCount','enteredColliCount','colliCount']")
need('expected Colli precedence explicit > rows > legacy', bool(helper and 0<=trusted_loop<row_loop<row_return<legacy_loop))
need('ambiguous top-level colliCount is legacy only', bool(helper and helper.count("'colliCount'")>=2 and "trusted=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount']" in helper))

result_match=re.search(r'function changeResult\(item\)\{.*?\}function changeConfirmed',html,re.S)
need('release result merges persisted checklist', bool(result_match and 'changeResultState(false)' in result_match.group(0) and 'changeChecklistState(false)' in result_match.group(0)))
need('release confirm uses shared result', "return changeResult(item).status==='passed'" in html)
need('release toggle persists checklist', 'function toggleReleaseChange' in html and 'changeChecklistState(true)' in html)
need('release recordPassed updates state', 'function recordPassed' in html and "status:'passed'" in html and 'changeChecklistState(true)[key]=true' in html)
need('release scroll preservation', all(x in html for x in ['captureReleaseScroll','restoreReleaseScroll','preserveReleaseScroll']))
need('release rendering uses shared result', 'var parsed=changeResult(item)' in html)
need('pruefcenter 50/100 preserved', '50 Fragen' in html and '100 Punkte' in html)
need('functional admin guard preserved', 'r.functionAdmin===true' in html and 'if(!ihkAdmin())' in html)
need('document print exposes busy feedback', 'function viewerPrint()' in html and ('ExportHUBRC950Busy' in html or 'ExportHUBOperationStatus' in html) and 'Druck' in html)
need('QR report uses honest reference fallback', "d.reference||'Nicht verfügbar'" in html)
need('QR report labels functional recipient source', "<b>Adressat:</b>" in html and "(aus Auftrag/Standort)" in html and "<b>Empfänger:</b>" not in html)

if errors:
    print('RC960 regression failures:')
    for e in errors: print('- '+e)
    raise SystemExit(1)
print('RC960 regression contract passed')
