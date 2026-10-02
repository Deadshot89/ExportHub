import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1016-mobile-navigation.js','utf8');

function harness(mobile=true){
  const observers=[],events=new Map(),timers=[];
  let button=null;
  const body={
    classList:{contains(){return false},toggle(){}},
    appendChild(node){button=node;node.parentElement=body;return node}
  };
  const documentElement={id:'html'};
  const document={
    readyState:'complete',
    body,
    documentElement,
    getElementById(id){return id==='rc1016MobileMenuBtn'?button:null},
    createElement(){
      return {
        id:'',type:'',className:'',textContent:'',parentElement:null,
        setAttribute(){},
        addEventListener(){},
        remove(){if(button===this)button=null}
      };
    },
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const context={
    document,
    MutationObserver,
    matchMedia(){return {matches:mobile}},
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn){timers.push(fn);return timers.length},
    ExportHUBMobileMenu:null,
    console
  };
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'rc1016-mobile-navigation.js'});
  return{context,document,body,documentElement,observers,events,timers,getButton(){return button},removeButton(){if(button)button.remove()}};
}

test('RC1400: Desktop hat keinen Mobile-Navigation-DOM-Observer',()=>{
  const h=harness(false);
  assert.equal(h.observers.length,0);
  assert.equal(h.getButton(),null);
});

test('RC1400: Mobile beobachtet nur direkte body-Kinder statt den gesamten Dokumentbaum',()=>{
  const h=harness(true);
  assert.ok(h.getButton(),'Menüknopf muss weiterhin erstellt werden');
  assert.equal(h.observers.length,1);
  assert.equal(h.observers[0].target,h.body);
  assert.notEqual(h.observers[0].target,h.documentElement);
  assert.deepEqual(h.observers[0].options,{childList:true});
});

test('RC1400: Entfernen des Body-Menüknopfs löst weiterhin eine Reparatur aus',()=>{
  const h=harness(true);
  const observer=h.observers[0];
  const before=h.timers.length;
  h.removeButton();
  observer.callback([{type:'childList'}]);
  assert.equal(h.timers.length,before+1,'fehlender Menüknopf muss eine Reparatur planen');
  h.timers[h.timers.length-1]();
  assert.ok(h.getButton(),'Menüknopf muss nach Reparatur wieder vorhanden sein');
});

test('RC1400: Runtime enthält keinen documentElement-subtree-Observer mehr',()=>{
  assert.doesNotMatch(source,/observe\(root\.document\.documentElement,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(source,/observe\(doc\.body,\{childList:true,subtree:true\}\)/);
  assert.match(source,/observer\.observe\(doc\.body,\{childList:true\}\)/);
});

test('RC1400: aktueller RC1112-Build bustet nur den Produktions-Cache-Key',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const historical=fs.readFileSync('.github/rc1016/build-three-env.mjs','utf8');
  assert.match(build,/assets\/rc1016-mobile-navigation\.js\?v=1400/);
  assert.match(historical,/assets\/rc1016-mobile-navigation\.js\?v=1016/);
});
