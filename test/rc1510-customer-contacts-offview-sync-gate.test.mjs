import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1092-customer-mail-contacts.js','utf8');

function harness(viewName){
  const listeners=new Map();
  let animationFrames=0;
  let timers=0;
  const host={};
  const document={
    readyState:'loading',
    body:host,
    getElementById(id){return id==='content'?host:null},
    querySelector(){return null},
    addEventListener(){},
    createElement(){return{}},
    documentElement:host,
    head:host
  };
  const window={
    document,
    __EXPORTHUB_GET_STATE__(){return{view:viewName}},
    addEventListener(name,fn){
      if(!listeners.has(name))listeners.set(name,[]);
      listeners.get(name).push(fn);
    },
    setTimeout(){timers++;return timers},
    clearTimeout(){},
    requestAnimationFrame(){animationFrames++;return animationFrames},
    cancelAnimationFrame(){},
    console
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,Map,Set},{filename:'rc1092-customer-mail-contacts.js'});
  return{
    emit(name,detail={}){for(const fn of listeners.get(name)||[])fn({type:name,detail})},
    animationFrames:()=>animationFrames,
    timers:()=>timers
  };
}

test('RC1510: globaler Sync außerhalb des Kundenordners plant keinen Kundenkontakt-Render',()=>{
  const h=harness('shipment');
  h.emit('exporthub:sync',{remote:true,reason:'save-confirmation',concurrentMerge:false});
  assert.equal(h.animationFrames(),0,'off-view Sync darf keinen requestAnimationFrame für RC1092 planen');
  assert.equal(h.timers(),0,'off-view Sync darf keinen RC1092-Install-Timer planen');
});

test('RC1510: Sync im Kundenordner behält den bestehenden Refresh-Pfad',()=>{
  const h=harness('customerfolder');
  h.emit('exporthub:sync',{remote:true,reason:'poll',concurrentMerge:true});
  assert.equal(h.animationFrames(),1,'Kundenordner-Sync muss RC1092 weiterhin einplanen');
});
