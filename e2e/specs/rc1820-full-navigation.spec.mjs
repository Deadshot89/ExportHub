import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const topScript=fs.readFileSync('assets/rc1820-top-navigation.js','utf8');
const topCss=fs.readFileSync('assets/rc1820-top-navigation.css','utf8');
const sectionScript=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
const all=sectionScript.slice(sectionScript.indexOf('var SECTIONS=['),sectionScript.indexOf('\n];',sectionScript.indexOf('var SECTIONS=[')));
const sections=[...all.matchAll(/\{key:'([^']+)'[^}]*?views:\[([^\]]+)\]/g)]
 .map(m=>({key:m[1],views:[...m[2].matchAll(/'([^']+)'/g)].map(v=>v[1])}));
const entries=sections.flatMap(s=>s.views.map(view=>({view,section:s.key})));
const aliases=[
 {view:'packnotification',selected:'packnotifications',section:'start'},
 {view:'shipmentview',selected:'shipmentoverview',section:'shipments'},
 {view:'packagingmasterdata',selected:'packaging',section:'admin'},
 {view:'exams',selected:'academy',section:'knowledge'}
];
const cases=[...entries.map(x=>({...x,selected:['diagnostics','release','update'].includes(x.view)?'it':x.view})),...aliases];
const esc=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function attributes(v){
 if(v==='urgentorders')return 'data-exporthub-urgent-nav="1"';
 if(v==='quality'||v==='it')return null; // Added by the RC1579 runtime
 if(v==='packaging')return 'data-index321-view="packaging" data-view="packaging" data-rc1555-packaging-nav="1"';
 if(v==='documents')return 'data-index321-view="documents" data-exporthub-documents-nav="1"';
 const extra=v==='packnotifications'?'data-pack-notifications-nav="1" ':'';
 return extra+'data-index321-view="'+esc(v)+'" data-view="'+esc(v)+'"';
}
const nav=entries.map(({view})=>{
 const attr=attributes(view);
 return attr===null?'':'<button type="button" '+attr+(view==='shipment'?' class="active" aria-current="page"':'')+
  '><span class="index308-nav-icon" aria-hidden="true"></span><span class="index308-nav-label">'+esc(view)+'</span></button>';
}).join('');
const html='<!doctype html><html lang="de" data-eh-layout="top"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body data-eh-layout="top" data-exporthub-view="shipment">'+
 '<aside class="sidebar"><nav id="nav" class="nav">'+nav+'</nav></aside>'+
 '<main class="main"><div id="content"></div></main></body></html>';

async function boot(page){
 await page.setContent(html);
 await page.evaluate(()=>{
  window.__EXPORTHUB_GET_CURRENT_USER__=()=>({role:'admin',globalAdmin:true,rights:{sop:{read:true}}});
  window.ExportHUBEmbeddedModules={open:()=>true};
  const keys={start:'Start',tasks:'Aufgaben',shipments:'Sendungen',logistics:'Logistik',
   knowledge:'Kunden & Wissen',reports:'Berichte',admin:'Administration',
   toggle:'{name}',quality:'Qualität',it:'IT',itTitle:'IT',packaging:'Verpackungen'};
  window.ExportHUBMenu1579I18n={packs:{de:keys}};
 });
 await page.addStyleTag({content:topCss});
 await page.addScriptTag({content:sectionScript});
 await page.addScriptTag({content:topScript});
 await expect.poll(()=>page.evaluate(()=>Boolean(
  document.querySelector('#nav[data-rc1579-ready]')&&
  document.querySelector('#rc1820TopNav [data-rc1820-section="knowledge"]')&&
  document.querySelector('#nav [data-rc1579-proxy="quality"]')&&
  document.querySelector('#nav [data-rc1579-proxy="it"]')
 )),{timeout:10000}).toBe(true);
}

for(const vp of [
 {name:'desktop',width:1440,height:900},
 {name:'tablet',width:820,height:1180},
 {name:'smartphone',width:390,height:844}
]){
 test('RC1820/RC1579: all 38 menu entries and subviews select correctly on '+vp.name,async({page})=>{
  await page.setViewportSize({width:vp.width,height:vp.height});
  await boot(page);
  const measured=await page.evaluate(async samples=>{
   const result=[];
   for(const sample of samples){
    document.body.setAttribute('data-exporthub-view',sample.view);
    window.ExportHUBMenu1579.refresh();
    window.ExportHUBTopNavigation1820.refresh();
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const root=document.querySelector('#nav'),top=document.querySelector('#rc1820TopNav');
    const activeButtons=[...root.querySelectorAll(':scope>button.active')].map(b=>
     b.getAttribute('data-index321-view')||b.getAttribute('data-view')||
     b.getAttribute('data-rc1579-proxy')||(b.hasAttribute('data-exporthub-urgent-nav')?'urgentorders':'')
    );
    const ariaButtons=[...root.querySelectorAll(':scope>button[aria-current="page"]')].map(b=>
     b.getAttribute('data-index321-view')||b.getAttribute('data-view')||
     b.getAttribute('data-rc1579-proxy')||(b.hasAttribute('data-exporthub-urgent-nav')?'urgentorders':'')
    );
    const group=[...top.querySelectorAll('[data-rc1820-section].is-active')].map(b=>b.getAttribute('data-rc1820-section'));
    const header=[...root.querySelectorAll(':scope>.rc1579-section[data-rc1579-current]')]
     .map(b=>b.getAttribute('data-rc1579-section'));
    const bell=!!top.querySelector('[data-rc1820-bell].is-active');
    const openStart=[...top.querySelectorAll('[data-rc1820-go^="start|"].is-active')].length;
    result.push({...sample,activeButtons,ariaButtons,group,header,bell,openStart});
   }
   return result;
  },cases);
  expect(measured).toHaveLength(42);
  for(const row of measured){
   const hint=vp.name+' · '+row.view+' ('+row.section+')';
   expect(row.activeButtons,hint+' sidebar active').toEqual([row.selected]);
   expect(row.ariaButtons,hint+' aria-current').toEqual([row.selected]);
   expect(row.group,hint+' top section').toEqual(row.section==='start'?[]:[row.section]);
   expect(row.header,hint+' sidebar section').toEqual(row.section==='start'?[]:[row.section]);
   expect(row.bell,hint+' bell').toBe(row.view==='notifications');
   expect(row.openStart,hint+' quick-access pills').toBe(row.section==='start'&&row.view!=='notifications'?1:0);
  }
  if(vp.width>=1024)await expect(page.locator('#rc1820TopNav')).toBeVisible();
  else await expect(page.locator('#rc1820TopNav')).not.toBeVisible();
 });
}

test('RC1820: every desktop mega-menu tab exclusively highlights the opened area',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await boot(page);
 for(const section of sections.filter(s=>s.key!=='start')){
  const tab=page.locator('#rc1820TopNav [data-rc1820-section="'+section.key+'"]');
  await tab.click();
  await expect(tab).toHaveClass(/is-active/);
  await expect(tab).toHaveAttribute('aria-expanded','true');
  const active=await page.locator('#rc1820TopNav [data-rc1820-section].is-active')
   .evaluateAll(list=>list.map(el=>el.getAttribute('data-rc1820-section')));
  expect(active).toEqual([section.key]);
  await tab.click();
  await expect(tab).toHaveAttribute('aria-expanded','false');
 }
});

test('RC1820: rapid navigation keeps menu, active marker, and content synchronized',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await boot(page);
 await page.evaluate(()=>{
  document.querySelector('#nav').addEventListener('click',e=>{
   const b=e.target.closest('button');
   if(!b)return;
   const view=b.getAttribute('data-view')||(b.hasAttribute('data-exporthub-urgent-nav')?'urgentorders':b.getAttribute('data-rc1579-proxy'));
   if(view){document.body.setAttribute('data-exporthub-view',view);document.querySelector('#content').textContent='VIEW:'+view;}
  },true);
 });
 const top=page.locator('#rc1820TopNav');
 await top.locator('[data-rc1820-section="shipments"]').click();
 await expect(top.locator('.rc1820-mega-title')).toContainText('Sendungen');
 await top.locator('[data-rc1820-section="logistics"]').click();
 await expect(top.locator('.rc1820-mega-title')).toContainText('Logistik');
 await top.locator('[data-rc1820-section="shipments"]').click();
 await expect(top.locator('.rc1820-mega-title')).toContainText('Sendungen');
 await top.locator('[data-rc1820-go="sec|shipments:shipmentoverview"]').click();
 await expect(page.locator('#content')).toHaveText('VIEW:shipmentoverview');
 await expect(top.locator('.rc1820-mega')).toBeHidden();
 await top.locator('[data-rc1820-section="tasks"]').click();
 await top.locator('[data-rc1820-go="sec|tasks:taskdetail"]').click();
 await expect(page.locator('#content')).toHaveText('VIEW:taskdetail');
 await top.locator('[data-rc1820-go="start|urgentorders"]').click();
 await expect(page.locator('#content')).toHaveText('VIEW:urgentorders');
 await expect(top.locator('[data-rc1820-go="start|urgentorders"]')).toHaveAttribute('aria-current','page');
 // Dashboard is intentionally represented by the visible ExportHUB home brand in the top layout.
 await top.locator('[data-rc1820-home="1"]').click();
 await expect(page.locator('#content')).toHaveText('VIEW:dashboard');
 await expect(top.locator('[data-rc1820-home="1"]')).toHaveClass(/is-active/);
 await top.locator('[data-rc1820-section="shipments"]').click();
 await expect(top.locator('.rc1820-mega')).toBeVisible();
 await page.evaluate(()=>document.body.setAttribute('data-exporthub-view','urgentorders'));
 await expect(top.locator('.rc1820-mega')).toBeHidden();
 await expect(top.locator('[data-rc1820-go="start|urgentorders"]')).toHaveAttribute('aria-current','page');
});
