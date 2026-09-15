import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pages=['index.html','TESTVERSION.html'];
const avisApi=fs.readFileSync('api/customer-avis/index.js','utf8');
const accessStore=fs.readFileSync('api/shared/public-access-store.js','utf8');
const pickupInit=fs.readFileSync('api/pickup-init/index.js','utf8');
const pickupStatus=fs.readFileSync('api/pickup-status/index.js','utf8');
const pickupConfirm=fs.readFileSync('api/pickup-confirm-v2/index.js','utf8');
const pickupStore=fs.readFileSync('api/shared/pickup-store.js','utf8');

function functionBody(source,startNeedle,endNeedle){
  const start=source.indexOf(startNeedle),end=source.indexOf(endNeedle,start+startNeedle.length);
  assert.ok(start>=0&&end>start,`${startNeedle} konnte nicht isoliert werden`);
  return source.slice(start,end);
}

test('Palettenkonto erlaubt manuellen Eingang und Ausgang ohne Referenz',()=>{
  for(const file of pages){
    const source=fs.readFileSync(file,'utf8');
    const add=functionBody(source,'window.rc542AddPalletBooking=function()','window.rc542CorrectPalletBooking');
    assert.doesNotMatch(add,/dir===['"]Ausgang['"]&&!ref/,`${file}: Ausgang erzwingt noch eine Referenz`);
    assert.match(add,/shipmentRef:ref/,`${file}: optionale Referenz soll bei Angabe weiter gespeichert werden`);
    assert.match(source,/Sendungsreferenz optional<input id=["']rc542PalRef["'][^>]*placeholder=["']optional["']/,`${file}: Formular kennzeichnet Referenz nicht als optional`);
  }
});

test('Benutzer ohne Rechte sehen Module und Kacheln nicht nur gesperrt, sondern gar nicht',()=>{
  for(const file of pages){
    const source=fs.readFileSync(file,'utf8');
    assert.match(source,/level===['"]none['"]\)return\s*\{visible:false,read:false,edit:false,admin:false\}/,`${file}: none muss unsichtbar sein`);
    assert.match(source,/\.hidden=!allow/,`${file}: Navigation muss versteckt werden`);
    assert.match(source,/style\.display=allow\?['"]['"]:['"]none['"]/,`${file}: Navigation darf nicht als Schloss stehen bleiben`);
    assert.match(source,/function availableModules\(\)\{return MODULES\.filter\(function\(m\)\{return canOpen\(m\.id\)\}\)\}/,`${file}: Dashboard-Module müssen gefiltert werden`);
    assert.match(source,/filter\(widgetAllowed\)/,`${file}: Dashboard-Kacheln müssen gefiltert werden`);
  }
});

test('Abhol-QR bleibt wiederverwendbar; neue Avis-Links sind einmalig bei Legacy-Kompatibilität',()=>{
  assert.match(pickupInit,/oneTime:false/,'Neu erzeugte Abhol-QR-Codes bleiben wiederverwendbar');
  assert.match(pickupStatus,/oneTime:false/,'Abholstatus bleibt kein Einmal-Link');
  assert.match(accessStore,/reusableKind=record\.kind===['"]pickup['"]\|\|\(record\.kind===['"]avis['"]&&record\.singleUse!==true\)/,'Pickup und alte Avis-Links müssen kompatibel bleiben');
  assert.match(accessStore,/singleUse:meta\.singleUse===true/,'Neue Zugriffe müssen den Einmal-Status im Datensatz speichern');

  const authorize=functionBody(avisApi,"if(req.method==='POST'&&action==='authorize')","const session=sessionFromRequest");
  assert.match(authorize,/allowUsed:false/,'Neuer Avis-Rohlink darf nach Verbrauch nicht erneut auflösbar sein');
  assert.match(authorize,/access\.consume\(/,'Avis-Link muss nach korrekter Referenzprüfung verbraucht werden');
  assert.match(authorize,/rawLinkConsumed=true/,'API muss den Verbrauch zurückmelden');
  assert.match(avisApi,/oneTime:true/,'API muss neue Avis-Links als Einmal-Link melden');
  assert.match(avisApi,/singleUse:true/,'Portalstatus muss den Einmal-Link ausweisen');
  assert.match(avisApi,/singleUse:true\},null,payload\)/,'Avis-Ausstellung muss neue Tokens explizit als singleUse markieren');
  assert.match(accessStore,/indefinite=ttlMs===null/,'Avis-Link darf bis zur ersten Aktivierung ohne starre TTL bestehen');
  assert.match(accessStore,/record\.kind!==['"]avis['"][^;]*record\.expiresAt/s,'Legacy-Avis bleibt von alter TTL befreit');
});

test('QR-Teilabholung bleibt offen; nach Abschluss bleibt die Seite lesbar',()=>{
  assert.match(pickupConfirm,/remainingAfter/);
  assert.match(pickupConfirm,/if\(complete\)await access\.consume/);
  assert.match(pickupConfirm,/if\(!complete(?:&&[^)]*)?\).*access\.clearFailures/);
  assert.match(accessStore,/record\.usedAt&&!allowUsed&&!reusableKind/,'Abgeschlossene QR-Links müssen weiterhin lesbar bleiben');
  assert.match(pickupStore,/Teilweise abgeholt/);
  assert.match(pickupStore,/pickupRemainingColliCount/);
  assert.match(pickupStore,/pickupCollectedColliCount/);
});