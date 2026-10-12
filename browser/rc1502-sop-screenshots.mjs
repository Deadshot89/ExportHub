import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

await import('../assets/sop/rc1502-sop-screenshot-manifest.js');
const manifest=globalThis.ExportHubSopScreenshotManifest;
if(!manifest||!Array.isArray(manifest.entries))throw new Error('RC1502 Screenshot-Manifest fehlt');

const BASE=process.env.RC1502_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve(process.env.RC1502_SCREENSHOT_OUT||'artifacts/rc1502-sop-screenshots');
fs.mkdirSync(OUT,{recursive:true});
for(const file of fs.readdirSync(OUT))if(file.endsWith('.png')||file==='report.json')fs.rmSync(path.join(OUT,file));

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(ok,message){if(!ok)throw new Error(message);}
function fileName(entry){return path.basename(String(entry.file||''));}

async function waitReady(page){
  await page.waitForLoadState('domcontentloaded');
  const marker=await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true,null,{timeout:25000}).then(()=>true).catch(()=>false);
  if(!marker)await page.waitForFunction(()=>document.body&&String(document.body.innerText||'').trim().length>20,null,{timeout:15000});
  await pause(250);
}

async function assertDemoEnvironment(page){
  const current=new URL(page.url());
  assert(/\/demo\.html$/i.test(current.pathname),`RC1502 verweigert Nicht-Demo-URL: ${current.pathname}`);
  const environment=await page.evaluate(()=>{
    const attr=String(document.documentElement?.getAttribute('data-exporthub-environment')||'').trim().toLowerCase();
    if(attr)return attr;
    try{const api=window.ExportHUBEnvironmentHub;if(api&&typeof api.current==='function')return String(api.current()||'').trim().toLowerCase();}catch(_){}
    return window.__EXPORTHUB_DEMO_MODE__===true?'demo':'';
  });
  assert(environment==='demo',`RC1502 verweigert Umgebung ohne Demo-Marker: ${environment||'unbekannt'}`);
  return true;
}

async function openView(page,view){
  const opened=await page.evaluate(module=>{
    try{if(typeof window.setView==='function'){window.setView(module);return true;}}catch(_){}
    return false;
  },view);
  if(!opened){
    const locator=page.locator(`[data-view="${view}"],[data-target="${view}"],[data-nav="${view}"]`).first();
    assert(await locator.count(),`RC1502 View nicht gefunden: ${view}`);
    await locator.click({timeout:7000});
  }
  await page.waitForFunction(module=>{
    const current=String(document.body?.getAttribute('data-exporthub-view')||'').trim();
    if(current===module)return true;
    if(module==='shipment')return !!document.querySelector('#rc363BlockShipment,#rc363BlockCustomer');
    if(module==='sop')return !!document.querySelector('.rc1007-sop-overview,.rc1009-sop-shell,[data-sop-open]');
    return false;
  },view,{timeout:12000});
  await pause(250);
}

async function prepareEntry(page,entry){
  await openView(page,entry.view);
  if(entry.view==='shipment'){
    await page.evaluate(()=>{try{window.ExportHubSopTourTargets?.annotatePilotTargets?.(document);}catch(_){}});
  }
  if(entry.view==='sop'){
    const open=page.locator(`[data-sop-open="${entry.sopNumber}"]`).first();
    if(await open.count()){
      await open.scrollIntoViewIfNeeded().catch(()=>{});
      await open.click({timeout:7000}).catch(()=>{});
      await pause(250);
    }
  }
}

async function captureEntry(page,entry){
  await prepareEntry(page,entry);
  const targetPath=path.join(OUT,fileName(entry));
  if(entry.targetKey){
    const target=page.locator(`[data-tour-key="${entry.targetKey}"]`).first();
    await target.waitFor({state:'visible',timeout:10000});
    await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
    await pause(180);
    const box=await target.boundingBox();
    assert(box&&box.width>0&&box.height>0,`${entry.sopNumber}: Tour-Ziel nicht sichtbar`);
    await page.screenshot({path:targetPath,fullPage:false});
  }else{
    const step=page.locator(`#${entry.stepId}`).first();
    if(await step.count()&&await step.isVisible().catch(()=>false)){
      await step.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
      await pause(180);
    }
    await page.screenshot({path:targetPath,fullPage:false});
  }
  const size=fs.statSync(targetPath).size;
  assert(size>10000,`${entry.sopNumber}: Screenshot ist leer oder unplausibel klein (${size} Byte)`);
  return {entry,file:fileName(entry),size,hash:crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex')};
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const runtimeErrors=[];
page.on('pageerror',error=>runtimeErrors.push(`pageerror: ${error.message}`));
page.on('requestfailed',request=>{if(!/favicon\.ico/i.test(request.url()))runtimeErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText||''}`);});
try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await waitReady(page);
  await assertDemoEnvironment(page);
  const captures=[];
  for(const entry of manifest.entries)captures.push(await captureEntry(page,entry));
  assert(runtimeErrors.length===0,runtimeErrors.join(' | '));
  const required=captures.filter(item=>item.entry.required!==false);
  assert(new Set(required.map(item=>item.hash)).size===required.length,'RC1502 erforderliche Pilotbilder sind nicht eindeutig');
  const report={base:BASE,environment:'demo',generatedAt:new Date().toISOString(),captures:captures.map(({entry,file,size,hash})=>({sopNumber:entry.sopNumber,stepId:entry.stepId,file,size,hash})),errors:runtimeErrors};
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`RC1502 SOP-Screenshot-Pipeline erfolgreich: ${captures.length} echte Demo-Aufnahmen.`);
} finally {
  await context.close();
  await browser.close();
}
