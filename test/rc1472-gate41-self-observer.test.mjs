import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1013-gate41-ui.js','utf8');

function harness(){
  const events=new Map(),timers=[];
  let observer=null;

  function isInside(target,root){
    let current=target;
    while(current){if(current===root)return true;current=current.parentNode}
    return false;
  }

  function nearestId(target,id){
    let current=target;
    while(current){if(current.id===id)return current;current=current.parentElement}
    return null;
  }

  function notify(target,added){
    if(!observer||!observer.active||!observer.options.childList||!isInside(target,observer.target))return;
    observer.pending.push({type:'childList',target,addedNodes:added?[added]:[],removedNodes:[]});
  }

  function node(id=''){
    const attrs=new Map();
    let text='';
    const el={
      id,nodeType:1,parentNode:null,parentElement:null,children:[],style:{},isConnected:true,
      setAttribute(name,value){attrs.set(name,String(value))},
      getAttribute(name){return attrs.has(name)?attrs.get(name):null},
      prepend(child){child.parentNode=this;child.parentElement=this;this.children.unshift(child);notify(this,child);return child},
      closest(selector){
        if(selector==='#rc626Shipping')return nearestId(this,'rc626Shipping');
        if(selector==='#rc1013GateStatus')return nearestId(this,'rc1013GateStatus');
        return null;
      }
    };
    Object.defineProperty(el,'textContent',{
      get(){return text},
      set(value){text=String(value);notify(el,{nodeType:3,parentNode:el,parentElement:el})}
    });
    return el;
  }

  const shipping=node('rc626Shipping');

  function findById(root,id){
    if(!root)return null;
    if(root.id===id)return root;
    for(const child of root.children||[]){const found=findById(child,id);if(found)return found}
    return null;
  }

  const document={
    readyState:'complete',
    documentElement:node('documentElement'),
    getElementById(id){return id==='rc626Shipping'?shipping:findById(shipping,id)},
    querySelector(){return null},
    createElement(){return node()},
    addEventListener(){}
  };

  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options={};this.pending=[];this.active=false;observer=this}
    observe(target,options){this.target=target;this.options=options||{};this.active=true}
    disconnect(){this.active=false}
  }

  const window={
    document,MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){const id=timers.length+1;timers.push({id,fn,ms,cleared:false,ran:false});return id},
    clearTimeout(id){const timer=timers.find(item=>item.id===id);if(timer)timer.cleared=true},
    ExportHUBI18n:{t(key){return key}}
  };

  vm.runInNewContext(source,{window,document,MutationObserver,console,String,Number,Math,Set,Array,Object,Map,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout},{filename:'rc1013-gate41-ui.js'});
  assert.ok(observer,'Gate41 observer was not installed');

  function runNextTimer(){
    const timer=timers.find(item=>!item.ran&&!item.cleared);
    if(!timer)return false;
    timer.ran=true;
    timer.fn();
    return true;
  }

  function deliver(){
    const records=observer.pending.splice(0);
    if(!records.length)return false;
    observer.callback(records);
    return true;
  }

  function externalMutation(){shipping.prepend(node('external'))}

  return{observer,timers,runNextTimer,deliver,externalMutation};
}

test('RC1472: eigenes Gate41-Update erzeugt keinen redundanten Folge-Timer',()=>{
  const h=harness();
  assert.equal(h.timers.length,1);
  assert.equal(h.runNextTimer(),true);
  assert.equal(h.deliver(),true);
  assert.equal(h.timers.length,1,'eigene Gate41-DOM-Änderungen dürfen keinen zweiten Timer planen');
});

test('RC1472: externe Shipping-DOM-Mutation bleibt reaktiv',()=>{
  const h=harness();
  h.runNextTimer();
  h.deliver();
  const before=h.timers.length;
  h.externalMutation();
  assert.equal(h.deliver(),true);
  assert.equal(h.timers.length,before+1,'externe Shipping-Mutation muss genau einen Update-Timer planen');
  assert.equal(h.observer.active,true);
});
