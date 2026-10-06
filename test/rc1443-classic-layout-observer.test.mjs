import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1306-layout-engine.js','utf8');

function element(id){
  const attrs=new Map();
  const node={
    id:id||'',nodeType:1,children:[],parentNode:null,nextSibling:null,textContent:'',className:'',
    getAttribute(name){return attrs.get(name)||''},
    setAttribute(name,value){attrs.set(name,String(value))},
    removeAttribute(name){attrs.delete(name)},
    hasAttribute(name){return attrs.has(name)},
    appendChild(child){if(child){child.parentNode=this;this.children.push(child)}return child},
    insertBefore(child){if(child){child.parentNode=this;this.children.push(child)}return child},
    contains(child){if(child===this)return true;return this.children.includes(child)},
    addEventListener(){},scrollIntoView(){},remove(){}
  };
  return node;
}

function harness(){
  const observers=[],events=new Map(),timers=[];
  const documentElement=element('html');
  documentElement.setAttribute('data-eh-design','classic');
  const body=element('body');
  body.setAttribute('data-exporthub-view','dashboard');
  const content=element('content');
  const document={
    readyState:'complete',documentElement,body,
    querySelectorAll(){return[]},
    getElementById(id){return id==='content'?content:null},
    createElement(tag){return element(tag)},
    addEventListener(){}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.active=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.active=true}
    disconnect(){this.active=false;this.target=null}
  }
  const window={
    document,MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    setTimeout(fn,ms){const id=timers.length+1;timers.push({id,fn,ms,cancelled:false});return id},
    clearTimeout(id){const timer=timers.find(row=>row.id===id);if(timer)timer.cancelled=true},
    __EXPORTHUB_GET_STATE__:()=>({view:'dashboard'})
  };
  vm.runInNewContext(source,{window,document,MutationObserver,console,String,Array,Object,JSON,Date,Promise,WeakMap,Map,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout},{filename:'rc1306-layout-engine.js'});
  function activeBodyObservers(){return observers.filter(observer=>observer.active&&observer.target===body&&observer.options&&observer.options.childList===true&&observer.options.subtree===true)}
  function activeDesignObservers(){return observers.filter(observer=>observer.active&&observer.target===documentElement&&observer.options&&observer.options.attributes===true)}
  return{window,documentElement,body,observers,events,timers,activeBodyObservers,activeDesignObservers};
}

test('RC1443: Classic startet ohne body-weiten Layout-Observer',()=>{
  const h=harness();
  assert.equal(h.activeBodyObservers().length,0,'Classic darf keinen body-weiten MutationObserver aktiv halten');
  assert.equal(h.activeDesignObservers().length,1,'Theme-Wechsel muss in Classic weiterhin beobachtet werden');
});

test('RC1443: Modern aktiviert body-observation und Rückkehr zu Classic trennt sie wieder',()=>{
  const h=harness();
  const change=h.events.get('exporthub:designchange');
  assert.equal(typeof change,'function','Designchange-Handler fehlt');

  h.documentElement.setAttribute('data-eh-design','modern');
  change();
  assert.equal(h.activeBodyObservers().length,1,'Modern benötigt weiterhin genau einen body-weiten Layout-Observer');

  h.documentElement.setAttribute('data-eh-design','classic');
  change();
  assert.equal(h.activeBodyObservers().length,0,'nach Rückkehr zu Classic muss der body-weite Observer getrennt sein');
  assert.equal(h.activeDesignObservers().length,1,'Design-Observer muss auch danach aktiv bleiben');
});
