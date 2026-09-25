import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');

function load(){
  const document={readyState:'loading',addEventListener(){},createComment(){return{nodeType:8,parentNode:null}}};
  const window={document,addEventListener(){},setTimeout(){return 1},clearTimeout(){},console};
  vm.runInContext(runtime,vm.createContext({window,document,console,MutationObserver:function(){}}));
  return {api:window.ExportHUBRC1109AbdDashboardCustomer,document};
}
function parent(){
  return {
    children:[],
    insertBefore(node,ref){
      const current=this.children.indexOf(node);
      if(current>=0)this.children.splice(current,1);
      const pos=this.children.indexOf(ref);
      if(pos<0)this.children.push(node);else this.children.splice(pos,0,node);
      node.parentNode=this;
    },
    removeChild(node){
      const pos=this.children.indexOf(node);
      if(pos>=0)this.children.splice(pos,1);
      node.parentNode=null;
    }
  };
}
function card(ref,p){
  const el={textContent:'ABD '+ref,dataset:{ref},parentNode:p,style:{},attributes:{},setAttribute(k,v){this.attributes[k]=String(v)}};
  p.children.push(el);
  return el;
}

test('RC1282: ABD-Anfragen werden nach Anfragezeit absteigend sortiert',()=>{
  const {api}=load(),p=parent();
  const older=card('OLD123',p),newer=card('NEW123',p);
  const state={abdRequests:[
    {id:'A1',ref:'OLD123',createdAt:'2026-09-24T08:00:00Z'},
    {id:'A2',ref:'NEW123',createdAt:'2026-09-25T10:00:00Z'}
  ]};
  const before=JSON.stringify(state);
  assert.equal(api.sortAbdCards(state,[older,newer]),1);
  assert.deepEqual(p.children,[newer,older]);
  assert.equal(newer.attributes['data-rc1282-abd-order'],'0');
  assert.equal(older.attributes['data-rc1282-abd-order'],'1');
  assert.equal(JSON.stringify(state),before,'Sortierung darf den gespeicherten ABD-State nicht verändern');
});

test('RC1282: bereits korrekt sortierte ABD-Karten lösen keinen weiteren DOM-Umbau aus',()=>{
  const {api}=load(),p=parent();
  const newest=card('NEW123',p),older=card('OLD123',p);
  const state={abdRequests:[
    {ref:'NEW123',requestedAt:'2026-09-25T12:00:00Z'},
    {ref:'OLD123',requestedAt:'2026-09-24T12:00:00Z'}
  ]};
  assert.equal(api.sortAbdCards(state,[newest,older]),0);
  assert.deepEqual(p.children,[newest,older]);
});

test('RC1282: Anfragezeit priorisiert requestedAt und unterstützt bestehende createdAt-Daten',()=>{
  const {api}=load();
  assert.ok(api.requestStamp({requestedAt:'2026-09-25T12:00:00Z'})>api.requestStamp({createdAt:'2026-09-24T12:00:00Z'}));
  assert.equal(api.requestStamp({}),0);
});

test('RC1282: Dashboard ruft die Sortierung vor der ABD-Kartenanreicherung auf',()=>{
  assert.match(runtime,/rc1282SortAbdCards\(s,cards\);cards\.forEach/);
  assert.match(runtime,/data-rc1282-abd-order/);
});
