import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
function historyI18n(){
  return {
    language(){return 'de'},
    t(key,vars){let value=historyDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
    formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
  };
}


function api(){
  const document={body:null,readyState:'loading',addEventListener(){},getElementById(){return null},querySelector(){return null}};
  const window={
    ExportHUBI18n:historyI18n(),document,addEventListener(){},console,__EXPORTHUB_GET_STATE__:()=>({})};
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(source,context,{filename:'rc1071-shipment-history.js'});
  return window.ExportHUBShipmentHistory1071;
}

test('RC1099: Kundennummer und Erstellt-von-Metadatum werden sichtbar getrennt',()=>{
  const runtime=api();
  assert.equal(runtime.creatorMetaText('9000003014Erstellt von: Tobias'),'9000003014 · Erstellt von: Tobias');
});

test('RC1099: bereits korrekt getrennte Metadaten bleiben unverändert',()=>{
  const runtime=api();
  assert.equal(runtime.creatorMetaText('9000003014 · Erstellt von: Tobias'),'9000003014 · Erstellt von: Tobias');
  assert.equal(runtime.creatorMetaText('Erstellt von: Tobias'),'Erstellt von: Tobias');
});

test('RC1099: Reparatur wird bei jedem Sendungsrender eingeplant',()=>{
  assert.match(source,/repairCreatorMetaSpacing\(\)/);
  assert.match(source,/creatorMetaText/);
});

test('RC1099: Layout-Fallback wird je Metadaten-Element separat entschieden',()=>{
  assert.match(source,/var localChanged=false/);
  assert.match(source,/localChanged=true/);
  assert.match(source,/if\(!localChanged&&el\.childNodes/);
  assert.doesNotMatch(source,/if\(!changed&&el\.childNodes/);
});
