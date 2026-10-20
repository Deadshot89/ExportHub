import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');

function harness(panelVisible){
  const listeners=new Map();
  let timers=0;
  const panel={isConnected:true};
  const document={
    readyState:'loading',
    getElementById(id){return panelVisible&&id==='rc786ReferenceFilesPanel'?panel:null},
    addEventListener(){}
  };
  const window={
    document,
    addEventListener(name,fn){
      if(!listeners.has(name))listeners.set(name,[]);
      listeners.get(name).push(fn);
    },
    setTimeout(){timers++;return timers},
    clearInterval(){},
    console
  };
  vm.runInNewContext(source,{window,document,console,String,Array,Object,JSON,Date,Promise,Map,Set,CustomEvent:function(){}},{filename:'rc1063-abd-blob-viewer-compat.js'});
  return{
    emit(name,detail={}){for(const fn of listeners.get(name)||[])fn({type:name,detail})},
    timers:()=>timers
  };
}

test('RC1512: globaler Sync ohne Dokumentpanel plant keinen Viewer-Refresh',()=>{
  const h=harness(false);
  h.emit('exporthub:sync',{remote:true,reason:'save-confirmation',concurrentMerge:false});
  assert.equal(h.timers(),0,'off-view Sync darf keinen RC1063-Viewer-Timer planen');
});

test('RC1512: Sync mit sichtbarem Dokumentpanel behält den Viewer-Refresh',()=>{
  const h=harness(true);
  h.emit('exporthub:sync',{remote:true,reason:'poll',concurrentMerge:true});
  assert.equal(h.timers(),1,'sichtbares Dokumentpanel muss RC1063 weiterhin aktualisieren');
});
