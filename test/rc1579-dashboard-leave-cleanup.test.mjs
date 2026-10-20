import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url),'utf8');

function element(){
  const attrs=new Map();
  return {
    children:[],
    setAttribute(k,v){attrs.set(k,String(v))},getAttribute:k=>attrs.get(k)??null,hasAttribute:k=>attrs.has(k),removeAttribute:k=>attrs.delete(k),
    querySelectorAll(){return []},querySelector(){return null},appendChild(node){this.children.push(node);node.parentNode=this;return node},
    addEventListener(){},removeEventListener(){},
  };
}

function load(){
  const observers=[];
  const body=element();body.setAttribute('data-exporthub-view','dashboard');
  const store=new Map();
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  class MutationObserver{constructor(cb){this.cb=cb;observers.push(this)}observe(target,opts){this.target=target;this.opts=opts}disconnect(){}}
  const document={readyState:'complete',body,addEventListener(){},getElementById(){return null},querySelector(){return null},querySelectorAll(){return []}};
  const win={document,localStorage,MutationObserver,currentUser:{id:'user-1'},addEventListener(){},dispatchEvent(){},setTimeout(){},CustomEvent:function(){}};win.window=win;
  const context={window:win,localStorage,console,JSON,String,Array,Object,Map,Set,Date,Math,Number,Boolean,RegExp,encodeURIComponent,decodeURIComponent};
  vm.runInNewContext(source,context,{filename:'rc1371-dashboard-personalization.js'});
  return {api:win.ExportHUBDashboard1371,body,observers};
}

test('RC1579 watches the body view attribute',()=>{
  const {observers,body}=load();
  const watch=observers.find(o=>o.target===body);
  assert.ok(watch,'an observer is attached to body');
  assert.deepEqual([...watch.opts.attributeFilter],['data-exporthub-view','data-current-view']);
});

test('RC1579 opening a shipment from the dashboard removes the dashboard grid attribute',()=>{
  const {api,body,observers}=load();
  const root=element();
  api.mount(root);
  assert.equal(root.getAttribute('data-eh-dashboard-personalized'),'1');
  body.setAttribute('data-exporthub-view','shipmentview');
  observers.find(o=>o.target===body).cb([]);
  assert.equal(root.getAttribute('data-eh-dashboard-personalized'),null);
  assert.equal(api.mountedRoot(),null);
});

test('RC1579 attribute changes while on the dashboard keep the layout mounted',()=>{
  const {api,body,observers}=load();
  const root=element();
  api.mount(root);
  body.setAttribute('data-exporthub-view','dashboard');
  observers.find(o=>o.target===body).cb([]);
  assert.equal(root.getAttribute('data-eh-dashboard-personalized'),'1');
});
