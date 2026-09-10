import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const BASE=process.env.RC1018_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const OUT=path.resolve('artifacts/rc1018-sop-screenshots');
fs.mkdirSync(OUT,{recursive:true});
for(const file of fs.readdirSync(OUT))if(file.endsWith('.png'))fs.rmSync(path.join(OUT,file));
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
  for(let pass=0;pass<3;pass++){
    for(const label of labels){
      for(const locator of [page.getByRole('button',{name:label,exact:true}),page.getByRole('link',{name:label,exact:true}),page.getByText(label,{exact:true})]){
        const item=await visible(locator);if(!item)continue;
        await item.click({timeout:5000});await pause(450);return label;
      }
    }
    await openMenu(page);
  }
  throw new Error(`Navigation nicht gefunden: ${labels.join(' / ')}`);
}
async function openView(page,module,labels,requiredText){
  const selectors=[
    `button[data-view="${module}"]`,`a[data-view="${module}"]`,`[role="button"][data-view="${module}"]`,
    `button[data-target="${module}"]`,`a[data-target="${module}"]`,`[role="button"][data-target="${module}"]`,
    `button[data-nav="${module}"]`,`a[data-nav="${module}"]`,`[role="button"][data-nav="${module}"]`
  ];
  for(let pass=0;pass<2;pass++){
    for(const selector of selectors){
      const item=await visible(page.locator(selector));
      if(!item)continue;
      await item.click({timeout:5000}).catch(()=>{});await pause(450);
      if(!requiredText||new RegExp(requiredText,'i').test(await page.locator('body').innerText()))return module;
    }
    await openMenu(page);
  }
  await clickAny(page,labels);
  if(requiredText)await page.waitForFunction(pattern=>new RegExp(pattern,'i').test(document.body?.innerText||''),requiredText,{timeout:10000});
  return module;
}
async function targetLocator(page,labels){
  for(const label of labels){
    for(const locator of [page.getByRole('heading',{name:label,exact:true}),page.getByRole('button',{name:label,exact:true}),page.getByText(label,{exact:true}),page.getByText(label,{exact:false})]){
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
  await item.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));
  await pause(220);
  const box=await item.boundingBox();
  assert(box&&box.width>0&&box.height>0,`${file}: Ziel ${label} ist nach dem Zentrieren nicht sichtbar`);
  await viewportShot(page,file);
}
async function viewShot(page,module,labels,file,requiredText){
  await openView(page,module,labels,requiredText);
  await page.evaluate(()=>scrollTo(0,0));await pause(180);
  await fullShot(page,file);
}
async function shipmentShots(page){
  await openView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],'Kunde|Empfänger');
  await page.waitForFunction(()=>/Kunde|Empfänger/i.test(document.body?.innerText||'')&&/Colli|Lademeter/i.test(document.body?.innerText||''),null,{timeout:10000});
  await page.evaluate(()=>scrollTo(0,0));await pause(150);
  await viewportShot(page,'rc1018-shipment-create.png');

  await targetShot(page,['Stauplan'],'rc1018-stowplan.png');
  await targetShot(page,['Dokumente','CMR'],'rc1018-documents-cmr.png');
  await targetShot(page,['ABD','Ausfuhrbegleitdokument'],'rc1018-abd.png');
  await targetShot(page,['QR-Abholung','Abholung','QR-Code'],'rc1018-qr-pickup.png');
  await targetShot(page,['Mail','E-Mail','Kundenmail','Spedition'],'rc1018-mail.png');

  const avis=page.locator('#rc897LieferavisPanel').first();
  if(await avis.count()&&await avis.isVisible().catch(()=>false)){
    await avis.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await pause(180);
    const box=await avis.boundingBox();
    if(box&&box.width>200&&box.height>80){
      await avis.screenshot({path:path.join(OUT,'rc1018-lieferavis.png')});
      assert(fs.statSync(path.join(OUT,'rc1018-lieferavis.png')).size>10000,'rc1018-lieferavis.png: Lieferavis-Panel ist unplausibel klein');
    }else await targetShot(page,['Lieferavis','Kundenavis'],'rc1018-lieferavis.png');
  } else await targetShot(page,['Lieferavis','Kundenavis'],'rc1018-lieferavis.png');
}
async function rightsShots(page){
  await openView(page,'rights',['Rechte','Benutzer & Rechte','Benutzer','Berechtigungen'],'Benutzer|Rechte|Rollen');
  await targetShot(page,['Benutzer','Benutzerverwaltung','Benutzer suchen'],'rc1018-users.png');
  await targetShot(page,['Rollen','Rechte','Berechtigungen'],'rc1018-rights.png');
}
async function podShot(page){
  try{
    await openView(page,'tasks',['Aufgaben'],'Aufgaben|POD');
    await targetShot(page,['POD hochladen','Fehlende POD','POD'],'rc1018-pod.png');
    return;
  }catch(_){
    await openView(page,'shipmentoverview',['Sendungen','Sendungsübersicht','Übersicht Sendungen'],'Sendung|POD');
    await targetShot(page,['POD hochladen','POD','Proof of Delivery'],'rc1018-pod.png');
  }
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:760},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
page.on('requestfailed',r=>{if(!/favicon\.ico/i.test(r.url()))errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText||''}`)});
try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await waitReady(page);

  await page.evaluate(()=>scrollTo(0,0));
  await targetShot(page,['ExportHUB','Demo','Firma','Konto'],'rc1018-start-company-session.png');
  await viewShot(page,'dashboard',['Dashboard'],'rc1018-dashboard-navigation.png','Dashboard');
  await rightsShots(page);
  await viewShot(page,'customers',['Kunden','Kunden & Standorte','Kundenverwaltung'],'rc1018-customers.png','Kunden');
  await viewShot(page,'calculator',['Versandkosten','Versandrechner','UPS-Rechner','Rechner'],'rc1018-shipping-route.png','Versand|Gate41|UPS|Route');
  await viewShot(page,'documents',['Dokumente','Dokumentenverwaltung'],'rc1018-document-upload.png','Dokument');

  await shipmentShots(page);
  await podShot(page);
  await viewShot(page,'pallet',['Palettenkonto'],'rc1018-pallet-account.png','Paletten');
  await viewShot(page,'sop',['SOP','SOP-Handbuch','SOP Handbuch'],'rc1018-sop-handbook.png','SOP');
  await viewShot(page,'academy',['Academy','Prüfungen'],'rc1018-academy.png','Academy|Prüfung');
  await viewShot(page,'archive',['Archiv','Historie','Protokolle'],'rc1018-archive-audit.png','Archiv|Historie|Protokoll');
  await viewShot(page,'diagnostics',['Fehlerdiagnose','Diagnose'],'rc1018-diagnostics.png','Diagnose');
  await viewShot(page,'update',['Release Center','Release-Center'],'rc1018-release-center.png','Release');

  assert(errors.length===0,errors.join(' | '));
  const files=fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).sort();
  assert(files.length===21,`Erwartet 21 RC1018-SOP-Screenshots, gefunden ${files.length}`);
  const hashes=files.map(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT,file))).digest('hex'));
  assert(new Set(hashes).size===21,`Erwartet 21 eigenständige RC1018-SOP-Screenshots, gefunden ${new Set(hashes).size} unterschiedliche Bildinhalte`);
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({base:BASE,generatedAt:new Date().toISOString(),files,hashes,errors},null,2)+'\n');
  console.log(`RC1018 SOP-Systembilder erfolgreich: ${files.length} echte, eigenständige Demo-Screenshots.`);
} finally {
  await context.close();
  await browser.close();
}
