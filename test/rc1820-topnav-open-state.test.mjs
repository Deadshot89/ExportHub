import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped render function with a stale underlying "Sendung" marker.
// The opened mega-menu must be the only highlighted top-level section.
const source=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
const start=source.indexOf(' function render(force){');
const end=source.indexOf('\n function schedule(){',start);
assert.ok(start>=0&&end>start,'Top navigation render function not found');
const renderSource=source.slice(start,end);

function renderWith(openKey){
 const dashboard={view:'dashboard',name:'Dashboard'};
 const shipment={view:'shipment',name:'Sendung'};
 const knowledge={view:'customerfolder',name:'Kundenordner'};
 const brand={classList:{toggle(_name,value){brand.active=value}},setAttribute(){}};
 const pills={innerHTML:'',setAttribute(){}};
 const mega={innerHTML:'',hidden:true};
 const sections=[
  {key:'shipments',label:'Sendung',el:{name:'Sendung'},items:[{el:shipment,order:301}]},
  {key:'knowledge',label:'Kunden & Wissen',el:{name:'Kunden & Wissen'},items:[{el:knowledge,order:501}]}
 ];
 const ctx={
  openKey,scheduled:true,lastSig:'',current:null,
  bar:{hidden:false,querySelector(){return brand}},pills,mega,bell:{hidden:true},cta:{hidden:true},
  on:()=>true,ensureBar:()=>true,
  model:()=>({start:[{el:dashboard,order:101}],sections,notifications:null,shipment:null}),
  sigOf:()=>openKey||'closed',
  viewOf:el=>el.view||'',labelOf:el=>el.name||'',isActive:el=>el===shipment,
  iconVars:()=>'',esc:value=>String(value),tx:key=>key
 };
 vm.runInNewContext(renderSource+'\nrender(true);',ctx,{timeout:1000});
 const tabs=[...pills.innerHTML.matchAll(/<button\\b[^>]*class="([^"]*)"[^>]*data-rc1820-section="([^"]*)"/g)]
  .map(match=>({key:match[2],highlighted:match[1].split(/\\s+/).includes('is-active'),opened:match[1].split(/\\s+/).includes('is-open')}));
 return {tabs,html:pills.innerHTML,mega,brand};
}

test('RC1820: Kunden & Wissen geöffnet markiert nicht weiter Sendung',()=>{
 const result=renderWith('knowledge');
 assert.equal(result.tabs.find(tab=>tab.key==='knowledge')?.highlighted,true);
 assert.equal(result.tabs.find(tab=>tab.key==='knowledge')?.opened,true);
 assert.equal(result.tabs.find(tab=>tab.key==='shipments')?.highlighted,false);
 assert.equal(result.mega.hidden,false);
 assert.equal(result.brand.active,false);
});

test('RC1820: Nach dem Schließen zeigt die Leiste wieder die tatsächlich aktive Sendung',()=>{
 const result=renderWith('');
 assert.equal(result.tabs.find(tab=>tab.key==='shipments')?.highlighted,true);
 assert.equal(result.tabs.find(tab=>tab.key==='knowledge')?.highlighted,false);
 assert.equal(result.mega.hidden,true);
});

test('RC1820: Nur das aktuell geöffnete Mega-Menü ist hervorgehoben',()=>{
 const result=renderWith('shipments');
 assert.deepEqual(result.tabs.filter(tab=>tab.highlighted).map(tab=>tab.key),['shipments']);
});
