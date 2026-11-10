import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const asset=new URL('../assets/rc1488-auto-update.js',import.meta.url);

function storage(initial={}){
  const map=new Map(Object.entries(initial));
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
}

function runtime(extra={}){
  const code=fs.readFileSync(asset,'utf8');
  const listeners={},elements=new Map(),fetchCalls=[],intervals=[];
  let reloads=0;
  const document={
    visibilityState:'visible',activeElement:null,readyState:'complete',
    body:{appendChild(el){if(el.id)elements.set(el.id,el);el.parentNode=this;return el}},
    getElementById:id=>elements.get(id)||null,
    createElement(tag){
      return {tagName:String(tag).toUpperCase(),id:'',className:'',textContent:'',style:{},dataset:{},children:[],attributes:{},
        setAttribute(k,v){this.attributes[k]=String(v)},appendChild(child){this.children.push(child);child.parentNode=this;return child},
        addEventListener(type,fn){this._listeners=this._listeners||{};this._listeners[type]=fn},remove(){if(this.id)elements.delete(this.id)}};
    },
    addEventListener(type,fn){listeners['document:'+type]=fn},
    currentScript:{dataset:{buildId:extra.buildId||'aaaaaaa',visibleRelease:'RC1488'}}
  };
  const root={
    __EXPORTHUB_AUTO_UPDATE_DISABLE_AUTO_INSTALL__:true,
    document,
    location:{reload(){reloads++}},
    sessionStorage:storage(extra.sessionStorage||{}),
    ExportHUBClean:{runtime:Object.assign({changeGeneration:1,lastSavedGeneration:1,saving:false},extra.cleanRuntime||{})},
    fetch:async(url,options)=>{fetchCalls.push([String(url),options||{}]);if(extra.fetchError)throw extra.fetchError;return extra.fetchResponse||{ok:true,text:async()=>`window.__EXPORTHUB_UPDATE_BUILD__='${extra.remoteBuildId||'bbbbbbb'}';\nwindow.__EXPORTHUB_UPDATE_RELEASE__='RC1488';\n`}},
    addEventListener(type,fn){listeners[type]=fn},
    setInterval(fn,ms){intervals.push([fn,ms]);return intervals.length},clearInterval(){},setTimeout(fn){if(extra.runTimeouts)fn();return 1},clearTimeout(){},
    Date:extra.clock||Date,Promise,console:{warn(){},error(){},info(){}},
  };
  root.window=root;root.globalThis=root;
  const context=vm.createContext(root);
  vm.runInContext(code,context,{filename:String(asset)});
  return {root,api:root.ExportHUBAutoUpdate,listeners,elements,fetchCalls,intervals,get reloads(){return reloads}};
}

test('RC1488: Auto-Update-Runtime ist vorhanden',()=>{
  assert.equal(fs.existsSync(asset),true,'RC1488 Auto-Update-Runtime fehlt');
});

test('RC1488: Dirty-State nutzt die echte ExportHUB-Speichergeneration',()=>{
  const rt=runtime();
  assert.equal(typeof rt.api?.isDirty,'function');
  assert.equal(rt.api.isDirty(),false);
  rt.root.ExportHUBClean.runtime.changeGeneration=2;
  assert.equal(rt.api.isDirty(),true);
  rt.root.ExportHUBClean.runtime.lastSavedGeneration=2;
  rt.root.ExportHUBClean.runtime.saving=true;
  assert.equal(rt.api.isDirty(),true);
});

test('RC1488: gleiche Build-ID lädt die Seite nicht neu',async()=>{
  const rt=runtime({remoteBuildId:'aaaaaaa'});
  const result=await rt.api.check();
  assert.equal(result.status,'current');
  assert.equal(rt.reloads,0);
});

test('RC1488: neue Build-ID lädt bei sauberem Zustand automatisch neu',async()=>{
  const rt=runtime({remoteBuildId:'bbbbbbb'});
  const result=await rt.api.check();
  assert.equal(result.status,'reloading');
  assert.equal(rt.reloads,1);
});

test('RC1488: neue Build-ID lädt bei ungespeicherten Änderungen niemals automatisch neu',async()=>{
  const rt=runtime({remoteBuildId:'bbbbbbb',cleanRuntime:{changeGeneration:3,lastSavedGeneration:2}});
  const result=await rt.api.check();
  assert.equal(result.status,'blocked-dirty');
  assert.equal(rt.reloads,0);
  assert.ok(rt.elements.get('exporthub-rc1488-update-banner'),'Update-Hinweis fehlt');
});

test('RC1488: Versionsprüfung nutzt den ohnehin deployten Produktionsmarker und umgeht Browsercache',async()=>{
  const rt=runtime({remoteBuildId:'aaaaaaa'});
  await rt.api.check();
  assert.equal(rt.fetchCalls.length,1);
  assert.match(rt.fetchCalls[0][0],/^\/production-version\.js\?_/);
  assert.equal(rt.fetchCalls[0][1].cache,'no-store');
  assert.equal(rt.fetchCalls[0][1].credentials,'same-origin');
});

test('RC1488: Reload-Lock verhindert eine Aktualisierungsschleife',async()=>{
  const lock=JSON.stringify({from:'aaaaaaa',to:'bbbbbbb',at:Date.now()});
  const rt=runtime({remoteBuildId:'bbbbbbb',sessionStorage:{'exporthub:rc1488:reload-lock':lock}});
  const result=await rt.api.check();
  assert.equal(result.status,'reload-locked');
  assert.equal(rt.reloads,0);
});

test('RC1488: install prüft alle fünf Minuten sowie bei Fokus/Online/Rückkehr',()=>{
  const rt=runtime({remoteBuildId:'aaaaaaa'});
  rt.api.install();
  assert.equal(rt.intervals[0][1],300000);
  assert.equal(typeof rt.listeners.focus,'function');
  assert.equal(typeof rt.listeners.online,'function');
  assert.equal(typeof rt.listeners['document:visibilitychange'],'function');
});


test('RC1964: failing manifest probe is rate-limited across repeated focus, visibility and timer events',async()=>{
  let now=1000000;
  const cfg={clock:{now:()=>now},remoteBuildId:'aaaaaaa',fetchResponse:{ok:false,status:503}};
  const rt=runtime(cfg);
  rt.api.install();
  assert.equal((await rt.api.check()).status,'unavailable');
  assert.equal(rt.fetchCalls.length,1);
  for(let i=0;i<5;i++){
    rt.listeners.focus();
    rt.listeners['document:visibilitychange']();
    rt.intervals[0][0]();
  }
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(rt.fetchCalls.length,1,'focus/tab/timer must not poll an unreachable host repeatedly');
  assert.equal((await rt.api.check()).status,'cooldown');
  now+=59999;
  assert.equal((await rt.api.check()).status,'cooldown');
  now+=1;
  cfg.fetchResponse={ok:true,text:async()=> "window.__EXPORTHUB_UPDATE_BUILD__='aaaaaaa';"};
  assert.equal((await rt.api.check()).status,'current','normal update checks resume after 60s');
  assert.equal(rt.fetchCalls.length,2);
  assert.equal(rt.reloads,0);
});

test('RC1964: browser online recovery bypasses a previous manifest failure cooldown',async()=>{
  let now=1000000;
  const cfg={clock:{now:()=>now},remoteBuildId:'aaaaaaa',fetchError:new TypeError('Network failed')};
  const rt=runtime(cfg);
  rt.api.install();
  assert.equal((await rt.api.check()).status,'unavailable');
  assert.equal((await rt.api.check()).status,'cooldown');
  cfg.fetchError=null;
  rt.listeners.online();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(rt.fetchCalls.length,2,'online recovery retries immediately with no credential changes');
  assert.equal((await rt.api.check()).status,'current','successful retry clears backoff');
  assert.equal(rt.reloads,0);
});

test('RC1964: invalid manifest also throttles repeat fetches but cannot trigger reload',async()=>{
  let now=1000000;
  const cfg={clock:{now:()=>now},fetchResponse:{ok:true,text:async()=>'not a signed production build marker'}};
  const rt=runtime(cfg);
  assert.equal((await rt.api.check()).status,'invalid-manifest');
  assert.equal((await rt.api.check()).status,'cooldown');
  assert.equal(rt.fetchCalls.length,1);
  assert.equal(rt.reloads,0);
});
