import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
const css=fs.readFileSync('assets/rc1800-premium-design.css','utf8');
const index=fs.readFileSync('index.html','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1800: Premium-CSS hängt am Design-Umschalter (data-eh-skin), nicht am überschriebenen Alt-Theme',()=>{
  assert.doesNotMatch(css,/data-eh-theme="premium"/);
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').map(r=>r.split('{')[0].trim()).filter(r=>r&&!r.startsWith('@'));
  for(const selectorList of rules){
    for(const selector of selectorList.split(/,(?![^(]*\))/)){
      const s=selector.trim();
      if(!s||/^(from|to|\d+%)$/.test(s))continue;
      assert.match(s,/^html\[data-eh-skin="premium"\] body\[data-eh-skin="premium"\]/,'ungeschützter Selektor: '+s);
    }
  }
});

test('RC1800: Builder bindet Premium-CSS in Produktion, TESTSERVICE und Demo ein; Alt-Theme bleibt "current"',()=>{
  assert.match(builder,/RC1800_PREMIUM_STYLE_TAG='<link id="exporthub-rc1800-premium-design" rel="stylesheet" href="\/assets\/rc1800-premium-design\.css\?v=1802">'/);
  assert.match(builder,/html=patchRc1602OfficialPod\(html,file\);\n  html=patchRc1800PremiumDesign\(html,file\);/);
  assert.match(builder,/'assets\/rc1800-premium-design\.css'/);
  assert.doesNotMatch(index,/\['premium','Premium'\]/);
  assert.match(index,/localStorage\.getItem\('exporthub-theme-choice:last'\)\|\|'current'\)/);
});

test('RC1800: alle sechs Sprachpakete kennen theme.premium',()=>{
  for(const lang of ['de','en','fr','it','es','pl']){
    const pack=JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'));
    assert.equal(typeof pack['theme.premium'],'string',lang);
    assert.ok(pack['theme.premium'].trim(),lang);
  }
});

function makeEnv(stored){
  const attrs=n=>({a:{},getAttribute(k){return k in this.a?this.a[k]:null},setAttribute(k,v){this.a[k]=String(v)},hasAttribute(k){return k in this.a},removeAttribute(k){delete this.a[k]},name:n});
  const html=attrs('html'),body=attrs('body');
  const store=new Map(stored?[['exporthub-ui-design',stored]]:[]);
  const events=[];
  const document={documentElement:html,body,readyState:'complete',getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},head:{appendChild(){}},createElement(){return{setAttribute(){},appendChild(){}}}};
  const window={document,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},addEventListener(){},dispatchEvent(e){events.push(e)},setTimeout,clearTimeout};
  window.window=window;
  class CustomEvent{constructor(type,init){this.type=type;this.detail=init&&init.detail}}
  const ctx=vm.createContext({window,document,localStorage:window.localStorage,CustomEvent,setTimeout,clearTimeout,String,Object,Array,Math,Number});
  return {ctx,html,body,store,events};
}

test('RC1800: Auswahl Premium = Klassisch als Basis plus data-eh-skin; andere Designs ohne Skin',()=>{
  const env=makeEnv('premium');
  try{vm.runInContext(runtime,env.ctx)}catch(error){/* DOM-Stub deckt nicht alle Zweige ab */}
  assert.equal(env.html.getAttribute('data-eh-design'),'classic');
  assert.equal(env.html.getAttribute('data-eh-skin'),'premium');
  assert.equal(env.body.getAttribute('data-eh-skin'),'premium');
  const api=env.ctx.window.ExportHUBDesignSwitcher;
  if(api){
    assert.equal(api.current(),'premium');
    api.apply('neon');
    assert.equal(env.html.getAttribute('data-eh-design'),'neon');
    assert.equal(env.html.getAttribute('data-eh-skin'),null);
    assert.equal(env.store.get('exporthub-ui-design'),'neon');
    assert.equal(JSON.stringify(api.designs.map(d=>d.id)),JSON.stringify(['classic','modern','glass','neon','premium']));
  }
});

test('RC1800: ohne gespeicherte Auswahl bleibt Klassisch der Standard (kein Premium-Zwang)',()=>{
  const env=makeEnv(null);
  try{vm.runInContext(runtime,env.ctx)}catch(_){}
  assert.equal(env.html.getAttribute('data-eh-design'),'classic');
  assert.equal(env.html.getAttribute('data-eh-skin'),null);
});

test('RC1800: Urgent Order steht im Menü direkt unter Packmeldungen und ist in Klassisch lesbar',()=>{
  const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
  const menuCss=fs.readFileSync('assets/rc1579-menu-redesign.css','utf8');
  const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
  assert.match(menu,/views:\['dashboard','packnotifications','urgentorders','notifications'\]/);
  assert.match(menu,/if\(v==='urgentorders'\)return '\[data-exporthub-urgent-nav\]'/);
  assert.match(menu,/ICONS\.urgentorders=/);
  assert.match(menuCss,/:not\(\[data-exporthub-urgent-nav\]\)/);
  assert.match(nav,/html\[data-eh-design="classic"\] #nav>button\[data-exporthub-urgent-nav\]/);
});
