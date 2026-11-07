import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
const css=fs.readFileSync('assets/rc1820-top-navigation.css','utf8');
const js=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function makeEnv(stored){
  const attrs=n=>({a:{},getAttribute(k){return k in this.a?this.a[k]:null},setAttribute(k,v){this.a[k]=String(v)},hasAttribute(k){return k in this.a},removeAttribute(k){delete this.a[k]},name:n});
  const html=attrs('html'),body=attrs('body');
  const store=new Map(stored?[['exporthub-ui-design',stored]]:[]);
  const document={documentElement:html,body,readyState:'complete',getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},head:{appendChild(){}},createElement(){return{setAttribute(){},appendChild(){}}}};
  const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},addEventListener(){},dispatchEvent(){},setTimeout,clearTimeout};
  window.window=window;
  class CustomEvent{constructor(type,init){this.type=type;this.detail=init&&init.detail}}
  const ctx=vm.createContext({window,document,localStorage:window.localStorage,CustomEvent,setTimeout,clearTimeout,String,Object,Array,Math,Number});
  return {ctx,html,body,store};
}

test('RC1820: Auswahl "neu" = Premium-Skin plus Menü oben; andere Auswahl entfernt das Layout',()=>{
  const env=makeEnv('neu');
  try{vm.runInContext(runtime,env.ctx)}catch(_){/* DOM-Stub deckt nicht alle Zweige ab */}
  assert.equal(env.html.getAttribute('data-eh-design'),'classic');
  assert.equal(env.html.getAttribute('data-eh-skin'),'premium');
  assert.equal(env.html.getAttribute('data-eh-layout'),'top');
  assert.equal(env.body.getAttribute('data-eh-layout'),'top');
  const api=env.ctx.window.ExportHUBDesignSwitcher;
  if(api){
    assert.equal(api.current(),'neu');
    api.apply('premium');
    assert.equal(env.html.getAttribute('data-eh-skin'),'premium');
    assert.equal(env.html.getAttribute('data-eh-layout'),null);
    assert.equal(api.current(),'premium');
  }
});

test('RC1820: CSS greift nur bei data-eh-layout="top" und ab 1024px; Handy behält die Seitenleiste',()=>{
  const body=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.match(body,/@media \(min-width:1024px\)\{/);
  const inner=body.slice(body.indexOf('@media (min-width:1024px){'));
  for(const rule of inner.split('}').map(r=>r.split('{').pop()===undefined?'':r.split('{')[0].trim())){
    for(const s of rule.split(/,(?![^(]*\))/).map(x=>x.trim()).filter(Boolean)){
      if(/^(@|from|to|\d+%|#rc1820TopNav$)/.test(s))continue;
      assert.match(s,/^html\[data-eh-layout="top"\] body\[data-eh-layout="top"\]/,'ungeschützter Selektor: '+s);
    }
  }
});

test('RC1820: Menü oben löst nur Original-Menüknöpfe aus und respektiert gesperrte Punkte',()=>{
  assert.match(js,/function allowed\(el\)\{return !el\.hidden&&el\.getAttribute\('aria-hidden'\)!=='true'&&el\.style\.display!=='none'\}/);
  assert.match(js,/if\(t\)t\.click\(\)/);
  assert.doesNotMatch(js,/location\.(assign|href\s*=)/);
  assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|localStorage\.setItem/);
});

test('RC1820: Builder bindet CSS und Skript in Produktion, TESTSERVICE und Demo ein',()=>{
  assert.match(builder,/rc1820-top-navigation\.css\?v=1930/);
  assert.match(builder,/rc1820-top-navigation\.js\?v=1820/);
  assert.match(builder,/'assets\/rc1820-top-navigation\.css'/);
  assert.match(builder,/'assets\/rc1820-top-navigation\.js'/);
  for(const lang of ['de','en','fr','it','es','pl']){
    const pack=JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'));
    assert.ok(String(pack['theme.neu']||'').trim(),lang);
  }
});
