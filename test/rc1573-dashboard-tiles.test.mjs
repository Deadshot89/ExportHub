import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8').replace(/\r\n/g,'\n');
const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8').replace(/\r\n/g,'\n');
const i18n=fs.readFileSync('assets/i18n/rc1558-dashboard-overview.js','utf8');

function fn(name){const start=runtime.indexOf('\nfunction '+name+'(');assert.ok(start>=0,name+' fehlt');return runtime.slice(start+1,runtime.indexOf('\n}\n',start)+2)}
function sandbox(store={}){
  const window={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}},__EXPORTHUB_GET_CURRENT_USER__:()=>({id:'U-1'}),__EXPORTHUB_GET_STATE__:()=>({})};
  const ctx={w:window,Date,Intl,console,t:k=>k,esc:v=>String(v),getState:()=>({}),currentLang:()=>'de'};
  const vars=['TILE_STORE','TILE_IDS','TILE_DEFAULT','tileOverride','LOCATION_CODES','LOCATION_SHORT'].map(v=>{const m=runtime.match(new RegExp('\nvar '+v+'=[^\n]*'));assert.ok(m,v+' fehlt');return m[0]}).join('');
  vm.createContext(ctx);
  vm.runInContext(vars+'\n'+['q','low','arr','dayKey','statusOf','isCancelled','isPickedUp','colliOf','dateOf','tileUserKey','readTiles','writeTiles','lagerModel','weekModel'].map(fn).join('\n'),ctx);
  return {ctx,store};
}

test('RC1573 Kacheln: Standard, Speichern pro Benutzer, unbekannte Einträge werden ignoriert',()=>{
  const {ctx,store}=sandbox();
  const def=ctx.readTiles();
  assert.deepEqual(Array.from(def.order),['quick','lager','abd','pallet','week']);
  assert.equal(def.on.week,false);assert.equal(def.on.lager,true);
  ctx.writeTiles({order:['week','quick','evil','lager','abd','pallet'],on:{week:true,quick:false}});
  assert.ok(store['exporthub.rc1573.tiles.u-1'],'pro Benutzer gespeichert');
  const back=ctx.readTiles();
  assert.deepEqual(Array.from(back.order),['week','quick','lager','abd','pallet']);
  assert.equal(back.on.week,true);assert.equal(back.on.quick,false);assert.equal(back.on.abd,true,'fehlende Werte → Standard');
});

test('RC1573 Lagerbelegung zählt nicht abgeholte Sendungen je Location, Abholwoche Mo–Fr',()=>{
  const {ctx}=sandbox();
  const m=ctx.lagerModel([
    {status:'Erstellt',warehouseLocationCode:0,rows:[{count:2}]},
    {status:'Bereit zur Abholung',warehouseLocationCode:3,rows:[{count:4},{count:1}]},
    {status:'Abgeholt',warehouseLocationCode:3,rows:[{count:9}]},
    {status:'Storniert',warehouseLocationCode:1,rows:[{count:9}]},
    {status:'Erstellt',rows:[{count:1}]}
  ]);
  assert.equal(m.total,3);assert.equal(m.colli,8);
  assert.equal(m.rows[0].count,2);assert.equal(m.rows[3].count,1);assert.equal(m.rows[3].colli,5);
  const wk=ctx.weekModel([{status:'Abgeholt',plannedPickupDate:'2026-10-14T10:00:00'},{status:'Erstellt',plannedPickupDate:'2026-10-14T12:00:00'},{status:'Erstellt',plannedPickupDate:'2026-10-19T12:00:00'}],new Date('2026-10-15T09:00:00'));
  assert.equal(wk.days.length,5);assert.equal(wk.days[2].count,2);assert.equal(wk.days[2].done,1);assert.equal(wk.total,2,'nur diese Woche');
});

test('RC1573 Ein-Seiten-Raster: bis zu fünf Kacheln je Zeile, ausgeblendete Kacheln weg, alte RC1371-Leiste ersetzt',()=>{
  assert.match(runtime,/var PER_ROW=5,rows=Math\.ceil\(visible\.length\/PER_ROW\)\|\|1/);
  assert.match(runtime,/span\[id\]=60\/inRow/);
  assert.match(css,/\{grid-template-columns:repeat\(60,minmax\(0,1fr\)\)!important\}/);
  for(const n of ['12','15','20','30'])assert.ok(css.includes(`[data-rc1573-span="${n}"]{grid-column:span ${n}!important}`),'span '+n);
  assert.match(css,/#content \[data-rc1573-off="1"\]\{display:none!important\}/);
  assert.match(css,/#content > \.rc1371-dashboard-toolbar,\nhtml body\[data-rc1558-overview="1"\] #content > \.rc1371-quick-access\{display:none!important\}/);
  assert.match(runtime,/data-rc1573-edit="1"/);
  assert.match(runtime,/if\(root\)Array\.prototype\.forEach\.call\(root\.querySelectorAll\(':scope > \[data-rc1573-own\]'\),function\(n\)\{n\.remove\(\)\}\)/,'eigene Kacheln verschwinden außerhalb des Dashboards');
});

test('RC1573 Texte für Kacheln und Diagramme in allen sechs Sprachen',()=>{
  const root={};vm.runInNewContext(i18n,{window:root,globalThis:root});
  const I=root.ExportHUBDashboardOverview1558I18n;
  const keys=['tiles.edit','tiles.title','tiles.help','tiles.reset','tiles.done','tile.quick','tile.lager','tile.lagerDesc','tile.week','lager.sub','lager.loc0','lager.loc7','lager.bar','week.sub','week.bar'].map(k=>'dashboard.overview.'+k);
  for(const l of ['de','en','pl','es','fr','it'])for(const k of keys)assert.notEqual(I.t(k,null,l),k,l+': '+k);
});
