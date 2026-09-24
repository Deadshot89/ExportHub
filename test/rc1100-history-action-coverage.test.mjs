import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
const historyEn=JSON.parse(fs.readFileSync('assets/i18n/en.json','utf8'));
function historyI18n(language='de'){
  return {
    language(){return language},
    t(key,vars,forced){const pack=(forced||language)==='en'?historyEn:historyDe;let value=pack[key]||historyDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
    formatDate(value,options){return new Intl.DateTimeFormat(language==='en'?'en-GB':'de-DE',options||{}).format(value)}
  };
}


function api(language='de'){
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={
    ExportHUBI18n:historyI18n(language),document,addEventListener(){},console,__EXPORTHUB_GET_STATE__:()=>({})};
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return window.ExportHUBShipmentHistory1071;
}

test('RC1100: Mailversand wird je Mailtyp eindeutig benannt',()=>{
  const runtime=api();
  assert.equal(runtime.mailSentLabel('ABD-Anfrage'),'ABD-E-Mail-Versand bestätigt');
  assert.equal(runtime.mailSentLabel('Versandanmeldung'),'Versandanmeldung versendet');
  assert.equal(runtime.mailSentLabel('Lieferavis'),'Lieferavis versendet');
  assert.equal(runtime.mailSentLabel('E-Mail'),'E-Mail-Versand bestätigt');
});

test('RC1100: Mailöffnung schreibt Versandhistorie automatisch ohne manuelle Bestätigung',()=>{
  assert.doesNotMatch(source,/function ensureMailConfirm/);
  assert.doesNotMatch(source,/data-rc1071-mail-sent/);
  assert.doesNotMatch(source,/w\.confirm/);
  assert.match(source,/LAST_MAIL_META\[identity\(sh\)\]=\{to:to,subject:subject,mailType:mailKind,at:now\(\)\};[\s\S]{0,900}recordMailSent\(sh,contextText\)/);
});

test('RC1100/RC1106: Mailhistorie bleibt automatisch und enthält keinen Legacy-Release-Marker',()=>{
  assert.match(source,/mail-sent-open\|/);
  assert.match(source,/recordMailSent\(sh,contextText\)/);
  assert.doesNotMatch(source,/RC1071_LEGACY_RELEASE_MARKER/);
});

test('RC1100: Statushistorie benennt Storno Nachbearbeitung Abschluss und Archiv eindeutig',()=>{
  const runtime=api();
  assert.equal(runtime.statusLabel('Storniert'),'Sendung storniert');
  assert.equal(runtime.statusLabel('Nachbearbeitung'),'Sendung in Nachbearbeitung');
  assert.equal(runtime.statusLabel('Abgeschlossen'),'Sendung abgeschlossen');
  assert.equal(runtime.statusLabel('Archiviert'),'Sendung archiviert');
});

test('RC1100: zentrale Aktionsabdeckung enthält Dokumentänderung ABD Anmeldung Druck Mail Avis Abholung POD',()=>{
  for(const marker of [
    "change:'replaced'",
    "change:'removed'",
    "change:'added'",
    "shipmentHistory.action.abdRequestCreated",
    "shipmentHistory.action.registrationStarted",
    "type:'print'",
    "type:'mail-sent'",
    "type:'avis'",
    "type:'pickup'",
    "type:'pod'"
  ]) assert.ok(source.includes(marker),marker+' fehlt');
});

test('RC1267: sichtbare Sendungshistorie wechselt ohne Änderung der gespeicherten Fachwerte auf Englisch',()=>{
  const runtime=api('en');
  assert.equal(runtime.displayAction({type:'status',label:'Sendung storniert',details:{}}),'Shipment cancelled');
  assert.equal(runtime.displayAction({type:'created',label:'Sendung erstellt',details:{}}),'Shipment created');
  assert.equal(runtime.displayAction({type:'document-download',label:'Lieferschein – heruntergeladen',details:{document:'Lieferschein'}}),'Delivery note – downloaded');
});
