import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1193-visible-release.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function harness(){
  const events=new Map(),timers=[],observers=[];
  const metrics={documentScans:0,elementScans:0};

  class Element{
    constructor(text=''){
      this.nodeType=1;
      this.textContent=text;
      this.childElementCount=0;
      this.attrs=Object.create(null);
      this.parentElement=null;
      this.parentNode=null;
    }
    hasAttribute(name){return Object.prototype.hasOwnProperty.call(this.attrs,name)}
    setAttribute(name,value){this.attrs[name]=String(value)}
    getAttribute(name){return this.attrs[name]??null}
    querySelectorAll(selector){
      if(selector==='*')metrics.elementScans++;
      return [];
    }
    contains(node){return node===this}
  }

  const documentElement=new Element();
  const body=new Element();
  const document={
    nodeType:9,
    readyState:'complete',
    title:'ExportHUB Online RC9999',
    documentElement,
    body,
    querySelectorAll(selector){
      if(selector==='*')metrics.documentScans++;
      return [];
    },
    addEventListener(){},
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;observers.push(this)}
    observe(target,options){this.target=target;this.options=options}
    disconnect(){}
  }
  const window={
    document,
    MutationObserver,
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length},
    addEventListener(name,fn){events.set(name,fn)}
  };

  vm.runInNewContext(source,{window,document,MutationObserver,console,String,Array,Object,JSON,Date,Promise,setTimeout:window.setTimeout},{filename:'rc1193-visible-release.js'});

  function flush(){
    let guard=0;
    while(timers.length){
      if(++guard>20)throw new Error('Timer-Schleife');
      const batch=timers.splice(0);
      for(const timer of batch)timer.fn();
    }
  }
  return{events,timers,observers,metrics,Element,document,documentElement,body,flush};
}

test('RC1410: Initialisierung patcht weiterhin die vollständige sichtbare Versionsanzeige',()=>{
  const h=harness();
  assert.equal(h.timers.length,1);
  h.flush();
  assert.equal(h.metrics.documentScans,1);
  assert.equal(h.document.title,'ExportHUB Online RC1112');
  assert.equal(h.documentElement.attrs['data-exporthub-visible-version'],'RC1112');
});

test('RC1410: neu eingefügter Versionsknoten wird ohne erneuten Dokument-Vollscan gepatcht',()=>{
  const h=harness();h.flush();
  const before=h.metrics.documentScans;
  const node=new h.Element('Aktuelle Version RC9999');
  h.observers[0].callback([{type:'childList',target:h.body,addedNodes:[node]}]);
  assert.equal(h.timers.length,1);
  h.flush();
  assert.equal(node.textContent,'Aktuelle Version RC1112');
  assert.equal(h.metrics.documentScans,before);
  assert.ok(h.metrics.elementScans>=1);
});

test('RC1410: CharacterData-Mutation patcht nur das betroffene Elternelement',()=>{
  const h=harness();h.flush();
  const before=h.metrics.documentScans;
  const parent=new h.Element('TESTSERVICE · RC9999 · NICHT PRODUKTION');
  const textNode={nodeType:3,parentElement:parent,parentNode:parent};
  h.observers[0].callback([{type:'characterData',target:textNode,addedNodes:[]}]);
  h.flush();
  assert.equal(parent.textContent,'TESTSERVICE · RC1112 · NICHT PRODUKTION');
  assert.equal(h.metrics.documentScans,before);
});

test('RC1410: mehrere Render-Ereignisse werden in genau einen Vollscan gebündelt',()=>{
  const h=harness();h.flush();
  const before=h.metrics.documentScans;
  for(const name of ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded']){
    const fn=h.events.get(name);
    assert.equal(typeof fn,'function',name+' fehlt');
    fn();
  }
  assert.equal(h.timers.length,1);
  h.flush();
  assert.equal(h.metrics.documentScans,before+1);
});

test('RC1410: MutationObserver bleibt funktionsfähig, ruft aber den gezielten Scheduler auf',()=>{
  assert.match(source,/new w\.MutationObserver\(scheduleMutations\)/);
  assert.match(source,/record\.type==='characterData'/);
  assert.match(source,/record\.addedNodes\|\|\[\]/);
  assert.match(source,/if\(timer\)return true/);
  assert.doesNotMatch(source,/new MutationObserver\(function\(\)\{[\s\S]*?patch\(d\)/);
});

test('RC1410: geänderte Runtime wird cache-sicher ausgeliefert',()=>{
  assert.match(build,/rc1193-visible-release\.js\?v=\$\{VISIBLE_NUMBER\}-1410/);
  assert.match(build,/rc1193-visible-release\.js\?v='\+VISIBLE_NUMBER\+'-1410'/);
});
