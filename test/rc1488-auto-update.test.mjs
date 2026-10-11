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
    currentScript:{dataset:{buildId:extra.buildId||'build-a',visibleRelease:'RC1488'}}
  };
  const root={
    __EXPORTHUB_AUTO_UPDATE_DISABLE_AUTO_INSTALL__:true,
    document,
    location:{reload(){reloads++}},
    sessionStorage:storage(extra.sessionStorage||{}),
    ExportHUBClean:{runtime:Object.assign({changeGeneration:1,lastSavedGeneration:1,saving:false},extra.cleanRuntime||{})},
    fetch:async(url,options)=>{fetchCalls.push([String(url),options||{}]);return extra.fetchResponse||{ok:true,json:async()=>({schema:'exporthub-update-v1',buildId:extra.remoteBuildId||'build-b',visibleRelease:'RC1488'})}},
    addEventListener(type,fn){listeners[type]=fn},
    setInterval(fn,ms){intervals.push([fn,ms]);return intervals.length},clearInterval(){},setTimeout(fn){if(extra.runTimeouts)fn();return 1},clearTimeout(){},
    Date,Promise,console:{warn(){},error(){},info(){}},
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
  const rt=runtime({remoteBuildId:'build-a'});
  const result=await rt.api.check();
  assert.equal(result.status,'current');
  assert.equal(rt.reloads,0);
});

test('RC1488: neue Build-ID lädt bei sauberem Zustand automatisch neu',async()=>{
  const rt=runtime({remoteBuildId:'build-b'});
  const result=await rt.api.check();
  assert.equal(result.status,'reloading');
  assert.equal(rt.reloads,1);
});

test('RC1488: neue Build-ID lädt bei ungespeicherten Änderungen niemals automatisch neu',async()=>{
  const rt=runtime({remoteBuildId:'build-b',cleanRuntime:{changeGeneration:3,lastSavedGeneration:2}});
  const result=await rt.api.check();
  assert.equal(result.status,'blocked-dirty');
  assert.equal(rt.reloads,0);
  assert.ok(rt.elements.get('exporthub-rc1488-update-banner'),'Update-Hinweis fehlt');
});

test('RC1488: Versionsprüfung umgeht Browsercache',async()=>{
  const rt=runtime({remoteBuildId:'build-a'});
  await rt.api.check();
  assert.equal(rt.fetchCalls.length,1);
  assert.match(rt.fetchCalls[0][0],/^\/exporthub-update\.json\?_/);
  assert.equal(rt.fetchCalls[0][1].cache,'no-store');
  assert.equal(rt.fetchCalls[0][1].credentials,'same-origin');
});

test('RC1488: Reload-Lock verhindert eine Aktualisierungsschleife',async()=>{
  const lock=JSON.stringify({from:'build-a',to:'build-b',at:Date.now()});
  const rt=runtime({remoteBuildId:'build-b',sessionStorage:{'exporthub:rc1488:reload-lock':lock}});
  const result=await rt.api.check();
  assert.equal(result.status,'reload-locked');
  assert.equal(rt.reloads,0);
});

test('RC1488: install prüft alle fünf Minuten sowie bei Fokus/Online/Rückkehr',()=>{
  const rt=runtime({remoteBuildId:'build-a'});
  rt.api.install();
  assert.equal(rt.intervals[0][1],300000);
  assert.equal(typeof rt.listeners.focus,'function');
  assert.equal(typeof rt.listeners.online,'function');
  assert.equal(typeof rt.listeners['document:visibilitychange'],'function');
});
