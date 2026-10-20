import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const source=fs.readFileSync('assets/rc1555-packaging-management.js','utf8');

function element(tag){
  const el={tagName:String(tag).toUpperCase(),children:[],attributes:{},style:{setProperty(){}},innerHTML:'',textContent:'',hidden:false,
    setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},hasAttribute(k){return k in this.attributes;},
    appendChild(c){this.children.push(c);c.parentElement=this;return c;},insertBefore(c){this.children.unshift(c);c.parentElement=this;return c;},
    get firstChild(){return this.children[0]||null;},querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){},remove(){}};
  return el;
}

function loadDemoRuntime({demo=true,storage={}}={}){
  const head=element('head'),body=element('body');
  const htmlAttrs={'data-exporthub-demo':demo?'1':'0','data-exporthub-environment':demo?'demo':'production'};
  const document={head,body,readyState:'complete',documentElement:{getAttribute:k=>htmlAttrs[k]??null,classList:{add(){},remove(){}}},
    getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:element,addEventListener(){}};
  const state={};const fetched=[];
  const window={document,fetch:async url=>{fetched.push(String(url));return{ok:true,json:async()=>({}),text:async()=>'{}'};},
    sessionStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v);}},
    setTimeout:()=>0,clearTimeout(){},addEventListener(){},dispatchEvent(){},CustomEvent:function(name){this.type=name;},
    __EXPORTHUB_GET_STATE__:()=>state,__EXPORTHUB_GET_CURRENT_USER__:()=>({name:'Demo Administrator',role:'Globaler Administrator'})};
  vm.runInNewContext(source,{window,document,globalThis:window,Intl,Date,JSON,Number,String,Object,Array,Promise,Error,Set});
  return {api:window.ExportHUBPackagingManagement1555,state,storage,fetched};
}

test('Demo shows the standard packaging list with dimensions without calling the API',async()=>{
  const {api,state,fetched}=loadDemoRuntime();
  await api.load();
  assert.equal(fetched.some(url=>url.includes('/api/packaging-admin')),false,'demo must never call the packaging API');
  const names=state.packagingTypes.map(x=>x.name);
  for(const name of ['Euro Palette','Industrie Palette','Düsseldorfer Palette','Kunststoffpalette','Einwegpalette','Palettengestell','E3'])assert.ok(names.includes(name),`${name} missing in demo list`);
  const e3=state.packagingTypes.find(x=>x.name==='E3');
  assert.deepEqual([e3.l,e3.w,e3.h,e3.ldm],[43,31,31,0.06]);
  assert.equal(e3.protectedDimensions,true);
  assert.equal(state.colliTypes.length,state.packagingTypes.length,'all demo entries start active and feed the colli selection');
});

test('Demo edits stay in this tab (sessionStorage) and survive a reload of the runtime',async()=>{
  const storage={};
  const changed=[{id:'PKG-X',name:'Testkiste',code:'TK',l:50,w:40,h:30,ldm:null,active:false}];
  storage.exporthub_demo_packaging_v1=JSON.stringify(changed);
  const {api,state}=loadDemoRuntime({storage});
  await api.load();
  assert.deepEqual(state.packagingTypes.map(x=>x.name),['Testkiste']);
  assert.equal(state.colliTypes.length,0,'inactive entries are not offered');
  assert.equal(state.inactiveColliTypes[0].name,'Testkiste');
});

test('Demo seeds mirror the backend seeds (names, codes, dimensions)',()=>{
  const literal=source.match(/DEMO_SEEDS=(\[[^\n]*?\]);/);
  assert.ok(literal,'DEMO_SEEDS literal missing');
  const demo=JSON.parse(JSON.stringify(vm.runInNewContext(literal[1])));
  const {SEEDS}=require('../api/shared/packaging-seed.js');
  const pick=x=>({id:x.id,name:x.name,code:x.code,l:x.l,w:x.w,h:x.h,ldm:x.ldm,protectedDimensions:x.protectedDimensions===true});
  assert.deepEqual(demo.map(pick),SEEDS.map(pick));
});

test('Outside the demo the real packaging API is used',()=>{
  assert.match(source,/async function api\(action,payload\)\{if\(demoMode\(\)\)return demoApi\(action,payload\|\|\{\}\);const response=await root\.fetch\(ENDPOINT/);
  assert.match(source,/function demoMode\(\)\{[^\n]*data-exporthub-demo[^\n]*==='1'/);
});
