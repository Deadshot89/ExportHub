import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
function historyI18n(){
  return {
    language(){return 'de'},
    t(key,vars){let value=historyDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
    formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
  };
}


function historyRuntime(shipment){
  const state={view:'shipment',currentShipment:shipment,shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={
    ExportHUBI18n:historyI18n(),
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(){return true},flushSave(){return Promise.resolve(true)}},
    addEventListener(){},document,console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,decodeURIComponent,
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(history,context,{filename:'rc1071-shipment-history.js'});
  return window.ExportHUBShipmentHistory1071;
}

test('RC1148: Dokument-History trennt Öffnen und Drucken und speichert Benutzer sowie Dateiname',()=>{
  assert.match(history,/type:'document-open'/,'eigener History-Typ für Dokument öffnen fehlt');
  assert.match(history,/shipmentHistory\.action\.documentOpened/,'lokalisierbarer Öffnen-Eintrag fehlt');
  assert.match(history,/shipmentHistory\.action\.documentPrinted/,'lokalisierbarer Druck-Eintrag fehlt');
  assert.match(history,/function documentActionFileName/,'Dateiname muss aus Button, Link oder Sendungsdokument ermittelt werden');

  const sh={id:'S1',ref:'ABC123',abdFiles:[{name:'ABD_ABC123_original.pdf'}]};
  const api=historyRuntime(sh);
  const file=api.documentActionFileName(null,'ABD öffnen','ABD');
  assert.equal(file,'ABD_ABC123_original.pdf');
  api.recordDocumentAction(sh,'open','ABD',file);
  api.recordDocumentAction(sh,'print','CMR','CMR_ABC123.pdf');
  const open=sh.shipmentHistory.find(x=>x.type==='document-open');
  const print=sh.shipmentHistory.find(x=>x.type==='print');
  assert.equal(open.label,'ABD – geöffnet');
  assert.equal(open.actor.name,'Tobias');
  assert.equal(open.details.fileName,'ABD_ABC123_original.pdf');
  assert.equal(print.label,'CMR – gedruckt');
  assert.equal(print.actor.name,'Tobias');
  assert.equal(print.details.fileName,'CMR_ABC123.pdf');
});

test('RC1148: Deckblatt-Hochsichtbarkeitsregel wird als gültige geschlossene CSS-Regel gebaut',()=>{
  assert.match(build,/return '\.rc352-cover\{'\+next\+'\}'/,'schließende CSS-Klammer der Deckblatt-Regel fehlt');
  assert.match(build,/return '\.rc352-cover-ref\{'\+next\+'\}'/,'schließende CSS-Klammer des Referenzfelds fehlt');
  assert.match(build,/background:linear-gradient\(180deg,#1d4ed8 0,#60a5fa 66mm,#dbeafe 66mm,#eff6ff 100%\)/,'farbige Deckblattfläche fehlt');
  assert.match(build,/background:#facc15/,'gelbes Referenzfeld fehlt');

  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'ignore'});
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const cover=/\.rc352-cover\{([^}]*)\}/.exec(html);
  const reference=/\.rc352-cover-ref\{([^}]*)\}/.exec(html);
  assert.ok(cover,'Deckblatt-CSS-Regel fehlt im finalen Artefakt');
  assert.ok(reference,'Referenz-CSS-Regel fehlt im finalen Artefakt');
  assert.match(cover[1],/background:linear-gradient\(180deg,#1d4ed8 0,#60a5fa 66mm,#dbeafe 66mm,#eff6ff 100%\)/);
  assert.match(cover[1],/border-top-width:18mm!important/);
  assert.match(reference[1],/background:#facc15/);
});