import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1114-shipping-neutral.js','utf8');

function harness(initialShipping=true){
  const observers=[],events=new Map(),frames=[];
  const shipping={id:'rc626Shipping',nodeType:1,querySelector(){return null},querySelectorAll(){return[]},setAttribute(){},closest(selector){return selector==='#rc626Shipping'?shipping:null}};
  const documentElement={id:'documentElement',nodeType:1};
  let currentRoot=initialShipping?shipping:null;
  const document={
    readyState:'complete',
    documentElement,
    getElementById(id){return id==='rc626Shipping'?currentRoot:null},
    addEventListener(name,fn){events.set('document:'+name,fn)},
    querySelector(){return null}
  };
  class MutationObserver{
    constructor(callback){this.callback=callback;this.target=null;this.options=null;this.disconnected=false;observers.push(this)}
    observe(target,options){this.target=target;this.options=options;this.disconnected=false}
    disconnect(){this.disconnected=true}
  }
  const window={
    document,
    MutationObserver,
    addEventListener(name,fn){events.set(name,fn)},
    requestAnimationFrame(fn){frames.push(fn);return frames.length},
    setTimeout(fn){frames.push(fn);return frames.length}
  };
  const context={window,document,console,MutationObserver,NodeFilter:{SHOW_TEXT:4},String,Array,Object,Set,Math};
  vm.runInNewContext(source,context,{filename:'rc1114-shipping-neutral.js'});
  return{observers,events,frames,shipping,documentElement,setShipping(value){currentRoot=value?shipping:null}};
}

test('RC1386: bei sichtbaren Versandkosten existiert kein globaler DOM-Observer mehr',()=>{
  const {observers,shipping,documentElement}=harness(true);
  assert.equal(observers.length,1);
  assert.equal(observers[0].target,shipping);
  assert.notEqual(observers[0].target,documentElement);
  assert.equal(observers[0].options.subtree,true);
  assert.equal(observers[0].options.childList,true);
  assert.equal(observers[0].options.characterData,true);
  assert.equal(observers[0].options.attributes,true);
});

test('RC1386: außerhalb Versand wartet nur ein leichter childList-Bootstrap-Observer',()=>{
  const {observers,documentElement}=harness(false);
  assert.equal(observers.length,1);
  assert.equal(observers[0].target,documentElement);
  assert.equal(observers[0].options.subtree,true);
  assert.equal(observers[0].options.childList,true);
  assert.equal(observers[0].options.characterData,undefined);
  assert.equal(observers[0].options.attributes,undefined);
  assert.equal(observers[0].options.attributeFilter,undefined);
});

test('RC1386: beim späteren Einfügen des Versandbereichs wechselt der Observer lokal',()=>{
  const h=harness(false);
  const bootstrap=h.observers[0];
  h.setShipping(true);
  bootstrap.callback([{addedNodes:[h.shipping]}]);
  assert.equal(bootstrap.disconnected,true);
  assert.equal(h.observers.length,2);
  assert.equal(h.observers[1].target,h.shipping);
  assert.equal(h.observers[1].options.attributes,true);
  assert.equal(h.observers[1].options.characterData,true);
});

test('RC1386: Runtime enthält keinen dauerhaften High-Frequency-Observer auf documentElement',()=>{
  assert.doesNotMatch(source,/observe\(d\.documentElement,\{subtree:true,childList:true,characterData:true,attributes:true/);
  assert.match(source,/bootstrapObserver\.observe\(d\.documentElement,\{subtree:true,childList:true\}\)/);
  assert.match(source,/observer\.observe\(root,\{subtree:true,childList:true,characterData:true,attributes:true/);
});
