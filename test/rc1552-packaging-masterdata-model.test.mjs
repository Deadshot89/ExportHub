import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);

function domain(){
  try{return require('../api/shared/packaging-masterdata.js');}
  catch(error){assert.fail(`RC1552 packaging domain fehlt: ${error&&error.code||error&&error.message||error}`);}
}

function snapshot(value){return JSON.parse(JSON.stringify(value));}

test('RC1552 normalisiert Verpackungsnamen und Codes case-insensitiv',()=>{
  const m=domain();
  assert.equal(m.normalizePackagingName('Europalette'),'europalette');
  assert.equal(m.normalizePackagingName(' EUROPALETTE '),'europalette');
  assert.equal(m.normalizePackagingName('Euro-Palette'),'europalette');
  assert.equal(m.normalizePackagingCode(' eur '),'EUR');
  assert.equal(m.normalizePackagingCode('EUR'),'EUR');
});

test('RC1552 Migration führt Legacy- und Seed-Dubletten idempotent zusammen',()=>{
  const m=domain();
  const state={
    colliTypes:[
      {id:'CT-EURO',name:'EUROPALETTE',l:120,w:80,active:false},
      {id:'OLD-E3',name:'E3',l:60,w:40,h:22,ldm:0.10}
    ],
    packagingTypes:[]
  };
  const first=m.migratePackagingState(state);
  const afterFirst=snapshot(state.packagingTypes);
  const second=m.migratePackagingState(state);
  assert.equal(first.changed,true);
  assert.equal(second.changed,false);
  assert.deepEqual(state.packagingTypes,afterFirst);
  const euro=state.packagingTypes.filter(x=>m.normalizePackagingName(x.name)==='europalette');
  assert.equal(euro.length,1,'Euro-Palette darf nach Migration nicht doppelt vorkommen');
  assert.equal(euro[0].active,false,'explizit inaktive Legacy-Stammdaten bleiben inaktiv');
});

test('RC1552 Migration schützt E3 mit 43 x 31 x 31 cm und 0,06 LDM',()=>{
  const m=domain();
  const state={colliTypes:[{id:'OLD-E3',name:'E3',l:60,w:40,h:22,ldm:0.10}]};
  const result=m.migratePackagingState(state);
  const e3=state.packagingTypes.find(x=>m.normalizePackagingName(x.name)==='e3');
  assert.ok(e3,'E3 fehlt nach Migration');
  assert.equal(e3.lengthCm,43);
  assert.equal(e3.widthCm,31);
  assert.equal(e3.heightCm,31);
  assert.equal(e3.ldm,0.06);
  assert.ok(result.conflicts.some(x=>String(x&&x.name||x&&x.key||'').toLowerCase().includes('e3')),'abweichende Legacy-E3-Werte müssen als Konflikt dokumentiert werden');
});

test('RC1552 listPackaging liefert standardmäßig nur aktive Verpackungen',()=>{
  const m=domain();
  const state={packagingTypes:[
    {id:'PKG-A',name:'Aktiv',normalizedName:'aktiv',code:'A',description:'',active:true},
    {id:'PKG-I',name:'Inaktiv',normalizedName:'inaktiv',code:'I',description:'',active:false}
  ]};
  assert.deepEqual(m.listPackaging(state).map(x=>x.id),['PKG-A']);
  assert.deepEqual(m.listPackaging(state,{includeInactive:true}).map(x=>x.id).sort(),['PKG-A','PKG-I']);
});

test('RC1552 historische Auflösung bevorzugt Snapshot vor aktuellem Stammdaten-Namen',()=>{
  const m=domain();
  const state={packagingTypes:[{id:'PKG-1',name:'Holz-Einwegpalette',normalizedName:'holzeinwegpalette',code:'HEP',description:'',active:true,lengthCm:120,widthCm:80,heightCm:null,ldm:null}]};
  const row={
    packagingTypeId:'PKG-1',
    type:'Einwegpalette',
    packagingSnapshot:{name:'Einwegpalette',code:'EWP',description:'Alt',lengthCm:120,widthCm:80,heightCm:null,ldm:null}
  };
  const resolved=m.resolveHistoricalPackaging(row,state);
  assert.equal(resolved.name,'Einwegpalette');
  assert.equal(resolved.code,'EWP');
});
