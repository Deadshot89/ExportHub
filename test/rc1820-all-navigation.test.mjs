import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const top=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
const sidebar=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const between=(source,start,end)=>{
 const i=source.indexOf(start),j=source.indexOf(end,i);
 assert.ok(i>=0&&j>i,'Navigationsfunktion fehlt: '+start);
 return source.slice(i,j);
};
const sectionSource=between(sidebar,'var SECTIONS=[','\n];');
const sections=[...sectionSource.matchAll(/\{key:'([^']+)'[^}]*?views:\[([^\]]+)\]/g)]
 .map(m=>({key:m[1],views:[...m[2].matchAll(/'([^']+)'/g)].map(v=>v[1])}));
const views=sections.flatMap(s=>s.views);
const topFunctions=[
 between(top,' function viewOf(el){','\n function orderOf('),
 between(top,' function allowed(el){','\n // Genau ein aktiver Punkt:'),
 between(top,' function menuView(view){','\n function isActive(')
].join('\n');
const sideFunctions=[
 between(sidebar,'function viewOf(el){','\nfunction shown('),
 between(sidebar,'function itemSel(v){','\nfunction ensureStyle('),
 between(sidebar,'function currentView(){','\nfunction lastItTab('),
 between(sidebar,'function menuView(view){','\nfunction sync(){')
].join('\n');
const aliases={
 diagnostics:'it',release:'it',update:'it',
 packnotification:'packnotifications',shipmentview:'shipmentoverview',
 packagingmasterdata:'packaging',exams:'academy'
};
const expectedView=v=>aliases[v]||v;
function navAttrs(v){
 if(v==='packnotifications')return {'data-pack-notifications-nav':'','data-index321-view':v,'data-view':v};
 if(v==='urgentorders')return {'data-exporthub-urgent-nav':''};
 if(['quality','it','packaging'].includes(v))return {'data-rc1579-proxy':v};
 if(v==='documents')return {'data-exporthub-documents-nav':'','data-index321-view':'documents'};
 return {'data-index321-view':v,'data-view':v};
}
function makeButton(v,stale,hidden){
 const attrs=navAttrs(v);
 return {tagName:'BUTTON',view:v,attrs,hidden:hidden===v,
  style:{display:['diagnostics','release','update'].includes(v)?'none':''},
  classList:{contains:name=>name==='active'&&stale===v},
  getAttribute(name){return this.attrs[name]??null;},
  hasAttribute(name){return Object.hasOwn(this.attrs,name);}
 };
}
function selected(view,{stale='shipment',hidden=''}={}){
 const buttons=views.map(v=>makeButton(v,stale,hidden));
 const find=v=>buttons.find(b=>b.view===v)||null;
 const nav={children:buttons,querySelector(selector){
  if(selector.includes('button.active[data-index321-view]'))return find(stale);
  if(selector.includes('data-exporthub-urgent-nav'))return find('urgentorders');
  if(selector.includes('data-exporthub-documents-nav'))return find('documents');
  let m=selector.match(/data-rc1579-proxy="([^"]+)"/);
  if(m)return find(m[1]);
  m=selector.match(/data-(?:index321-view|view)="([^"]+)"/);
  return m?find(m[1]):null;
 }};
 const d={body:{getAttribute:key=>key==='data-exporthub-view'?view:null}};
 const context={d,nav,n:nav,
  clean:s=>String(s??'').replace(/\s+/g,' ').trim(),
  q:s=>String(s??'').replace(/\s+/g,' ').trim(),
  shown:el=>!!el&&!el.hidden&&el.style.display!=='none'};
 const upper=vm.runInNewContext(topFunctions+'\nviewOf(findActive(n))',context,{timeout:1000});
 const side=vm.runInNewContext(sideFunctions+'\nactiveView()',context,{timeout:1000});
 return {upper,side};
}

test('RC1820/RC1579: all 38 entries belong to precisely seven menu areas',()=>{
 assert.equal(sections.length,7);
 assert.equal(views.length,38);
 assert.equal(new Set(views).size,38);
 assert.deepEqual(sections.map(s=>s.key),[
  'start','tasks','shipments','logistics','knowledge','reports','admin'
 ]);
});

for(const section of sections){
 for(const view of section.views){
  test('RC1820/RC1579: '+section.key+' / '+view+' selects its own entry despite stale Sendung',()=>{
   const actual=selected(view),expected=expectedView(view);
   assert.equal(actual.upper,expected,'top navigation: '+view);
   assert.equal(actual.side,expected,'sidebar/mobile navigation: '+view);
  });
 }
}
for(const [detail,parent] of Object.entries(aliases)){
 if(views.includes(detail))continue;
 test('RC1820/RC1579: detail '+detail+' selects '+parent,()=>{
  assert.deepEqual(selected(detail),{upper:parent,side:parent});
 });
}

test('RC1820: hidden/forbidden destination is never highlighted',()=>{
 const {upper,side}=selected('customers',{hidden:'customers'});
 assert.notEqual(upper,'customers');
 assert.notEqual(side,'customers');
});
test('RC1820/RC1579: both menus observe the actual rendered view',()=>{
 assert.match(top,/attributeFilter:\['data-exporthub-view'\]/);
 assert.match(sidebar,/function watchView\(\)/);
 assert.match(sidebar,/attributeFilter:\['data-exporthub-view'\]/);
});
test('RC1820: embedded links and packaging use their real proxy IDs',()=>{
 assert.match(top,/data-rc1579-proxy/);
 assert.match(sidebar,/data-exporthub-urgent-nav/);
 assert.match(sidebar,/data-rc1579-proxy/);
});

const renderSource=between(top,' function render(force){','\n function schedule(){');
function renderedPills(active,openKey){
 const items=sections.filter(s=>s.key!=='start').map(s=>({
  key:s.key,label:s.key,el:{name:s.key},
  items:s.views.map(v=>({el:{view:v,name:v},order:301}))
 }));
 // In the real top bar notifications live in the separate bell, not in a regular pill.
 const start=sections.find(s=>s.key==='start').views.filter(v=>v!=='notifications').map(v=>({el:{view:v,name:v},order:101}));
 const notifications={view:'notifications',name:'Benachrichtigungen',getAttribute:()=>null};
 const brand={classList:{toggle(_name,value){brand.active=value}},setAttribute(){}};
 const pills={innerHTML:'',setAttribute(){}},mega={innerHTML:'',hidden:true};
 const bell={hidden:true,classList:{toggle(_name,value){bell.active=value}},
  querySelector:()=>({hidden:true,textContent:''}),setAttribute(){}};
 const m={start,sections:items,notifications,shipment:null};
 const context={w:{__EXPORTHUB_WARNING_SUMMARY__:{total:0}},scheduled:true,openKey,lastSig:'',current:null,
  bar:{hidden:false,querySelector:()=>brand},pills,mega,bell,cta:{hidden:true},
  on:()=>true,ensureBar:()=>true,model:()=>m,
  sigOf:()=>openKey||'closed',viewOf:el=>el.view||'',labelOf:el=>el.name||'',
  isActive:el=>el.view===active,iconVars:()=>'',esc:String,tx:String};
 vm.runInNewContext(renderSource+'\nrender(true)',context,{timeout:1000});
 const tabs=[...pills.innerHTML.matchAll(/<button\b[^>]*class="([^"]*)"[^>]*data-rc1820-section="([^"]*)"/g)]
  .map(m=>({area:m[2],active:m[1].split(/\s+/).includes('is-active')}));
 const startPills=[...pills.innerHTML.matchAll(/<button\b[^>]*class="([^"]*)"[^>]*data-rc1820-go="start\|([^"]+)"/g)]
  .map(m=>({view:m[2],active:m[1].split(/\s+/).includes('is-active')}));
 return {tabs,startPills,brand:brand.active,bell:bell.active};
}
for(const section of sections.filter(s=>s.key!=='start')){
 test('RC1820: opening '+section.key+' exclusively highlights it, not stale Sendung',()=>{
  const result=renderedPills('shipment',section.key);
  assert.equal(result.tabs.filter(t=>t.active).map(t=>t.area).join(','),section.key);
  assert.equal(result.startPills.filter(t=>t.active).length,0);
  assert.equal(result.brand,false);
 });
 test('RC1820: closed menu highlights current '+section.key+' section',()=>{
  const result=renderedPills(section.views[0],'');
  assert.equal(result.tabs.filter(t=>t.active).map(t=>t.area).join(','),section.key);
 });
}
for(const view of sections.find(s=>s.key==='start').views){
 test('RC1820: start entry '+view+' has exclusive active styling',()=>{
  const result=renderedPills(view,'');
  assert.equal(result.tabs.filter(t=>t.active).length,0);
  assert.equal(result.startPills.filter(t=>t.active).map(t=>t.view).join(','),
   view==='notifications'?'':view);
  assert.equal(result.bell,view==='notifications','notification indicator only for its own view');
 });
}

test('RC1820/RC1579: both navigation runtimes use fresh build asset versions',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/rc1820-top-navigation\.js\?v=20261112p0/);
 assert.match(build,/rc1579-menu-redesign\.js\?v=20261112/);
 assert.doesNotMatch(build,/rc1579-menu-redesign\.js\?v=1630/);
});

const selectionSource=between(sidebar,'function syncSelection(){','\nfunction sync(){');
function syncedButtons(view,{hidden=''}={}){
 const buttons=views.map(v=>{
  const attrs=navAttrs(v),classes=new Set(v==='shipment'?['active']:[]);
  return {view:v,tagName:'BUTTON',attrs,hidden:v===hidden,style:{display:''},
   classList:{contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},
   getAttribute(name){return this.attrs[name]??null;},
   hasAttribute(name){return Object.hasOwn(this.attrs,name);},
   setAttribute(name,value){this.attrs[name]=String(value);},
   removeAttribute(name){delete this.attrs[name];}
  };
 });
 const find=v=>buttons.find(b=>b.view===v)||null;
 const nav={querySelector(selector){
  if(selector.includes('data-exporthub-urgent-nav'))return find('urgentorders');
  if(selector.includes('data-exporthub-documents-nav'))return find('documents');
  let m=selector.match(/data-rc1579-proxy="([^"]+)"/);
  if(m)return find(m[1]);
  m=selector.match(/data-(?:index321-view|view)="([^"]+)"/);
  return m?find(m[1]):null;
 },querySelectorAll(selector){assert.equal(selector,':scope>button');return buttons;}};
 const d={body:{getAttribute:key=>key==='data-exporthub-view'?view:null}};
 const SECTION_OF=Object.fromEntries(sections.flatMap(s=>s.views.map(v=>[v,s.key])));
 const context={d,nav,SECTION_OF,q:x=>String(x??'').trim(),
  setAttr(el,name,value){if(el.getAttribute(name)!==String(value))el.setAttribute(name,value);}};
 vm.runInNewContext(sideFunctions+'\n'+selectionSource+'\nsyncSelection()',context,{timeout:1000});
 return {
  active:buttons.filter(b=>b.classList.contains('active')).map(b=>b.view),
  current:buttons.filter(b=>b.getAttribute('aria-current')==='page').map(b=>b.view),
  packBadge:find('packnotifications').classList.contains('is-active')
 };
}
for(const section of sections){
 for(const view of section.views){
  test('RC1579 sidebar: '+view+' visually replaces stale Sendung selection',()=>{
   const expected=expectedView(view),actual=syncedButtons(view);
   assert.deepEqual(actual.active,[expected],'visible active class');
   assert.deepEqual(actual.current,[expected],'aria-current page');
   assert.equal(actual.packBadge,expected==='packnotifications');
  });
 }
}
test('RC1579 sidebar: a forbidden destination never becomes selected',()=>{
 const result=syncedButtons('customers',{hidden:'customers'});
 assert.ok(!result.active.includes('customers'));
 assert.ok(!result.current.includes('customers'));
});
