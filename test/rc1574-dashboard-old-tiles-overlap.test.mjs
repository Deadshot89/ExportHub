import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const css=fs.readFileSync('assets/rc1558-dashboard-overview.css','utf8').replace(/\r\n/g,'\n');
const FIT='html body[data-rc1558-overview="1"][data-rc1569-fit="1"] #content:not([data-rc1371-editing="1"])';

test('RC1574 alte RC205-Kacheln ohne RC1573-Verwaltung werden im Ein-Seiten-Raster nicht als schmale Streifen gezeigt',()=>{
  assert.ok(css.includes(FIT+' > .rc205-dashboard-grid{display:contents!important}'),'RC205-Raster wird weiterhin aufgelöst');
  // RC1575: on every dashboard width, not only in the one-page layout (Eingang stayed visible below 1250px)
  assert.ok(css.includes('html body[data-rc1558-overview="1"] #content:not([data-rc1371-editing="1"]) > .rc205-dashboard-grid > .rc205-layout-item:not([data-rc1573-tile]){display:none!important}'),'alte Lager-/Aufgaben-/Sendungskacheln ausgeblendet');
});

test('RC1574 Masonry-Zeilenspannen des RC205-Rasters schieben ABD/Palettenkonto nicht über andere Kacheln',()=>{
  // dashboardMasonryMeasure() writes inline grid-row-end:span N for 4px rows; only !important beats it
  assert.ok(css.includes(FIT+' > .rc205-dashboard-grid > [data-rc1573-tile]{grid-row:auto!important;align-self:stretch}'));
  const index=fs.readFileSync('index.html','utf8');
  assert.match(index,/item\.style\.gridRowEnd='span '\+span/,'Ursache im RC205-Masonry weiterhin vorhanden – Regel bleibt nötig');
});

test('RC1574 im Bearbeiten-Modus bleiben die alten Kacheln unverändert',()=>{
  const rules=css.split('\n').filter(l=>l.includes(':not([data-rc1573-tile]){display:none'));
  assert.equal(rules.length,1);
  assert.ok(rules[0].includes('#content:not([data-rc1371-editing="1"])'),'nur außerhalb des Bearbeitens');
  assert.ok(rules[0].startsWith('html body[data-rc1558-overview="1"]'),'nur auf dem Dashboard');
});

const runtime=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');

test('RC1574 Sendung/Aufgabe vom Dashboard öffnen: Ein-Seiten-Raster wird sofort entfernt, Karten der Ansicht überlappen nicht',()=>{
  const attrs={'data-exporthub-view':'dashboard','data-rc1558-overview':'1','data-rc1569-fit':'1'};
  const body={getAttribute:k=>k in attrs?attrs[k]:null,hasAttribute:k=>k in attrs,setAttribute:(k,v)=>{attrs[k]=String(v)},removeAttribute:k=>{delete attrs[k]}};
  const observers=[];
  const content={querySelector:()=>null,querySelectorAll:()=>[]};
  const document={body,hidden:false,readyState:'complete',getElementById:id=>id==='content'?content:null,addEventListener(){},documentElement:{lang:'de'}};
  class MutationObserver{constructor(cb){this.cb=cb;observers.push(this)}observe(target,opts){this.target=target;this.opts=opts}}
  const window={document,MutationObserver,addEventListener(){},setInterval(){},setTimeout(){},requestAnimationFrame(){},innerWidth:1366,innerHeight:768,
    ExportHUBWorkspace885:{shipmentOpenList:()=>[],taskOpenList:()=>[]}};
  vm.runInNewContext(runtime,{window,Date,Intl,console,setInterval(){},setTimeout(){}});
  const viewObserver=observers.find(o=>o.target===body&&o.opts.attributeFilter.includes('data-exporthub-view'));
  assert.ok(viewObserver,'Ansichtswechsel wird beobachtet');
  attrs['data-exporthub-view']='shipmentview';
  viewObserver.cb([]);
  assert.equal(body.hasAttribute('data-rc1569-fit'),false,'60er-Raster mit fester Höhe weg');
  assert.equal(body.hasAttribute('data-rc1558-overview'),false,'Dashboard-Kennzeichen weg');
  attrs['data-rc1558-overview']='1';attrs['data-rc1569-fit']='1';attrs['data-exporthub-view']='tasks';
  viewObserver.cb([]);
  assert.equal(body.hasAttribute('data-rc1569-fit'),false,'auch in der Aufgabenansicht');
});
