import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
async function targetLocator(page,labels){
  for(const label of labels){
    for(const locator of [page.getByText(label,{exact:true}),page.getByRole('heading',{name:label,exact:true}),page.getByRole('button',{name:label,exact:true}),page.getByText(label,{exact:false})]){
      const item=await visible(locator);if(item)return{item,label};
    }
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
async function targetShot(page,labels,file){
  const {item,label}=await targetLocator(page,labels);
  await item.scrollIntoViewIfNeeded();
  await pause(180);
  const rect=await item.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};
  });
  const pageSize=await page.evaluate(()=>({width:Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0),height:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)}));
  const width=Math.min(1120,pageSize.width);
  const height=Math.min(620,pageSize.height);
  const centerX=rect.x+Math.max(1,rect.width)/2;
  const centerY=rect.y+Math.max(1,rect.height)/2;
  const x=Math.max(0,Math.min(pageSize.width-width,centerX-width/2));
  const y=Math.max(0,Math.min(pageSize.height-height,centerY-height/2));
  await page.screenshot({path:path.join(OUT,file),clip:{x,y,width,height}});
  assert(fs.statSync(path.join(OUT,file)).size>10000,`${file}: Zielaufnahme ${label} ist leer oder unplausibel klein`);
}
async function shipmentShots(page){
  await clickAny(page,['Sendung erstellen','Neue Sendung','Sendung anlegen']);
  await page.waitForFunction(()=>/Kunde|Empfänger/i.test(document.body?.innerText||'')&&/Colli|Lademeter/i.test(document.body?.innerText||''),null,{timeout:10000});
  await page.evaluate(()=>scrollTo(0,0));await pause(150);
  await viewportShot(page,'rc1018-shipment-create.png');

  await targetShot(page,['Stauplan'],'rc1018-stowplan.png');
  await targetShot(page,['Dokumente','CMR'],'rc1018-documents-cmr.png');
  await targetShot(page,['ABD','Ausfuhrbegleitdokument'],'rc1018-abd.png');
  await targetShot(page,['QR-Abholung','Abholung','QR-Code'],'rc1018-qr-pickup.png');

  const avis=page.locator('#rc897LieferavisPanel').first();
  if(await avis.count()&&await avis.isVisible().catch(()=>false)){
    await avis.scrollIntoViewIfNeeded();await pause(180);
    const box=await avis.boundingBox();
    if(box&&box.width>200&&box.height>80){
      await avis.screenshot({path:path.join(OUT,'rc1018-lieferavis.png')});
      assert(fs.statSync(path.join(OUT,'rc1018-lieferavis.png')).size>10000,'rc1018-lieferavis.png: Lieferavis-Panel ist unplausibel klein');
    }else await targetShot(page,['Lieferavis','Kundenavis'],'rc1018-lieferavis.png');
  } else await targetShot(page,['Lieferavis','Kundenavis'],'rc1018-lieferavis.png');
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
  const files=fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).sort();
  assert(files.length===9,`Erwartet 9 SOP-Screenshots, gefunden ${files.length}`);
  const hashes=files.map(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT,file))).digest('hex'));
  assert(new Set(hashes).size===9,`Erwartet 9 eigenständige SOP-Screenshots, gefunden ${new Set(hashes).size} unterschiedliche Bildinhalte`);
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({base:BASE,generatedAt:new Date().toISOString(),files,hashes,errors},null,2)+'\n');
  console.log(`RC1018 SOP-Systembilder erfolgreich: ${files.length} echte, eigenständige Demo-Screenshots.`);
} finally {
  await context.close();
  await browser.close();
}
