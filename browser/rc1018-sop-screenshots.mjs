import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

const BASE=process.env.RC1018_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve('artifacts/rc1018-sop-screenshots');
fs.mkdirSync(OUT,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(ok,message){if(!ok)throw new Error(message)}

async function waitReady(page){
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true&&document.body,null,{timeout:20000});
  await pause(300);
}
async function visible(locator){
  const count=await locator.count();
  for(let i=count-1;i>=0;i--){const item=locator.nth(i);if(await item.isVisible().catch(()=>false))return item}
  return null;
}
async function openMenu(page){
  for(const selector of ['#rc1016MobileMenuBtn','#ehMenuBtn']){
    const button=page.locator(selector).first();
    if(await button.count()&&await button.isVisible().catch(()=>false)){await button.click().catch(()=>{});await pause(180);return true}
  }
  return false;
}
async function clickAny(page,labels){
  for(let pass=0;pass<2;pass++){
    for(const label of labels){
      for(const locator of [page.getByRole('button',{name:label,exact:true}),page.getByRole('link',{name:label,exact:true}),page.getByText(label,{exact:true})]){
        const item=await visible(locator);if(!item)continue;
        await item.click({timeout:5000});await pause(400);return label;
      }
    }
    await openMenu(page);
  }
  throw new Error(`Navigation nicht gefunden: ${labels.join(' / ')}`);
}
async function scrollToAny(page,labels){
  for(const label of labels){
    const locator=page.getByText(label,{exact:false});
    const item=await visible(locator);if(!item)continue;
    await item.scrollIntoViewIfNeeded();await pause(200);return label;
  }
  throw new Error(`Zielbereich nicht gefunden: ${labels.join(' / ')}`);
}
async function viewportShot(page,file){
  await page.screenshot({path:path.join(OUT,file),fullPage:false});
  assert(fs.statSync(path.join(OUT,file)).size>10000,`${file}: Screenshot ist leer oder unplausibel klein`);
}
async function fullShot(page,file){
  await page.screenshot({path:path.join(OUT,file),fullPage:true});
  assert(fs.statSync(path.join(OUT,file)).size>10000,`${file}: Screenshot ist leer oder unplausibel klein`);
}
async function shipmentShots(page){
  await clickAny(page,['Sendung erstellen','Neue Sendung','Sendung anlegen']);
  await page.waitForFunction(()=>/Kunde|Empfänger/i.test(document.body?.innerText||'')&&/Colli|Lademeter/i.test(document.body?.innerText||''),null,{timeout:10000});
  await page.evaluate(()=>scrollTo(0,0));await pause(150);
  await viewportShot(page,'rc1018-shipment-create.png');

  await scrollToAny(page,['Stauplan']);
  await viewportShot(page,'rc1018-stowplan.png');

  await scrollToAny(page,['Dokumente','CMR']);
  await viewportShot(page,'rc1018-documents-cmr.png');

  await scrollToAny(page,['ABD','Ausfuhrbegleitdokument']);
  await viewportShot(page,'rc1018-abd.png');

  await scrollToAny(page,['QR-Abholung','Abholung','QR-Code']);
  await viewportShot(page,'rc1018-qr-pickup.png');

  const avis=page.locator('#rc897LieferavisPanel').first();
  if(await avis.count()&&await avis.isVisible().catch(()=>false)){await avis.scrollIntoViewIfNeeded();await pause(180)}
  else await scrollToAny(page,['Lieferavis','Kundenavis']);
  await viewportShot(page,'rc1018-lieferavis.png');
}
async function viewShot(page,labels,file,requiredText){
  await clickAny(page,labels);
  if(requiredText)await page.waitForFunction(text=>(document.body?.innerText||'').toLowerCase().includes(String(text).toLowerCase()),requiredText,{timeout:10000});
  await page.evaluate(()=>scrollTo(0,0));await pause(180);
  await fullShot(page,file);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('requestfailed',r=>{if(!/favicon\.ico/i.test(r.url()))errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText||''}`)});
try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await waitReady(page);
  await shipmentShots(page);
  await viewShot(page,['Palettenkonto'],'rc1018-pallet-account.png','Paletten');
  await viewShot(page,['Fehlerdiagnose','Diagnose'],'rc1018-diagnostics.png','Diagnose');
  await viewShot(page,['Release Center','Release-Center'],'rc1018-release-center.png','Release');
  assert(errors.length===0,errors.join(' | '));
  const files=fs.readdirSync(OUT).filter(f=>f.endsWith('.png'));
  assert(files.length===9,`Erwartet 9 SOP-Screenshots, gefunden ${files.length}`);
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({base:BASE,generatedAt:new Date().toISOString(),files,errors},null,2)+'\n');
  console.log(`RC1018 SOP-Systembilder erfolgreich: ${files.length} echte Demo-Screenshots.`);
} finally {
  await context.close();
  await browser.close();
}
