from pathlib import Path
import re

ROOT=Path('.')

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def write(path,text):
    (ROOT/path).write_text(text,encoding='utf-8')

def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: erwartet 1 Treffer, gefunden {count}')
    return text.replace(old,new,1)

# --- TESTVERSION.html: RC960 marker, QR metadata, release checklist, document print status ---
path=Path('TESTVERSION.html')
text=read(path)
if "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'" not in text:
    text=replace_once(text,"version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'","version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'",'Buildmarker')

old="packageCount:colliCount(sh),customerId:q(c.id||c.customerId||c.account||c.customerNumber||sh.customerId||sh.customerAccount||sh.customerNumber)"
new="packageCount:colliCount(sh),rows:arr(sh.rows||sh.colli||sh.collis||sh.packages).map(function(r){return clone(r)}),customerId:q(c.id||c.customerId||c.account||c.customerNumber||sh.customerId||sh.customerAccount||sh.customerNumber)"
if new not in text:
    text=replace_once(text,old,new,'QR-Metadaten mit physischen Colli-Zeilen')

old="function viewerPrint(){var frame=document.getElementById('rc786DocumentFrame');if(frame){try{frame.contentWindow.focus();frame.contentWindow.print();return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem('exporthub_document_viewer_v1',JSON.stringify(v))}catch(_){} }viewerLoad();return false}"
new="function viewerPrint(){var work=function(){var frame=document.getElementById('rc786DocumentFrame');if(frame){try{frame.contentWindow.focus();frame.contentWindow.print();return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem('exporthub_document_viewer_v1',JSON.stringify(v))}catch(_){} }viewerLoad();return false},busy=window.ExportHUBRC950Busy;return busy&&typeof busy.withBusy==='function'?busy.withBusy('Druck wird vorbereitet …',work):work()}"
if new not in text:
    text=replace_once(text,old,new,'Dokumentdruck Arbeitsstatus')

old="function releaseTests(){var release=window.ExportHUBRelease||{};return releaseItemsForCurrentVersion(release.tests)}"
new="function releaseTests(){var release=window.ExportHUBRelease||{},items=releaseItemsForCurrentVersion(release.tests);if(rcNumber(VERSION)!==960)return items;var rc960=['RC960 Sendung mit mehreren Colli-Zeilen speichern; Eingaben, Fokus und Scrollposition bleiben stabil.','RC960 QR-Abholung zeigt die komplette physische Colli-Gesamtmenge und akzeptiert nur exakt diese Gesamtmenge.','RC960 QR-Abholung mit persönlichem Verlader-PIN, Kennzeichen, Spedition und Fahrerunterschrift vollständig abschließen.','RC960 Nach QR-Abholung tatsächliches Abholdatum/Uhrzeit, POD-Status und erledigte Abholtag-Aufgabe prüfen.','RC960 Abgeholte Sendung beziehungsweise Sendung mit POD öffnen und Schreibsperre auf PC und Smartphone prüfen.','RC960 Versandkosten aus geöffneter Sendung prüfen: Zielland/Standort automatisch, UPS für Pakete, Gate41 ohne Servicefeld für Paletten.','RC960 Dokumente öffnen, herunterladen und drucken; Arbeitsstatus muss sichtbar sein und es dürfen keine leeren Dokumentseiten entstehen.','RC960 Release-Center mehrfach bestätigen; Scrollposition bleibt erhalten und bestandene Änderungen werden nicht erneut als offen gezählt.','RC960 Prüfcenter mit Funktionsadmin und Standardbenutzer prüfen; Auswertung/Verwaltung bleibt nur für Funktionsadmin.','RC960 Schneller Wechsel zwischen Sendung, Übersicht, Aufgaben, Lager und Dokumenten ohne falschen View oder verlorene Eingaben.'];var seen={};items.forEach(function(x){seen[q(x)]=true});rc960.forEach(function(x){if(!seen[x])items.push(x)});return items}"
if new not in text:
    text=replace_once(text,old,new,'RC960 Release-Tests')

old="function unreleasedChanges(){var release=window.ExportHUBRelease||{},items=Array.isArray(release.changes)?release.changes:[],prod=rcNumber(productionVersion),current=rcNumber(VERSION);return items.filter(function(item){var n=releaseItemVersion(item);if(!Number.isFinite(n))return false;if(!Number.isFinite(current)||n>current)return false;if(!Number.isFinite(prod))return n===current;return n>prod})}"
new="function unreleasedChanges(){var release=window.ExportHUBRelease||{},items=(Array.isArray(release.changes)?release.changes:[]).slice(),rc960=['RC960 QR-Abholung verwendet die vollständige physische Colli-Gesamtmenge aus allen sichtbaren Colli-Zeilen.','RC960 Pickup-Registrierung und Pickup-Bestätigung verwenden dieselbe zentrale serverseitige Colli-Gesamtermittlung und speichern die physischen Zeilen mit.','RC960 Dokumentdruck zeigt den vorhandenen ExportHUB-Arbeitsstatus statt scheinbar ohne Rückmeldung zu starten.','RC960 schützt Sendungssperre, geplantes/tatsächliches Abholdatum, POD-Status und automatische Erledigung der Abholtag-Aufgabe durch Regressionstests.','RC960 schützt Versandkosten-Zielland, UPS/Gate41-Trennung und Gate41 ohne Service durch Regressionstests.','RC960 schützt Release-Center-Scrollposition, bestätigte Änderungsstände sowie Prüfcenter-Funktionsadminrechte durch Regressionstests.','RC960 übernimmt RC945 Colli-Layout, RC946 Pointer-Drag und RC950 Frame-Batching/Fokus-Erhalt unverändert als geschützte Basis.'];if(rcNumber(VERSION)===960){var seen={};items.forEach(function(x){seen[q(x)]=true});rc960.forEach(function(x){if(!seen[x])items.unshift(x)})}var prod=rcNumber(productionVersion),current=rcNumber(VERSION);return items.filter(function(item){var n=releaseItemVersion(item);if(!Number.isFinite(n))return false;if(!Number.isFinite(current)||n>current)return false;if(!Number.isFinite(prod))return n===current;return n>prod})}"
if new not in text:
    text=replace_once(text,old,new,'RC960 Release-Änderungen')
write(path,text)

# --- pickup.html: true total from rows before ambiguous legacy colliCount fallback ---
path=Path('pickup.html')
text=read(path)
old="var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount','colliCount'];"
new="var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'];"
if new not in text:
    text=replace_once(text,old,new,'Pickup Client eindeutige Summenfelder')
old="if(best>0)return best;\n return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount']))"
new="if(best>0)return best;\n return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount','colliCount']))"
if new not in text:
    text=replace_once(text,old,new,'Pickup Client Legacy-Fallback')
write(path,text)

# --- api/shared/pickup-store.js: one authoritative physical colli total ---
path=Path('api/shared/pickup-store.js')
text=read(path)
anchor="function realPodFiles(record){return (Array.isArray(record&&record.podFiles)?record.podFiles:[]).filter(f=>String(f&&f.kind||'').toLowerCase()!=='scan-confirmation')}"
addition="""function realPodFiles(record){return (Array.isArray(record&&record.podFiles)?record.podFiles:[]).filter(f=>String(f&&f.kind||'').toLowerCase()!=='scan-confirmation')}
function colliCountValue(v){const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?n:0}
function expectedCollis(source){
  if(!source||typeof source!=='object')return 0;
  const lists=[],seen=new Set();
  function walk(x,depth){if(!x||typeof x!=='object'||depth>6||seen.has(x))return;seen.add(x);for(const key of ['rows','colli','collis','packages','packageRows','packagingRows','shipmentRows','colliRows','items','lines'])if(Array.isArray(x[key]))lists.push(x[key]);for(const value of Object.values(x))if(value&&typeof value==='object'&&!Array.isArray(value))walk(value,depth+1)}
  walk(source,0);
  let best=0;
  for(const list of lists){const total=list.reduce((sum,row)=>{if(!row||typeof row!=='object')return sum;return sum+colliCountValue(first(row,['count','qty','quantity','anzahl','menge','pieces','colliCount']))},0);if(total>best)best=total}
  if(best>0)return best;
  const trusted=colliCountValue(first(source,['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount','physicalColliCount']));
  if(trusted>0)return trusted;
  return colliCountValue(first(source,['pickupColliCount','enteredColliCount','colliCount']));
}"""
if 'function expectedCollis(source)' not in text:
    text=replace_once(text,anchor,addition,'Server Colli-Helfer')
old="expected=Math.max(0,Math.round(Number(first(r,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
new="expected=expectedCollis(r)"
text=text.replace(old,new)
old="expected=Math.max(0,Math.round(Number(first(record,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
new="expected=expectedCollis(record)"
text=text.replace(old,new)
text=text.replace("doc.clientVersion='RC873'","doc.clientVersion='RC960'")
old="module.exports={RECORD_CONTAINER,POD_CONTAINER,TEAM_CONTAINER,TEAM_BLOB,clients,connectionString,hash,safeEqualHex,validToken,json,body,principal,actor,err,now,clone,readBuffer,readJson,writeJson,recordBlob,getRecord,mutateRecord,expired,publicRecord,updateTeam,safeName,confirmationPdf,imagesPdf,createConfirmationPod,parseSignature,saveDriverSignature,signatureUrl,realPodFiles,first,sanitizeText};"
new="module.exports={RECORD_CONTAINER,POD_CONTAINER,TEAM_CONTAINER,TEAM_BLOB,clients,connectionString,hash,safeEqualHex,validToken,json,body,principal,actor,err,now,clone,readBuffer,readJson,writeJson,recordBlob,getRecord,mutateRecord,expired,publicRecord,updateTeam,safeName,confirmationPdf,imagesPdf,createConfirmationPod,parseSignature,saveDriverSignature,signatureUrl,realPodFiles,expectedCollis,first,sanitizeText};"
if new not in text:
    text=replace_once(text,old,new,'Server Export expectedCollis')
write(path,text)

# --- pickup-init: calculate from physical rows, preserve them in QR record ---
path=Path('api/pickup-init/index.js')
text=read(path)
old="const expected=count(b.expectedColliCount||b.totalColli||b.colliCount||b.packageCount);"
new="const expected=store.expectedCollis(b);"
if new not in text:
    text=replace_once(text,old,new,'pickup-init Soll-Colli')
old="const c=await store.clients(),blob=store.recordBlob(c.records,token);let current=await store.readJson(blob),existing=current.value||{},record=Object.assign({},existing),spedition=carrier(b,existing);"
new="const c=await store.clients(),blob=store.recordBlob(c.records,token);let current=await store.readJson(blob),existing=current.value||{},record=Object.assign({},existing),spedition=carrier(b,existing),sourceRows=[b.rows,b.colli,b.collis,b.packages,b.packageRows,b.packagingRows,b.shipmentRows,b.colliRows,b.items,b.lines].find(Array.isArray);"
if new not in text:
    text=replace_once(text,old,new,'pickup-init Row-Quelle')
old="record.expectedColliCount=expected;record.colliCount=expected;record.totalColli=expected;record.packageCount=expected;if(spedition)"
new="record.expectedColliCount=expected;record.colliCount=expected;record.totalColli=expected;record.packageCount=expected;if(sourceRows)record.rows=sourceRows.map(row=>Object.assign({},row));else if(!Array.isArray(record.rows))record.rows=[];if(spedition)"
if new not in text:
    text=replace_once(text,old,new,'pickup-init Row-Persistenz')
text=text.replace("record.registrationVersion='RC644';record.metadataVersion=14","record.registrationVersion='RC960';record.metadataVersion=15")
text=text.replace("context.log.error('pickup-init RC644'","context.log.error('pickup-init RC960'")
write(path,text)

# --- pickup-confirm-v2: same authoritative total as init/status ---
path=Path('api/pickup-confirm-v2/index.js')
text=read(path)
old="const expected=count(store.first(r,['expectedColliCount','totalColli','colliCount','packageCount']));"
new="const expected=store.expectedCollis(r);"
if new not in text:
    text=replace_once(text,old,new,'pickup-confirm Soll-Colli')
text=text.replace("r.confirmationVersion='RC873'","r.confirmationVersion='RC960'")
text=text.replace("version:'RC873'","version:'RC960'")
text=text.replace("context.log.error('pickup-confirm-v2 RC873'","context.log.error('pickup-confirm-v2 RC960'")
write(path,text)

print('RC960_GREEN_PATCH_APPLIED')
