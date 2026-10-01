import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1013-gate41-ui.js','utf8');

function harness(){
  const events=new Map(),timers=[],observers=[];
  const shipping={id:'rc626Shipping',prepend(){},closest(selector){return selector==='#rc626Shipping'?shipping:null}};
  const documentElement={id:'documentElement'};
  const document={
    readyState:'complete',
    documentElement,
    getElementById(id){return id==='rc626Shipping'?shipping:null},
    querySelector(){return null},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;observers.push(this)}
    observe(target,options){this.target=target;this.options=options}
    disconnect(){this.target=null}
  }
  const window={
    document,
    MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){const id=timers.length+1;timers.push({id,fn,ms});return id},
    clearTimeout(){},
    ExportHUBI18n:{t(key){return key}}
  };
  vm.runInNewContext(source,{window,document,console,String,Number,Math,Set,Array,Object,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout},{filename:'rc1013-gate41-ui.js'});
  return{events,timers,observers,shipping,documentElement};
}

test('RC1385: Gate41 beobachtet nur den Versandbereich statt den kompletten Dokumentbaum',()=>{
  const {observers,shipping,documentElement}=harness();
  assert.equal(observers.length,1);
  assert.equal(observers[0].target,shipping);
  assert.notEqual(observers[0].target,documentElement);
  assert.equal(observers[0].options&&observers[0].options.subtree,true);
  assert.equal(observers[0].options&&observers[0].options.childList,true);
});

test('RC1385: 100 fremde globale Eingaben erzeugen keinen Gate41-Timer',()=>{
  const {events,timers,shipping}=harness();
  const before=timers.length;
  const input=events.get('input');
  assert.equal(typeof input,'function');

  for(let i=0;i<100;i++)input({target:{closest(){return null}}});
  assert.equal(timers.length,before,'100 Eingaben außerhalb Versand dürfen keinen neuen Gate41-Timer erzeugen');

  input({target:{closest(selector){return selector==='#rc626Shipping'?shipping:null}}});
  assert.equal(timers.length,before+1,'Eingaben im Versandbereich müssen Gate41 weiterhin aktualisieren');
});

test('RC1385: Versand-DOM-Mutationen bleiben reaktiv',()=>{
  const {observers,timers}=harness();
  const before=timers.length;
  observers[0].callback([]);
  assert.equal(timers.length,before+1,'Mutation im beobachteten Versandbereich muss weiterhin aktualisieren');
});

test('RC1385: kein globaler Document-Observer bleibt im Runtime-Quelltext',()=>{
  assert.doesNotMatch(source,/observe\(document\.documentElement/);
  assert.match(source,/observer\.observe\(root,\{subtree:true,childList:true\}\)/);
});
