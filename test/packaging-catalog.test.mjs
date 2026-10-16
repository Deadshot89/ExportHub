import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(root={}){
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,Object,String,Array,Map,Set}),{filename:'packaging-catalog.js'});
  return root.ExportHubPackagingCatalog;
}
function plain(value){return value==null?value:JSON.parse(JSON.stringify(value));}

test('RC1552 packaging catalog delegates list/get to the central packaging store',()=>{
  const values=[
    {id:'PKG-EUR',name:'Euro Palette',code:'EUR',active:true,lengthCm:120,widthCm:80,heightCm:null,ldm:null},
    {id:'PKG-BOX',name:'Spezialkiste A',code:'BOXA',active:true,lengthCm:88,widthCm:55,heightCm:44,ldm:0.21}
  ];
  const root={ExportHUBPackagingStore:{
    items:()=>values.map(x=>({...x})),
    get:value=>values.find(x=>[x.id,x.name,x.code].some(v=>String(v).toLowerCase()===String(value).toLowerCase()))||null
  }};
  const catalog=load(root);
  const list=plain(catalog.list());
  assert.deepEqual(list.map(x=>x.label),['Euro Palette','Spezialkiste A']);
  assert.deepEqual(plain(catalog.get('EUR')),{key:'PKG-EUR',label:'Euro Palette',length:120,width:80,height:null});
});

test('RC1552 packaging catalog keeps aliases only as normalization compatibility',()=>{
  const catalog=load({});
  assert.equal(catalog.canonicalLabel('Europalette'),'Euro Palette');
  assert.equal(catalog.canonicalLabel('Euro-Palette'),'Euro Palette');
  assert.equal(catalog.canonicalLabel('Industriepalette'),'Industrie Palette');
  assert.equal(catalog.canonicalLabel('Dusseldorfer Palette'),'Düsseldorfer Palette');
  assert.equal(catalog.canonicalLabel('Unbekannte Spezialkiste'),'Unbekannte Spezialkiste');
});

test('RC1552 packaging catalog has no independent production packaging list without store',()=>{
  const catalog=load({});
  assert.deepEqual(plain(catalog.list()),[]);
  assert.equal(catalog.get('Euro Palette'),null);
  const source=fs.readFileSync('assets/packaging-catalog.js','utf8');
  assert.doesNotMatch(source,/const\s+entries\s*=\s*\[/,'compatibility adapter must not own an independent production entries array');
});
