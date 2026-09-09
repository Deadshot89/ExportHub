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
async function navigationDiagnostics(page){
  return page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)};};
    const describe=el=>({
      tag:el.tagName,
      text:String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,180),
      title:el.getAttribute('title'),ariaLabel:el.getAttribute('aria-label'),ariaHidden:el.getAttribute('aria-hidden'),
      className:String(el.className||''),id:el.id||'',dataset:Object.fromEntries(Object.entries(el.dataset||{})),
      display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity,
      rect:rect(el)
    });
    const nav=[...document.querySelectorAll('button,a,[role="button"]')].filter(el=>{
      const hay=`${el.innerText||''} ${el.getAttribute('title')||''} ${el.getAttribute('aria-label')||''} ${el.className||''} ${el.id||''}`;
      return /Aufgaben|Sendungsübersicht|Abholkalender|menü|menu|navigation|nav|sidebar/i.test(hay);
    }).slice(0,80).map(describe);
    return {innerWidth,innerHeight,scrollX,scrollY,bodyView:document.body?.getAttribute('data-exporthub-view')||'',nav};
  });
}
async function clickView(page,view,viewportName){
  const candidates=[page.getByRole('button',{name:view.label,exact:true}),page.getByRole('link',{name:view.label,exact:true}),page.getByText(view.label,{exact:true})];
  for(const locator of candidates){
    const count=await locator.count();
    for(let i=count-1;i>=0;i--){
      const item=locator.nth(i);
      if(!await item.isVisible().catch(()=>false))continue;
      const box=await item.boundingBox().catch(()=>null);
      const viewport=page.viewportSize();
      if(!box||!viewport||box.x+box.width<=0||box.y+box.height<=0||box.x>=viewport.width||box.y>=viewport.height)continue;
      await item.click({timeout:5000});
      await page.waitForFunction(expected=>document.body?.getAttribute('data-exporthub-view')===expected,view.expected,{timeout:10000});
      await pause(250);
      return;
    }
  }
  const diagnostic=await navigationDiagnostics(page);
  fs.writeFileSync(path.join(OUT,`${viewportName}-navigation-diagnostic.json`),JSON.stringify(diagnostic,null,2)+'\n');
  await page.screenshot({path:path.join(OUT,`${viewportName}-navigation-failure.png`),fullPage:true});
  throw new Error(`Navigationseintrag ${view.label} ist in ${viewportName} nicht direkt bedienbar. Diagnose wurde gesichert.`);
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
async function assertShipmentOverview(page){
  await page.waitForFunction(()=>document.querySelectorAll('[data-rc1014-shipment-enhanced="1"]').length>=3,null,{timeout:10000});
  const cards=page.locator('[data-rc1014-shipment-enhanced="1"]');
  assert(await cards.count()===3,`Sendungsübersicht erwartet 3 Demo-Sendungen, gefunden ${await cards.count()}.`);
  const cardText=(await cards.allTextContents()).join(' ').replace(/\s+/g,' ');
  for(const expected of ['DEMO01','DEMO02','DEMO03','Erfasst:','Colli: 2','Colli: 6','Colli: 4'])assert(cardText.includes(expected),`Sendungsübersicht fehlt in den tatsächlichen Sendungskarten: ${expected}`);
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
    page.on('response',response=>{
      const status=response.status();
      const url=response.url();
      if(status>=400&&!/favicon\.ico(?:$|\?)/i.test(url))runtimeErrors.push(`http ${status}: ${url}`);
    });
    page.on('requestfailed',request=>{
      const url=request.url();
      if(!/favicon\.ico(?:$|\?)/i.test(url))runtimeErrors.push(`requestfailed: ${url} :: ${request.failure()?.errorText||'unbekannt'}`);
    });
    page.on('console',msg=>{
      if(msg.type()!=='error')return;
      const text=msg.text();
      if(/favicon\.ico/i.test(text)||/Failed to load resource:/i.test(text))return;
      runtimeErrors.push(`console: ${text}`);
    });
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await waitReady(page);
    const viewportReport={name:vp.name,width:vp.width,height:vp.height,views:[]};
    for(const view of views){
      await clickView(page,view,vp.name);
      if(view.name==='tasks')await assertTasks(page);
      if(view.name==='shipmentoverview')await assertShipmentOverview(page);
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
