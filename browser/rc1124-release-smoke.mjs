import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE=process.env.EXPORTHUB_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve('artifacts/rc1124-browser-release');
fs.mkdirSync(OUT,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const viewports=[
  {name:'desktop',width:1440,height:900},
  {name:'tablet',width:900,height:1100},
  {name:'smartphone',width:390,height:844}
];
const views=[
  {view:'dashboard',label:'Dashboard',match:/Dashboard/i},
  {view:'planning',label:'Aufgaben Planer',match:/Aufgaben|Planer/i},
  {view:'tasks',label:'Aufgaben',match:/Aufgaben/i},
  {view:'notifications',label:'Benachrichtigungen',match:/Benachrichtigungen/i},
  {view:'pickupcalendar',label:'Abholkalender',match:/Abholkalender/i},
  {view:'shipment',label:'Sendung erstellen',match:/Kunde|Empfänger/i},
  {view:'shipmentoverview',label:'Sendungsübersicht',match:/Sendung/i},
  {view:'customerfolder',label:'Kundenordner',match:/Kunden/i},
  {view:'pallet',label:'Palettenkonto',match:/Palette/i},
  {view:'shippingcosts',label:'Versandkosten',match:/Versand|UPS|Maut|Route/i},
  {view:'sop',label:'SOP & Portale',match:/SOP/i},
  {view:'academy',label:'Academy',match:/Academy|Prüfung/i},
  {view:'diagnostics',label:'Fehlerdiagnose',match:/Diagnose|Fehler/i}
];

function assert(ok,msg){if(!ok)throw new Error(msg)}
async function waitReady(page){
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true&&document.body,null,{timeout:25000});
  await pause(250);
}
async function visible(locator){
  const n=await locator.count();
  for(let i=n-1;i>=0;i--){const x=locator.nth(i);if(await x.isVisible().catch(()=>false))return x}
  return null;
}
async function openMenu(page){
  for(const selector of ['#rc1016MobileMenuBtn','#ehMenuBtn']){
    const b=page.locator(selector).first();
    if(await b.count()&&await b.isVisible().catch(()=>false)){await b.click({timeout:5000}).catch(()=>{});await pause(180);return true}
  }
  return false;
}
async function navItem(page,label){
  for(const loc of [
    page.getByRole('button',{name:label,exact:true}),
    page.getByRole('link',{name:label,exact:true}),
    page.getByText(label,{exact:true})
  ]){
    const x=await visible(loc);if(x)return x;
  }
  return null;
}
async function clickNav(page,item){
  let x=await navItem(page,item.label);
  if(!x){await openMenu(page);x=await navItem(page,item.label)}
  assert(x,'Navigation fehlt: '+item.label);
  await x.click({timeout:7000});
  await page.waitForFunction(v=>{
    const body=document.body?.getAttribute('data-exporthub-view')||'';
    const root=document.getElementById('content')?.getAttribute('data-exporthub-rendered-view')||'';
    let state='';try{state=window.__EXPORTHUB_GET_STATE__?.()?.view||window.state?.view||''}catch(_){}
    return body===v||root===v||state===v;
  },item.view,{timeout:12000});
  await pause(280);
}
async function noBodyOverflow(page,label){
  const m=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body?.scrollWidth||0}));
  const actual=Math.max(m.doc,m.body);
  assert(actual<=m.viewport+4,label+': horizontaler Seitenüberlauf '+(actual-m.viewport)+'px');
}
async function noSourceLeak(page,label){
  const leak=await page.evaluate(()=>{
    const text=document.body?.innerText||'';
    const patterns=[
      /window\.open\(['"]about:blank/i,
      /function\s+normalizeActionButtons\s*\(/i,
      /function\s+activateQr\s*\(/i,
      /RC824_SOP_DETAILS/,
      /window\.rc524OpenTaskEditor\s*=/,
      /exporthub-rc898-dashboard-only-compact-shipment-inline-avis/i,
      /'\+E\([^\n]{0,120}\)\+'/,
      /var\s+rightsModules\s*=/
    ];
    const hit=patterns.find(rx=>rx.test(text));
    return hit?String(hit):'';
  });
  assert(!leak,label+': sichtbarer JavaScript-/Template-Code erkannt: '+leak);
}
async function assertView(page,item){
  const body=await page.locator('body').innerText();
  assert(item.match.test(body),item.label+': erwarteter Inhalt fehlt');

  if(item.view==='shipment'){
    const shell=page.locator('#rc363FixedShipmentLayout,#rc573ShipmentShell');
    assert(await shell.count()>0,'Sendung erstellen: Sendungsformular fehlt');
    const text=await page.locator('#content').innerText();
    assert(/Kunde|Empfänger/i.test(text),'Sendung erstellen: Kunde/Empfänger fehlt');
    assert(/Colli|Lademeter/i.test(text),'Sendung erstellen: Colli/Lademeter fehlt');
    const historyOnly=/^\s*Sendungshistorie/i.test(text)&&!/Kunde|Empfänger/i.test(text);
    assert(!historyOnly,'Sendung erstellen zeigt nur die Sendungshistorie');
  }

  if(item.view==='notifications'){
    const center=page.locator('#index236NotificationCenter');
    assert(await center.count()===1,'Benachrichtigungen: Center fehlt oder ist doppelt');
    const bad=await center.locator('.index236-item h3').evaluateAll(nodes=>nodes.map(n=>(n.textContent||'').trim()).filter(t=>/^(Aufgabe|Task)$/i.test(t)));
    assert(bad.length===0,'Benachrichtigungen: '+bad.length+' Platzhalter-Aufgaben sichtbar');
    const metric=await center.locator('.index236-metric strong').first().textContent().catch(()=>null);
    if(metric!=null)assert(Number(String(metric).replace(/\D/g,''))<200,'Benachrichtigungen: unplausibel hoher Aufgaben-Zähler >= 200');
  }

  if(item.view==='sop'){
    const text=await page.locator('#content').innerText();
    assert(!/\{"purpose":\s*"Eine Sendung/i.test(text),'SOP: JSON wird als sichtbarer Text gerendert');
  }
}
async function screenshot(page,name){
  const p=path.join(OUT,name);
  await page.screenshot({path:p,fullPage:true});
  assert(fs.statSync(p).size>8000,name+': Screenshot unplausibel klein');
}

const browser=await chromium.launch({headless:true});
const report={base:BASE,generatedAt:new Date().toISOString(),viewports:[],failures:[]};
try{
  for(const vp of viewports){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
    const page=await context.newPage();
    const runtime=[];
    page.on('pageerror',e=>runtime.push('pageerror: '+e.message));
    page.on('console',m=>{if(m.type()==='error'&&!/favicon\.ico|Failed to load resource/i.test(m.text()))runtime.push('console: '+m.text())});
    page.on('requestfailed',r=>{if(!/favicon\.ico/i.test(r.url()))runtime.push('requestfailed: '+r.url()+' '+(r.failure()?.errorText||''))});
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:35000});
    await waitReady(page);
    if(vp.name==='smartphone')await page.waitForSelector('#rc1016MobileMenuBtn',{state:'visible',timeout:7000});

    const row={name:vp.name,width:vp.width,height:vp.height,views:[]};
    for(const item of views){
      await clickNav(page,item);
      await assertView(page,item);
      await noSourceLeak(page,vp.name+'/'+item.view);
      await noBodyOverflow(page,vp.name+'/'+item.view);
      const file=vp.name+'-'+item.view+'.png';
      await screenshot(page,file);
      row.views.push({view:item.view,label:item.label,screenshot:file});
    }
    assert(runtime.length===0,vp.name+': Browserfehler: '+runtime.join(' | '));
    report.viewports.push(row);
    await context.close();
  }
}catch(e){
  report.failures.push(String(e&&e.stack||e));
  throw e;
}finally{
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log('RC1124 Browser-Release-Smoke erfolgreich: '+viewports.length+' Viewports × '+views.length+' Hauptansichten.');
