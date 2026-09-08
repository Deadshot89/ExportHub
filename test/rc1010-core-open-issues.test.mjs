import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const policy=require('../api/shared/user-policy.js');
const company=require('../api/shared/company-context.js');

const pages=['index.html','TESTVERSION.html'];
const avisApi=fs.readFileSync('api/customer-avis/index.js','utf8');
const accessStore=fs.readFileSync('api/shared/public-access-store.js','utf8');
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
    const add=functionBody(source,'window.rc542AddPalletBooking=function()','window.rc542CorrectPalletBooking',);
    assert.doesNotMatch(add,/dir===['"]Ausgang['"]&&!ref/ ,`${file}: Ausgang erzwingt noch eine Referenz`);
    assert.match(add,/shipmentRef:ref/,`${file}: optionale Referenz soll bei Angabe weiter gespeichert werden`);
    assert.match(source,/Sendungsreferenz optional<input id=["']rc542PalRef["'][^>]*placeholder=["']optional["']/,`${file}: Formular kennzeichnet Referenz nicht als optional`);
  }
});

test('HSE und Sicherheitsverantwortlich werden als Firmen-Admin behandelt, aber niemals als Global Admin',()=>{
  assert.equal(typeof policy.isCompanyAdmin,'function','isCompanyAdmin fehlt');
  for(const role of ['HSE','Sicherheitsverantwortlich']){
    const user=policy.normalizeUser({user:'hse-user',role,companyId:'kontur'},0);
    assert.equal(user.globalAdmin,false,`${role}: darf kein Global Admin werden`);
    assert.equal(user.companyAdmin,true,`${role}: Firmen-Admin-Markierung fehlt`);
    assert.equal(user.rights.shipment.admin,true,`${role}: Firmenprozess-Rechte fehlen`);
    assert.equal(user.rights.pallet.admin,true,`${role}: Palettenkonto-Rechte fehlen`);
    assert.equal(user.rights.rights.admin,true,`${role}: Firmen-Benutzerverwaltung fehlt`);
    assert.equal(user.rights.update.level,'none',`${role}: globales Release/Update darf nicht freigegeben werden`);
    assert.throws(()=>company.resolveCompanyContext({headers:{'x-exporthub-company-id':'essentra'}},user),e=>e&&e.code==='COMPANY_FORBIDDEN',`${role}: Firmenisolation muss erhalten bleiben`);
  }
});

test('Benutzer ohne Rechte sehen Module und Kacheln nicht nur gesperrt, sondern gar nicht',()=>{
  for(const file of pages){
    const source=fs.readFileSync(file,'utf8');
    const rightFor=functionBody(source,'function rightFor','function installRights');
    const patchNav=functionBody(source,'function patchNav','function routeMap');
    assert.match(rightFor,/level===['"]none['"][^;]*visible:false/ ,`${file}: none muss unsichtbar sein`);
    assert.match(patchNav,/\.hidden=!allow/,`${file}: Navigation muss versteckt werden`);
    assert.match(patchNav,/style\.display=allow\?['"]['"]:['"]none['"]/,`${file}: Navigation darf nicht als Schloss stehen bleiben`);
    assert.match(source,/function availableModules\(\)\{return MODULES\.filter\(function\(m\)\{return canOpen\(m\.id\)\}\)\}/,`${file}: Dashboard-Module müssen gefiltert werden`);
    assert.match(source,/filter\(widgetAllowed\)/,`${file}: Dashboard-Kacheln müssen gefiltert werden`);
  }
});

test('Aktiver Kunden-Avis-Link bleibt wiederverwendbar bis zur Deaktivierung',()=>{
  const authorize=functionBody(avisApi,"if(req.method==='POST'&&action==='authorize')","const session=sessionFromRequest");
  assert.match(authorize,/allowUsed:true/,'Avis-Link muss erneut auflösbar bleiben');
  assert.doesNotMatch(authorize,/access\.consume\(/,'Avis-Link darf beim Öffnen nicht verbraucht werden');
  assert.match(avisApi,/oneTime:false/,'API muss den Link als wiederverwendbar melden');
  assert.match(avisApi,/singleUse:false/,'Portalstatus darf keinen Einmal-Link melden');
  assert.match(avisApi,/access\.issue\([^;]*,null,payload\)/s,'Avis-Ausstellung muss ohne feste Link-Laufzeit erfolgen');
  assert.match(accessStore,/ttlMs===null[^;]*expiresAt=null/s,'Public-Access-Store muss ausdrücklich unbefristete Avis-Links unterstützen');
});

test('QR-Teilabholung bleibt offen und verbraucht den Token erst beim vollständigen Abschluss',()=>{
  assert.match(pickupConfirm,/remainingAfter/);
  assert.match(pickupConfirm,/if\(complete\)await access\.consume/);
  assert.match(pickupConfirm,/if\(!complete(?:&&[^)]*)?\).*access\.clearFailures/);
  assert.match(pickupStore,/Teilweise abgeholt/);
  assert.match(pickupStore,/pickupRemainingColliCount/);
  assert.match(pickupStore,/pickupCollectedColliCount/);
});
