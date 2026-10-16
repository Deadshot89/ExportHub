import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1126-customer-delete.js','utf8');

function harness(viewName){
  const listeners=new Map();
  let timers=0;
  const host={id:'content',nodeType:1};
  const document={
    readyState:'loading',
    body:host,
    head:{appendChild(){}},
    documentElement:host,
    getElementById(id){return id==='content'?host:null},
    querySelector(){return null},
    createElement(){return{}},
    addEventListener(){}
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__(){return{view:viewName,customers:[]}},
    addEventListener(name,fn){
      if(!listeners.has(name))listeners.set(name,[]);
      listeners.get(name).push(fn);
    },
    setTimeout(){timers++;return timers},
    console
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,Map,Set,CustomEvent:function(){}},{filename:'rc1126-customer-delete.js'});
  return{
    emit(name,detail={}){for(const fn of listeners.get(name)||[])fn({type:name,detail})},
    timers:()=>timers
  };
}

test('RC1511: globaler Sync außerhalb der Kundenansicht plant keinen Kundenlösch-Render',()=>{
  const h=harness('shipments');
  h.emit('exporthub:sync',{remote:true,reason:'save-confirmation',concurrentMerge:false});
  assert.equal(h.timers(),0,'off-view Sync darf keinen RC1126-Render-Timer planen');
});

test('RC1511: Sync in der Kundenansicht behält den bestehenden Render-Pfad',()=>{
  const h=harness('customers');
  h.emit('exporthub:sync',{remote:true,reason:'poll',concurrentMerge:true});
  assert.equal(h.timers(),1,'Kundenansicht-Sync muss RC1126 weiterhin einplanen');
});
