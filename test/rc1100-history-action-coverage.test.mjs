import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

function api(){
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={document,addEventListener(){},console,__EXPORTHUB_GET_STATE__:()=>({})};
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return window.ExportHUBShipmentHistory1071;
}

test('RC1100: bestätigter Mailversand wird je Mailtyp eindeutig benannt',()=>{
  const runtime=api();
  assert.equal(runtime.mailSentLabel('ABD-Anfrage'),'ABD-E-Mail-Versand bestätigt');
  assert.equal(runtime.mailSentLabel('Versandanmeldung'),'Versandanmeldung versendet');
  assert.equal(runtime.mailSentLabel('Lieferavis'),'Lieferavis versendet');
  assert.equal(runtime.mailSentLabel('E-Mail'),'E-Mail-Versand bestätigt');
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
    "base+' ersetzt'",
    "base+' entfernt'",
    "base+' hinzugefügt'",
    "label:'ABD angefordert'",
    "label:'Versandanmeldung gestartet'",
    "type:'print'",
    "type:'mail-sent'",
    "type:'avis'",
    "type:'pickup'",
    "type:'pod'"
  ]) assert.ok(source.includes(marker),marker+' fehlt');
});
