import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
const css=fs.readFileSync('assets/rc1930-design-paletten.css','utf8');
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
  try{vm.runInContext(runtime,ctx)}catch(_){/* DOM-Stub deckt nicht alle Zweige ab */}
  return {html,body,store,api:ctx.window.ExportHUBDesignSwitcher};
}

const EXPECT={
  frost:{layout:'rail'},graphit:{layout:'rail'},azur:{layout:'rail'},stahl:{layout:'rail'},polar:{layout:'rail'}
};

for(const [id,exp] of Object.entries(EXPECT)){
  test('RC1930: '+id+' = Premium-Skin + Palette + neue Oberfläche',()=>{
    const env=makeEnv(id);
    for(const node of [env.html,env.body]){
      assert.equal(node.getAttribute('data-eh-design'),'classic');
      assert.equal(node.getAttribute('data-eh-skin'),'premium');
      assert.equal(node.getAttribute('data-eh-palette'),id);
      assert.equal(node.getAttribute('data-eh-newui'),'1');
      assert.equal(node.getAttribute('data-eh-layout'),exp.layout);
    }
    if(env.api)assert.equal(env.api.current(),id);
  });
}

test('RC1930: Horizont (neu) behält Menü oben und neue Oberfläche, Indigo (premium) und Original ohne neue Oberfläche',()=>{
  const neu=makeEnv('neu');
  assert.equal(neu.html.getAttribute('data-eh-layout'),'top');
  assert.equal(neu.html.getAttribute('data-eh-newui'),'1');
  assert.equal(neu.html.getAttribute('data-eh-palette'),null);
  const premium=makeEnv('premium');
  assert.equal(premium.html.getAttribute('data-eh-newui'),null);
  assert.equal(premium.html.getAttribute('data-eh-palette'),null);
  const classic=makeEnv(null);
  assert.equal(classic.html.getAttribute('data-eh-skin'),null);
  assert.equal(classic.html.getAttribute('data-eh-newui'),null);
});

for(const old of ['modern','glass','neon']){
  test('RC1930: gespeichertes Altdesign '+old+' fällt auf Original zurück',()=>{
    const env=makeEnv(old);
    assert.equal(env.html.getAttribute('data-eh-design'),'classic');
    assert.equal(env.html.getAttribute('data-eh-skin'),null);
    assert.equal(env.html.getAttribute('data-eh-palette'),null);
  });
}

test('RC1930: Paletten-CSS greift nur bei data-eh-palette bzw. Polar-Leiste, Reduced Motion respektiert',()=>{
  const body=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g,'');
  const selectors=[];
  body.replace(/([^{}]+)\{/g,(m,sel)=>{sel=sel.trim();if(sel&&!sel.startsWith('@')&&!/^(from|to|\d+%)/.test(sel))selectors.push(sel);return m});
  assert.ok(selectors.length>20);
  for(const group of selectors){
    for(const s of group.split(/,(?![^(]*\))/).map(x=>x.trim()).filter(Boolean)){
      assert.match(s,/^html\[data-eh-(palette|layout="rail")/,'ungeschützter Selektor: '+s);
    }
  }
  for(const id of Object.keys(EXPECT))assert.match(css,new RegExp('html\\[data-eh-palette="'+id+'"\\]\\{'));
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('RC1930: Builder bindet die Paletten ein, Sprachpakete kennen alle Namen',()=>{
  assert.match(builder,/rc1930-design-paletten\.css\?v=1935/);
  assert.match(builder,/'assets\/rc1930-design-paletten\.css'/);
  for(const lang of ['de','en','fr','it','es','pl']){
    const pack=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of ['classic','premium','neu','frost','graphit','azur','stahl','polar'])assert.ok(String(pack['theme.'+key]||'').trim(),lang+' theme.'+key);
    assert.equal(pack['theme.classic'],'Original');
    assert.equal(pack['theme.premium'],'Indigo');
  }
  // RC1934: deutsche Wörter als Designnamen werden übersetzt (Englisch: Horizon, Graphite, Azure, Steel)
  const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8')),en=JSON.parse(fs.readFileSync('assets/i18n/en.json','utf8'));
  assert.deepEqual(['neu','graphit','azur','stahl'].map(k=>de['theme.'+k]),['Horizont','Graphit','Azur','Stahl']);
  assert.deepEqual(['neu','graphit','azur','stahl'].map(k=>en['theme.'+k]),['Horizon','Graphite','Azure','Steel']);
});

test('RC1930: Design-Rahmen (Glocke, Benutzermenü) löst nur Original-Knöpfe aus und ist eingebunden',()=>{
  const frame=fs.readFileSync('assets/rc1930-design-rahmen.js','utf8');
  assert.match(builder,/rc1930-design-rahmen\.js\?v=1935/);
  assert.match(builder,/'assets\/rc1930-design-rahmen\.js'/);
  assert.match(builder,/RC1930 Design-Rahmen fehlt/);
  assert.match(frame,/data-view="notifications"/);
  assert.doesNotMatch(frame,/fetch\(|XMLHttpRequest|localStorage\.setItem|location\.(assign|href\s*=|reload)/);
  for(const lang of ['de','en','fr','it','es','pl']){
    const pack=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of ['rc1930.userMenu','rc1930.notifications'])assert.ok(String(pack[key]||'').trim(),lang+' '+key);
  }
});

test('RC1931: Frost folgt dem Entwurf (Menü mit Icons, Benutzerknopf im Menü, Startklar-Leiste)',()=>{
  const frame=fs.readFileSync('assets/rc1930-design-rahmen.js','utf8');
  const topnav=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
  assert.match(topnav,/rc1820-pill-icon/);
  assert.match(topnav,/rc1820-pill-home/);
  assert.match(frame,/#rc1820TopNav \.rc1820-actions/);
  assert.match(frame,/getElementById\('globalSearch'\)/);
  assert.match(frame,/data-rc1930-title/);
  assert.match(css,/html\[data-eh-palette\]\[data-rc1903-view="capture"\] main\.main\{grid-template-columns:/);
  assert.match(css,/\.rc1902-steps\{\s*grid-column:3;grid-row:3\/span 7;[^}]*position:sticky/);
  for(const lang of ['de','en','fr','it','es','pl']){
    const pack=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of ['rc1930.ready','rc1930.ctrl'])assert.ok(String(pack[key]||'').trim(),lang+' '+key);
  }
});

test('RC1932: Schritt-Sprung der Sendungsmaske wird nicht von einer lokalen Variable überdeckt, Felder schneiden keine Schrift ab',()=>{
  const form=fs.readFileSync('assets/rc1902-neue-sendungsmaske.js','utf8');
  const click=form.slice(form.indexOf('function onClick(ev){'),form.indexOf('function schedule(){'));
  assert.doesNotMatch(click,/var target\b/);
  assert.match(click,/el=target\(id\)/);
  assert.match(css,/#rc1903Capture#rc1903Capture :is\(input[^{]*select\)\{min-height:34px!important;height:34px!important;padding-top:6px!important;padding-bottom:6px!important;line-height:20px!important/);
});

test('RC1933: alle neuen Designs mit einklappbarer Leiste, Sendung öffnet im Seitenfenster, Ansichtsklicks ohne Ladebalken',()=>{
  const sw=fs.readFileSync('assets/rc1304-theme-switcher.js','utf8');
  const ov=fs.readFileSync('assets/rc1900-neue-sendungsuebersicht.js','utf8');
  assert.match(sw,/function layoutOf\(value\)\{return value===NEU\?'top':\(isPalette\(value\)\?'rail':''\)\}/);
  assert.match(css,/html\[data-eh-palette\] #rc1900Overview#rc1900Overview \.rc1900-detail\{position:sticky/);
  assert.match(ov,/data-rc1900-open="'\+esc\(it\.id\)\+'" data-rc739-no-loading="1"/);
  assert.match(fs.readFileSync('assets/rc1902-neue-sendungsmaske.js','utf8'),/data-rc739-no-loading="1" data-rc1902-goto=/);
});

test('RC1935: Aufgaben, Kundenordner und Dashboard mit Liste plus Seitenfenster, alte Handler bleiben',()=>{
  const frame=fs.readFileSync('assets/rc1930-design-rahmen.js','utf8');
  const dash=fs.readFileSync('assets/rc1558-dashboard-overview.js','utf8');
  // Aufgaben: vorhandenes Detailfenster wird angedockt
  assert.match(css,/#rc1810TaskBoard#rc1810TaskBoard \.rc1810-main\.has-panel\{grid-template-columns:minmax\(0,1fr\) minmax\(340px,400px\)\}/);
  assert.match(css,/#rc1810TaskBoard#rc1810TaskBoard \.rc1810-panel\{position:sticky/);
  // Kundenordner: Liste liest nur die Kundenauswahl und klickt den bestehenden Knopf „Öffnen“
  assert.match(frame,/getElementById\('rc405FolderList'\)/);
  assert.match(frame,/querySelector\('button\[onclick\*="rc405SelectFolder"\]'\)/);
  assert.match(frame,/search\.value=value;\s*if\(btn\)btn\.click\(\)/);
  assert.match(frame,/getAttribute\('data-eh-view'\)==='customerfolder'/);
  assert.doesNotMatch(frame.slice(frame.indexOf('function customers()'),frame.indexOf('function schedule()')),/innerHTML=[^']*\+/,'Kundennamen nie per innerHTML einsetzen');
  assert.match(css,/main\.main\[data-rc1935-customers\]>#rc1935CustomerList\{grid-column:1;grid-row:2;position:sticky/);
  // Dashboard: Kachel öffnet Seitenfenster nur mit Palette auf breiten Bildschirmen, sonst wie bisher RC1569
  assert.match(dash,/if\(sideMode\(\)\)openSide\(k\.getAttribute\('data-rc1558-kpi'\),k\.getAttribute\('data-rc1558-route'\)\);else startDrill\(/);
  assert.match(dash,/hasAttribute\('data-eh-palette'\)&&typeof w\.matchMedia==='function'&&w\.matchMedia\('\(min-width:1180px\)'\)\.matches/);
  assert.match(dash,/\[data-rc1935-all\]'\)\)\{e\.preventDefault\(\);closeSide\(\);startDrill\(kpi,view\);return\}/);
  assert.match(css,/#rc1935DashSide\{\s*position:fixed/);
  assert.match(builder,/rc1930-design-rahmen\.js\?v=1935/);
  assert.match(builder,/rc1930-design-paletten\.css\?v=1935/);
  for(const lang of ['de','en','pl','es','fr','it']){
    const pack=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of ['rc1930.customers','rc1930.filterCustomers','rc1930.noMatch','rc1930.close','rc1930.showInList'])assert.ok(String(pack[key]||'').trim(),lang+' '+key);
  }
});
