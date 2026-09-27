import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SOURCE=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');

function load(view='dashboard'){
  let currentView=view;
  const rafs=[],windowHandlers={},documentHandlers={};
  const base={
    enabled(){return false},
    async toggle(){return false},
    link(){return''}
  };
  const document={
    readyState:'complete',
    body:{getAttribute(name){return name==='data-exporthub-view'?currentView:''}},
    documentElement:{},
    getElementById(){return null},
    querySelector(){return null},
    addEventListener(name,fn){documentHandlers[name]=fn}
  };
  const window={
    __EXPORTHUB_GET_STATE__:()=>({view:currentView}),
    ExportHUBCustomerAvis706:base,
    ExportHUBCustomerAvis705:base,
    addEventListener(name,fn){windowHandlers[name]=fn},
    dispatchEvent(){return true}
  };
  const context=vm.createContext({
    window,document,console,
    requestAnimationFrame(fn){rafs.push(fn);return rafs.length},
    setTimeout(fn){return 1},
    clearTimeout(){},
    URL,
    Event:function(){},
    CustomEvent:function(){},
    Map,Object,Promise
  });
  vm.runInContext(SOURCE,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  return{window,document,rafs,windowHandlers,documentHandlers,setView(v){currentView=v}};
}

test('RC1304: fremde Views planen keinen Lieferavis-UI-Refresh ein',()=>{
  const fx=load('dashboard');
  assert.equal(fx.rafs.length,0,'Boot auf Dashboard darf keinen Lieferavis-Refresh planen');
  for(let i=0;i<20;i++){
    fx.windowHandlers['exporthub:rendered']();
    fx.windowHandlers['exporthub:sync']();
  }
  assert.equal(fx.rafs.length,0,'Render-/Sync-Sturm außerhalb der Sendung darf keinen UI-Refresh planen');
});

test('RC1304: Versand-Events werden auf genau einen Refresh pro Frame zusammengefasst',()=>{
  const fx=load('dashboard');
  fx.setView('shipment');
  for(let i=0;i<20;i++)fx.windowHandlers['exporthub:viewchange']();
  assert.equal(fx.rafs.length,1,'Mehrere View-Events im selben Frame müssen koalesziert werden');
  fx.rafs.shift()();
  assert.equal(fx.rafs.length,0);

  const input={matches(selector){return selector==='#content input'}};
  for(let i=0;i<20;i++)fx.documentHandlers.input({target:input});
  assert.equal(fx.rafs.length,1,'Eingabe-Sturm in der Sendung darf nur einen Refresh pro Frame planen');
});

test('RC1304: Runtime enthält Relevanz-Guard und Refresh-Koaleszierung',()=>{
  assert.match(SOURCE,/function rc1015UiRelevant\(\)/);
  assert.match(SOURCE,/rc1021ShipmentViewActive\(\)/);
  assert.match(SOURCE,/refreshUiPending/);
  assert.match(SOURCE,/if\(!rc1015UiRelevant\(\)\|\|refreshUiPending\)return false/);
});

test('RC1304: Drei-Umgebungen-Auslieferung erzwingt frischen Lieferavis-Cache-Key',()=>{
  const build=fs.readFileSync('.github/rc1013/build-three-env.mjs','utf8');
  const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
  assert.match(build,/rc1015-lieferavis-mail-flow\.js\?v=1304/);
  assert.match(workflow,/rc1015-lieferavis-mail-flow\.js\?v=1304/);
});
