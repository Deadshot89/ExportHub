import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const records=[
  {id:'DUE',name:'Düsseldorfer Palette',code:'',l:80,w:60,h:null,active:true},
  {id:'KUN',name:'Kunststoffpalette',code:'',l:122,w:116,h:null,active:true},
  {id:'IND',name:'Industrie Palette',code:'',l:120,w:100,h:null,active:true},
  {id:'GES',name:'Palettengestell',code:'',l:120,w:90,h:null,active:true},
  {id:'EUR',name:'Euro Palette',code:'EUR',l:120,w:80,h:null,active:true},
  {id:'EIN',name:'Einwegpalette',code:'',l:120,w:80,h:null,active:true}
];
function norm(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
function load(custom=records){
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  const data=custom.map(x=>({...x}));
  const root={ExportHUBPackagingStore:{activeItems:()=>data.map(x=>({...x})),get:value=>{const key=norm(value),x=data.find(item=>[item.id,item.name,item.code].some(v=>norm(v)===key));return x?{...x}:null;}}};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,Object,String,Array,Map,Set,Promise,JSON}),{filename:'packaging-catalog.js'});
  return root.ExportHubPackagingCatalog;
}

test('shared packaging catalog exposes dimensions supplied by the canonical packaging store',()=>{
  const catalog=load();
  for(const [name,length,width] of [
    ['Düsseldorfer Palette',80,60],['Kunststoffpalette',122,116],['Industrie Palette',120,100],['Palettengestell',120,90],['Euro Palette',120,80],['Einwegpalette',120,80]
  ]){
    const item=catalog.get(name);assert.ok(item,`${name} fehlt`);assert.equal(item.length,length);assert.equal(item.width,width);assert.equal(item.height,null);
  }
  const changed=load([{id:'EUR',name:'Euro Palette',code:'EUR',l:999,w:777,h:555,active:true}]).get('Euro Palette');
  assert.equal(changed.length,999);assert.equal(changed.width,777);assert.equal(changed.height,555,'catalog must not override canonical dimensions with a private table');
});

test('shared packaging catalog resolves compatibility aliases onto canonical store records',()=>{
  const catalog=load();
  assert.equal(catalog.get('Europalette').label,'Euro Palette');
  assert.equal(catalog.get('Euro-Palette').label,'Euro Palette');
  assert.equal(catalog.get('Industriepalette').label,'Industrie Palette');
  assert.equal(catalog.get('Dusseldorfer Palette').label,'Düsseldorfer Palette');
  assert.equal(catalog.get('Kunststoff Palette').label,'Kunststoffpalette');
});

test('shared packaging catalog list returns safe copies and unknown packaging returns null',()=>{
  const catalog=load(),list=catalog.list();assert.ok(Array.isArray(list));assert.ok(list.some(item=>item.label==='Euro Palette'));list[0].label='MUTATED';assert.notEqual(catalog.list()[0].label,'MUTATED');assert.equal(catalog.get('Unbekannte Spezialkiste'),null);
});
