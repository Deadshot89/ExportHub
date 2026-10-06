import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1114-shipping-neutral.js','utf8');

function harness(){
  const rafs=[];
  const observers=[];
  let shippingObserver=null;

  const textNode={nodeType:3,parentNode:null,parentElement:null,_value:'Gate41-Ergebnis'};
  Object.defineProperty(textNode,'nodeValue',{
    get(){return this._value},
    set(value){
      this._value=String(value);
      if(shippingObserver&&shippingObserver.active&&shippingObserver.options.characterData){
        shippingObserver.pending.push({type:'characterData',target:this,addedNodes:[],removedNodes:[]});
      }
    }
  });

  const attrs=new Map();
  const root={
    id:'rc626Shipping',nodeType:1,style:{},
    get textContent(){return textNode.nodeValue},
    getAttribute(name){return attrs.has(name)?attrs.get(name):null},
    setAttribute(name,value){
      attrs.set(name,String(value));
      if(shippingObserver&&shippingObserver.active&&shippingObserver.options.attributes&&shippingObserver.options.attributeFilter.includes(name)){
        shippingObserver.pending.push({type:'attributes',target:this,attributeName:name,addedNodes:[],removedNodes:[]});
      }
    },
    removeAttribute(name){attrs.delete(name)},
    querySelectorAll(){return[]}
  };
  textNode.parentNode=root;textNode.parentElement=root;

  const document={
    readyState:'complete',documentElement:{},
    getElementById(id){return id==='rc626Shipping'?root:null},
    addEventListener(){},
    createTreeWalker(){
      let used=false;
      return{currentNode:null,nextNode(){if(used)return false;used=true;this.currentNode=textNode;return true}}
    }
  };

  class MutationObserver{
    constructor(callback){this.callback=callback;this.pending=[];this.active=false;this.options={};observers.push(this)}
    observe(target,options){this.target=target;this.options=options||{};this.active=true;if(target===root)shippingObserver=this}
    disconnect(){this.active=false}
  }

  const window={
    MutationObserver,
    addEventListener(){},
    setTimeout(fn){rafs.push(fn);return rafs.length},
    requestAnimationFrame(fn){rafs.push(fn);return rafs.length}
  };

  vm.runInNewContext(source,{window,document,MutationObserver,NodeFilter:{SHOW_TEXT:4},console,String,Array,Object,JSON,Date,RegExp},{filename:'rc1114-shipping-neutral.js'});
  assert.ok(shippingObserver,'Shipping-Observer wurde nicht installiert');
  assert.equal(rafs.length,1,'initialer Neutralisierungslauf fehlt');
  rafs.shift()();
  assert.equal(textNode.nodeValue,'Paletten-/Maut-Ergebnis');

  function deliver(records){shippingObserver.callback(records||shippingObserver.pending.splice(0))}
  return{window,root,textNode,rafs,shippingObserver,deliver};
}

test('RC1444: bereits selbst neutralisierte characterData plant keinen zweiten RAF-Scan',()=>{
  const h=harness();
  assert.equal(h.shippingObserver.pending.length,1,'Neutralisierung muss genau eine beobachtete Textmutation erzeugen');
  h.deliver();
  assert.equal(h.rafs.length,0,'bereits bereinigte Eigenmutation darf keinen zweiten Vollscan planen');
});

test('RC1444: externe relevante Textmutation wird weiterhin verarbeitet',()=>{
  const h=harness();
  h.shippingObserver.pending.length=0;
  h.textNode.nodeValue='Gate41-Tarif';
  h.deliver();
  assert.equal(h.rafs.length,1,'echte externe Gate41-Textänderung muss weiterhin einen Lauf planen');
});

test('RC1444: externe relevante Attributmutation wird weiterhin verarbeitet',()=>{
  const h=harness();
  h.shippingObserver.pending.length=0;
  h.root.setAttribute('title','Gate41-Berechnung');
  h.deliver();
  assert.equal(h.rafs.length,1,'beobachtetes relevantes Attribut muss weiterhin einen Lauf planen');
});

test('RC1444: childList bleibt konservativ und plant weiterhin einen Lauf',()=>{
  const h=harness();
  h.shippingObserver.pending.length=0;
  h.deliver([{type:'childList',target:h.root,addedNodes:[{nodeType:1}],removedNodes:[]}]);
  assert.equal(h.rafs.length,1,'DOM-Strukturänderungen müssen weiterhin verarbeitet werden');
});
