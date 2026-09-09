import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const BASE=process.env.RC1014_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve('artifacts/rc1014-browser');
fs.mkdirSync(OUT,{recursive:true});

const viewports=[
  {name:'desktop',width:1440,height:1000},
  {name:'tablet',width:900,height:1100},
  {name:'smartphone',width:390,height:844}
];
const views=[
  {name:'tasks',label:'Aufgaben',expected:'tasks'},
  {name:'shipmentoverview',label:'Sendungsübersicht',expected:'shipmentoverview'},
  {name:'pickupcalendar',label:'Abholkalender',expected:'pickupcalendar'}
];

function assert(condition,message){if(!condition)throw new Error(message);}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function navigationDiagnostics(page){
  return page.evaluate(()=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const controls=[...document.querySelectorAll('button,a,[role="button"],[data-view],[data-route]')]
      .filter(visible)
      .slice(0,80)
      .map(el=>({tag:el.tagName,text:(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),dataView:el.getAttribute('data-view'),dataRoute:el.getAttribute('data-route')}));
    return {
      bodyView:document.body?.getAttribute('data-exporthub-view')||'',
      bodyText:(document.body?.innerText||'').replace(/\s+/g,' ').trim().slice(0,2500),
      controls
    };
  });
}

async function clickView(page,view,viewportName){
  const candidates=[
    page.getByRole('button',{name:view.label,exact:true}),
    page.getByRole('link',{name:view.label,exact:true}),
    page.getByText(view.label,{exact:true})
  ];
  let clicked=false;
  for(const locator of candidates){
    const count=await locator.count();
    if(!count)continue;
    for(let i=count-1;i>=0;i--){
      const item=locator.nth(i);
      if(await item.isVisible().catch(()=>false)){
        await item.click({timeout:5000});
        clicked=true;
        break;
      }
    }
    if(clicked)break;
  }
  if(!clicked){
    const diagnostic=await navigationDiagnostics(page);
    const screenshot=path.join(OUT,`${viewportName}-navigation-failure.png`);
    await page.screenshot({path:screenshot,fullPage:true});
    throw new Error(`Navigationseintrag fehlt oder ist nicht klickbar: ${view.label}\nBrowserzustand: ${JSON.stringify(diagnostic)}`);
  }
  await page.waitForFunction(expected=>document.body?.getAttribute('data-exporthub-view')===expected,view.expected,{timeout:10000});
  await pause(250);
}

async function assertNoOverflow(page,viewportName,viewName){
  const result=await page.evaluate(()=>{
    const doc=document.documentElement;
    const body=document.body;
    const viewport=window.innerWidth;
    const horizontal=Math.max(doc.scrollWidth,body?.scrollWidth||0)-viewport;
    const visible=[...document.querySelectorAll('button,a,input,select,textarea,.card,.rc229-task-card,.rc485-overview-card')]
      .filter(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
      })
      .map(el=>{
        const r=el.getBoundingClientRect();
        return {tag:el.tagName,text:(el.textContent||'').trim().slice(0,80),left:r.left,right:r.right,width:r.width};
      })
      .filter(x=>x.right>viewport+3||x.left<-3);
    return {horizontal,visible};
  });
  assert(result.horizontal<=3,`${viewportName}/${viewName}: horizontaler Overflow ${result.horizontal}px`);
  assert(result.visible.length===0,`${viewportName}/${viewName}: sichtbare Elemente außerhalb des Viewports: ${JSON.stringify(result.visible.slice(0,5))}`);
}

async function assertTasks(page){
  const cards=page.locator('.rc229-task-card.rc628-unified-task');
  assert(await cards.count()>0,'Aufgabenansicht enthält keine Aufgabenkarten.');
  const enhanced=page.locator('.rc229-task-card.rc628-unified-task [data-rc1014-open-task]');
  assert(await enhanced.count()>0,'RC1014 Öffnen-Aktion fehlt in Aufgabenkarten.');
  const text=await page.locator('body').innerText();
  for(const expected of ['Priorität','Fällig:','Verantwortlich:'])assert(text.includes(expected),`Aufgaben-Metadatum fehlt: ${expected}`);
}

async function assertShipmentOverview(page){
  await page.waitForFunction(()=>document.querySelectorAll('[data-rc1014-shipment-meta]').length>=3,{timeout:10000});
  const rows=page.locator('[data-rc1014-shipment-meta]');
  assert(await rows.count()>=3,'Sendungsübersicht zeigt nicht für jede Demo-Sendung RC1014-Metadaten.');
  const body=await page.locator('body').innerText();
  for(const expected of ['DEMO01','DEMO02','DEMO03','Erfasst:','Colli: 2','Colli: 6','Colli: 4']){
    assert(body.includes(expected),`Sendungsübersicht fehlt: ${expected}`);
  }
}

async function assertCalendar(page){
  const body=await page.locator('body').innerText();
  assert(body.includes('Abholkalender'),'Abholkalender-Ansicht wurde nicht aufgebaut.');
  assert(!/Samstag|Sonntag/.test(body),'Abholkalender zeigt unerwartet reguläre Wochenendtage.');
  const fixed=page.locator('.pickup-item-fix');
  assert(await fixed.count()>0,'Abholkalender zeigt keine sichtbaren FIX-Abholungen.');
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
    page.on('console',msg=>{
      if(msg.type()!=='error')return;
      const text=msg.text();
      if(/favicon\.ico/i.test(text))return;
      runtimeErrors.push(`console: ${text}`);
    });
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.body&&document.body.innerText.length>100,{timeout:15000});
    await page.waitForFunction(()=>{
      const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
      return [...document.querySelectorAll('button,a,[role="button"],[data-view],[data-route]')]
        .some(el=>visible(el)&&(el.textContent||'').replace(/\s+/g,' ').trim()==='Aufgaben');
    },{timeout:15000});
    await pause(250);

    const viewportReport={name:vp.name,width:vp.width,height:vp.height,views:[]};
    for(const view of views){
      await clickView(page,view,vp.name);
      if(view.name==='tasks')await assertTasks(page);
      if(view.name==='shipmentoverview')await assertShipmentOverview(page);
      if(view.name==='pickupcalendar')await assertCalendar(page);
      await assertNoOverflow(page,vp.name,view.name);
      const screenshot=path.join(OUT,`${vp.name}-${view.name}.png`);
      await page.screenshot({path:screenshot,fullPage:true});
      viewportReport.views.push({name:view.name,screenshot:path.relative(process.cwd(),screenshot)});
    }
    assert(runtimeErrors.length===0,`${vp.name}: Browser-/Console-Fehler: ${runtimeErrors.join(' | ')}`);
    report.viewports.push(viewportReport);
    await context.close();
  }
} catch(error){
  report.errors.push(String(error&&error.stack||error));
  throw error;
} finally {
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(`RC1014 Chromium-Test erfolgreich: ${viewports.length} Viewports × ${views.length} Ansichten, 0 Browserfehler.`);
