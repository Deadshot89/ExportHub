import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const BASE=process.env.RC1016_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve('artifacts/rc1016-browser');
fs.mkdirSync(OUT,{recursive:true});
const viewports=[{name:'desktop',width:1440,height:1000},{name:'tablet',width:900,height:1100},{name:'smartphone',width:390,height:844}];
const views=[{name:'tasks',label:'Aufgaben',expected:'tasks'},{name:'shipmentoverview',label:'Sendungsübersicht',expected:'shipmentoverview'},{name:'pickupcalendar',label:'Abholkalender',expected:'pickupcalendar'}];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(condition,message){if(!condition)throw new Error(message);}

async function waitReady(page){
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true&&document.body?.innerText.includes('Aufgaben'),null,{timeout:15000});
}
async function clickView(page,view){
  const candidates=[page.getByRole('button',{name:view.label,exact:true}),page.getByRole('link',{name:view.label,exact:true}),page.getByText(view.label,{exact:true})];
  for(const locator of candidates){
    const count=await locator.count();
    for(let i=count-1;i>=0;i--){const item=locator.nth(i);if(await item.isVisible().catch(()=>false)){await item.click();await page.waitForFunction(expected=>document.body?.getAttribute('data-exporthub-view')===expected,view.expected,{timeout:10000});await pause(250);return;}}
  }
  throw new Error(`Navigationseintrag fehlt: ${view.label}`);
}
async function assertNoOverflow(page,label){
  const result=await page.evaluate(()=>({viewport:innerWidth,scroll:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0)}));
  assert(result.scroll<=result.viewport+3,`${label}: horizontaler Overflow ${result.scroll-result.viewport}px`);
}
async function openFirstTaskGroup(page){
  const groups=page.locator('details.task-area-details');
  const count=await groups.count();
  assert(count>0,'Aufgabenansicht enthält keine Aufgabengruppen.');
  for(let i=0;i<count;i++){
    const group=groups.nth(i);
    if(!await group.isVisible().catch(()=>false))continue;
    const summary=group.locator('summary').first();
    if(!await group.getAttribute('open'))await summary.click();
    await pause(180);
    if(await group.locator('.rc229-task-card.rc628-unified-task, .task-card').count()>0)return group;
    if(await group.getAttribute('open'))await summary.click().catch(()=>{});
  }
  throw new Error('Keine belegte Aufgabengruppe ließ sich öffnen.');
}
async function assertTasks(page){
  const totalText=await page.locator('body').innerText();
  assert(/ALLE OFFENEN AUFGABEN\s*\d+/i.test(totalText),'Aufgaben-Gesamtzähler fehlt.');
  const group=await openFirstTaskGroup(page);
  const cards=group.locator('.rc229-task-card.rc628-unified-task, .task-card');
  assert(await cards.count()>0,'Geöffnete Aufgabengruppe enthält keine Aufgabenkarten.');
  await page.waitForFunction(()=>document.querySelectorAll('[data-rc1014-enhanced="1"] [data-rc1014-open-task]').length>0,null,{timeout:5000});
  const text=await group.innerText();
  for(const expected of ['Priorität','Fällig:','Verantwortlich:'])assert(text.includes(expected),`Aufgaben-Metadatum fehlt: ${expected}`);
}
async function shipmentOverviewDiagnostics(page){
  return page.evaluate(()=>{
    const state=(()=>{try{return typeof window.__EXPORTHUB_GET_STATE__==='function'?(window.__EXPORTHUB_GET_STATE__()||{}):((window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state)||window.state||{});}catch(_){return{};}})();
    const shipmentSummary=(Array.isArray(state.shipments)?state.shipments:[]).slice(0,12).map(sh=>({id:sh&&sh.id,ref:sh&&sh.ref,reference:sh&&sh.reference,status:sh&&sh.status,customerName:sh&&sh.customerName,rows:Array.isArray(sh&&sh.rows)?sh.rows.length:null}));
    const cards=[...document.querySelectorAll('[data-rc1014-shipment-enhanced="1"]')].slice(0,20).map(card=>({
      tag:card.tagName,
      className:String(card.className||''),
      dataset:Object.fromEntries(Object.entries(card.dataset||{})),
      text:String(card.innerText||card.textContent||'').replace(/\s+/g,' ').trim().slice(0,900),
      html:String(card.outerHTML||'').slice(0,3500)
    }));
    const meta=[...document.querySelectorAll('[data-rc1014-shipment-meta]')].slice(0,20).map(node=>({text:String(node.innerText||node.textContent||'').replace(/\s+/g,' ').trim(),parentText:String(node.parentElement?.innerText||'').replace(/\s+/g,' ').trim().slice(0,900)}));
    return {view:document.body?.getAttribute('data-exporthub-view')||'',bodyText:String(document.body?.innerText||'').replace(/\s+/g,' ').trim().slice(0,8000),stateShipments:shipmentSummary,cards,meta};
  });
}
async function assertShipmentOverview(page,viewportName){
  await page.waitForFunction(()=>document.querySelectorAll('[data-rc1014-shipment-meta]').length>=3,null,{timeout:10000});
  const body=await page.locator('body').innerText();
  const expectedValues=['DEMO01','DEMO02','DEMO03','Erfasst:','Colli: 2','Colli: 6','Colli: 4'];
  const missing=expectedValues.filter(expected=>!body.includes(expected));
  if(missing.length){
    const diagnostic=await shipmentOverviewDiagnostics(page);
    fs.writeFileSync(path.join(OUT,`${viewportName}-shipmentoverview-diagnostic.json`),JSON.stringify(diagnostic,null,2)+'\n');
    await page.screenshot({path:path.join(OUT,`${viewportName}-shipmentoverview-failure.png`),fullPage:true});
    throw new Error(`Sendungsübersicht fehlt: ${missing.join(', ')}. Diagnose wurde gesichert.`);
  }
}
async function assertCalendar(page){
  const body=await page.locator('body').innerText();
  assert(body.includes('Abholkalender'),'Abholkalender wurde nicht aufgebaut.');
  assert(!/Samstag|Sonntag/.test(body),'Abholkalender zeigt reguläre Wochenendtage.');
  assert(await page.locator('.pickup-item-fix').count()>0,'Abholkalender zeigt keine sichtbaren FIX-Abholungen.');
  assert(body.includes('Fake Fix'),'Demo-Abholkalender lädt seine lokalen FIX-Daten nicht.');
}

const browser=await chromium.launch({headless:true});
const report={base:BASE,generatedAt:new Date().toISOString(),viewports:[],errors:[]};
try{
  for(const vp of viewports){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
    const page=await context.newPage();
    const runtimeErrors=[];
    page.on('pageerror',error=>runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console',msg=>{if(msg.type()==='error'&&!/favicon\.ico/i.test(msg.text()))runtimeErrors.push(`console: ${msg.text()}`);});
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await waitReady(page);
    const viewportReport={name:vp.name,width:vp.width,height:vp.height,views:[]};
    for(const view of views){
      await clickView(page,view);
      if(view.name==='tasks')await assertTasks(page);
      if(view.name==='shipmentoverview')await assertShipmentOverview(page,vp.name);
      if(view.name==='pickupcalendar')await assertCalendar(page);
      await assertNoOverflow(page,`${vp.name}/${view.name}`);
      const screenshot=path.join(OUT,`${vp.name}-${view.name}.png`);
      await page.screenshot({path:screenshot,fullPage:true});
      viewportReport.views.push({name:view.name,screenshot:path.relative(process.cwd(),screenshot)});
    }
    assert(runtimeErrors.length===0,`${vp.name}: Browser-/Console-Fehler: ${runtimeErrors.join(' | ')}`);
    report.viewports.push(viewportReport);
    await context.close();
  }
} catch(error){report.errors.push(String(error&&error.stack||error));throw error;}
finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(`RC1016 Chromium-Test erfolgreich: ${viewports.length} Viewports × ${views.length} Ansichten, 0 Browserfehler.`);
