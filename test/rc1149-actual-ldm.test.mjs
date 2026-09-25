import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createTestI18n} from './helpers/i18n.mjs';

function loadRuntime(){
  const code=fs.readFileSync('assets/rc1113-stowplan-persist.js','utf8');
  const listeners=new Map();
  const document={
    readyState:'loading',
    addEventListener(name,fn){listeners.set(name,fn)},
    getElementById(){return null}
  };
  const window={
    document,
    ExportHUBI18n:createTestI18n('de'),
    console,
    addEventListener(){},
    dispatchEvent(){},
    __EXPORTHUB_GET_ACTIVE_SHIPMENT__:()=>null
  };
  const context={window,document,console,Math,Number,String,Array,Object,JSON,Date,Map,Set,
    setTimeout(){return 1},clearTimeout(){},requestAnimationFrame:undefined,CustomEvent:function(){}};
  vm.runInNewContext(code,context,{filename:'rc1113-stowplan-persist.js'});
  return window.ExportHUBRC1113StowPlan;
}

function rounded(value){return Number(Number(value).toFixed(2));}

test('RC1149: tatsächliche LDM kommen aus Stellfläche geteilt durch 2,40 m',()=>{
  const api=loadRuntime();
  const result=api.actualLdmSummary([
    {type:'Euro Palette',count:2,l:120,w:80,ldm:0.20},
    {type:'Industrie Palette',count:1,l:120,w:100,ldm:0.40}
  ]);
  assert.equal(result.complete,true);
  assert.equal(rounded(result.ldm),1.30);
  assert.equal(result.missingRows.length,0);
});

test('RC1149: gestapelte Paletten zählen Bodenplätze statt physischer Paletten',()=>{
  const api=loadRuntime();
  const two=api.actualLdmSummary([{type:'Gestapelte Euro Palette',count:2,l:120,w:80,ldm:0.20}]);
  const three=api.actualLdmSummary([{type:'Gestapelte Euro Palette',count:3,l:120,w:80,ldm:0.20}]);
  assert.equal(rounded(two.ldm),0.40);
  assert.equal(rounded(three.ldm),0.80);
});

test('RC1149: vorgerundete Stammdaten-LDM überschreiben die echte Maßberechnung nicht',()=>{
  const api=loadRuntime();
  const result=api.actualLdmSummary([{type:'E3',count:10,l:43,w:31,ldm:0.06}]);
  assert.equal(result.complete,true);
  assert.equal(rounded(result.ldm),0.56);
});

test('RC1149: fehlende Maße werden nicht als tatsächliche LDM ausgegeben',()=>{
  const api=loadRuntime();
  const result=api.actualLdmSummary([{type:'Holzbox',count:1,l:'',w:'',ldm:0.60}]);
  assert.equal(result.complete,false);
  assert.equal(result.ldm,null);
  assert.equal(result.missingRows.length,1);
});

test('RC1149: Synchronisierung schreibt tatsächliche LDM in Sendung und Zeilen',()=>{
  const api=loadRuntime();
  const shipment={rows:[{type:'Gestapelte Euro Palette',count:3,l:120,w:80,ldm:0.20}]};
  const changed=api.syncActualLdm(shipment);
  assert.equal(changed,true);
  assert.equal(rounded(shipment.totalLdm),0.80);
  assert.equal(rounded(shipment.rows[0].ldm),0.27);
  assert.equal(shipment.actualLdmComplete,true);
});

test('RC1149: Produktion liefert die geänderten LDM-Runtimes cachefrei aus',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  for(const routeName of ['/assets/rc1017-multi-truck.js','/assets/rc1113-stowplan-persist.js']){
    const route=(config.routes||[]).find(x=>x.route===routeName);
    assert.ok(route,routeName+' No-Cache-Route fehlt');
    assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/);
  }
});

test('RC1149: finaler Drei-Umgebungen-Build enthält die tatsächliche LDM-Logik',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'ignore'});
  const multi=fs.readFileSync('dist-rc1112/assets/rc1017-multi-truck.js','utf8');
  const stow=fs.readFileSync('dist-rc1112/assets/rc1113-stowplan-persist.js','utf8');
  assert.match(multi,/actualEffectiveLdm/);
  assert.match(stow,/actualLdmSummary/);
  assert.match(stow,/stowplan\.actualLdm/);
});
