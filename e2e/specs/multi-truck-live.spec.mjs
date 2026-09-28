import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {
  appEntry,
  waitReady,
  settleStateSave,
  openExportHubView,
  attachRuntimeGuards,
  acknowledgeConfirmedStateSaveNavigationAbort,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

function authHeaders(token){
  return {
    'Content-Type':'application/json',
    'Accept':'application/json',
    'Cache-Control':'no-cache',
    'X-ExportHUB-Token':token,
    'X-ExportHUB-Session':token,
    'Authorization':'Bearer '+token,
    'X-ExportHUB-Environment':'testservice'
  };
}

async function e2eCustomer(page,runId){
  return page.evaluate(id=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    const list=s&&Array.isArray(s.customers)?s.customers:[];
    const c=list.find(x=>x&&x._e2eRunId===id);
    if(!c)return null;
    const locations=[...(Array.isArray(c.locations)?c.locations:[]),...(Array.isArray(c.sites)?c.sites:[]),...(Array.isArray(c.standorte)?c.standorte:[])];
    const l=locations.find(x=>x&&x._e2eRunId===id)||locations[0]||null;
    return{
      id:String(c.id||''),
      account:String(c.account||c.customerNumber||''),
      name:String(c.name||c.customerName||''),
      locationId:String(l&&(l.id||l.locationId||l.siteId)||'')
    };
  },runId);
}

async function referenceInput(page){
  const byLabel=page.getByLabel(/Sendungsreferenz\s*\/\s*Referenznummer/i).first();
  if(await byLabel.count())return byLabel;
  return page.locator('#rc363BlockCustomer input[maxlength="6"][pattern*="A-Z0-9"]').first();
}

async function createLoaderPin(page,session){
  const call=async payload=>page.evaluate(async({token,payload})=>{
    const response=await fetch('/api/loader-pins-admin',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{
        'Content-Type':'application/json','Accept':'application/json',
        'X-ExportHUB-Token':token,'X-ExportHUB-Session':token,
        'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'
      },
      body:JSON.stringify(payload)
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,payload});

  let listed=await call({action:'list'});
  expect(listed.status).toBe(200);
  expect(listed.data?.ok).toBe(true);
  const prefix='E2E TEST Loader ';
  for(const item of Array.isArray(listed.data?.pins)?listed.data.pins:[]){
    if(String(item?.name||'').startsWith(prefix))await call({action:'delete',id:String(item.id||'')});
  }

  listed=await call({action:'list'});
  expect(listed.status).toBe(200);
  const used=new Set((Array.isArray(listed.data?.pins)?listed.data.pins:[]).map(x=>String(x?.pin||'')));
  const seed=parseInt(crypto.createHash('sha256').update(session.runId).digest('hex').slice(0,6),16);
  let pin='';
  for(let offset=0;offset<1000;offset++){
    const candidate=String(8000+((seed+offset)%1000));
    if(!used.has(candidate)){pin=candidate;break}
  }
  expect(pin,'Freie E2E-Verlader-PIN fehlt').toMatch(/^\d{4}$/);

  const created=await call({action:'create',name:prefix+session.runId,pin,active:true});
  expect(created.status).toBe(200);
  expect(created.data?.ok).toBe(true);
  const row=(created.data?.pins||[]).find(x=>String(x?.name||'')===prefix+session.runId);
  expect(row?.id,'E2E-Verlader-PIN wurde nicht gespeichert').toBeTruthy();
  return{id:String(row.id),pin,call};
}

async function persistedShipment(page,session,ref){
  return page.evaluate(async({token,runId,ref})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{
        'Accept':'application/json',
        'X-ExportHUB-Token':token,'X-ExportHUB-Session':token,
        'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'
      }
    });
    const data=await response.json().catch(()=>({}));
    const list=Array.isArray(data?.state?.shipments)?data.state.shipments:[];
    const sh=list.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').trim().toUpperCase()===ref);
    return{status:response.status,shipment:sh||null};
  },{token:session.token,runId:session.runId,ref});
}

async function completePickup(context,token,colli,pin,index){
  const pickup=await context.newPage();
  try{
    await pickup.goto('/pickup.html?token='+encodeURIComponent(token)+'&environment=testservice',{waitUntil:'domcontentloaded'});
    await expect(pickup.locator('#form')).toBeVisible({timeout:25_000});
    await expect(pickup.locator('#expectedColli')).toHaveText(String(colli),{timeout:20_000});
    await pickup.locator('#colli').fill(String(colli));
    await pickup.locator('#checkColli').click();
    await expect(pickup.locator('#driverStep')).toBeVisible({timeout:15_000});
    await pickup.locator('#driver').fill('E2E Fahrer '+index);
    await pickup.locator('#plate').fill('E2E-'+String(index).padStart(2,'0'));
    await pickup.locator('#carrier').fill('E2E TEST Spedition');
    await pickup.locator('#pin').fill(pin);
    await pickup.evaluate(()=>{
      const canvas=document.createElement('canvas');
      canvas.width=320;canvas.height=120;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#111';ctx.fillRect(24,58,250,6);ctx.fillRect(60,42,8,34);
      const data=canvas.toDataURL('image/jpeg',0.85);
      const input=document.getElementById('signatureData');
      input.value=data;
    });
    await pickup.locator('#confirm').click();
    await expect(pickup.locator('body')).toContainText(/Abholung erfolgreich übertragen/i,{timeout:90_000});
  }finally{
    await pickup.close().catch(()=>{});
  }
}

test('RC1320 P1: Mehr-LKW läuft im TESTSERVICE von UI-Aufteilung über getrennte QR-Codes bis vollständiger Abholung',async({page},testInfo)=>{
  test.setTimeout(300_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1','RC1320 läuft nur im mutierenden TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','RC1320 läuft genau einmal auf dem Laptop-Profil.');

  const runtime=attachRuntimeGuards(page,testInfo);
  const session=await installE2ESession(page);
  let loader=null;

  try{
    await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(page);
    await openExportHubView(page,'shipment',['Sendung erstellen'],/Sendung erstellen|Versandauftrag/i,{allowProgrammaticFallback:true});

    const customer=await e2eCustomer(page,session.runId);
    expect(customer,'RC1320 E2E-Kunde fehlt').toBeTruthy();
    expect(customer?.id).toBeTruthy();
    expect(customer?.locationId).toBeTruthy();

    const newShipment=page.locator('#rc380NewShipment').or(page.getByRole('button',{name:/^\+?\s*Neue Sendung$/i})).first();
    await expect(newShipment).toBeVisible();
    await newShipment.click({timeout:25_000});
    await expect(page.locator('#rc363BlockCustomer')).toBeVisible();

    const customerSearch=page.locator('#shipmentCustomerSearch');
    await customerSearch.fill([customer.account,customer.name].filter(Boolean).join(' · '));
    await customerSearch.press('Enter');
    await expect.poll(()=>page.evaluate(()=>String((window.__EXPORTHUB_GET_STATE__?.().shipment||{}).customerId||'')),{timeout:12_000}).toBe(customer.id);

    const location=page.locator('#index289LocationSelect');
    await expect.poll(
      ()=>location.locator('option').evaluateAll((options,id)=>options.some(option=>option.value===id),customer.locationId),
      {timeout:15_000}
    ).toBe(true);
    await location.selectOption({value:customer.locationId});

    await settleStateSave(page,{timeout:25_000});
    const refInput=await referenceInput(page);
    const ref=String(await refInput.inputValue()).trim().toUpperCase();
    expect(ref).toMatch(/^[A-Z0-9]{6}$/);

    const firstRow=page.locator('#rc573ColliCard .rc363-owned-row').first();
    await expect(firstRow).toBeVisible();
    await firstRow.locator('[data-rc682-packaging-toggle]').first().click();
    const palletOption=page.locator('.rc682-packaging-option').filter({hasText:/Euro\s*Palette/i}).first();
    await expect(palletOption).toBeVisible();
    await palletOption.click();

    await firstRow.locator('[data-rc363-field="count"] input').fill('70');
    await firstRow.locator('[data-rc363-field="count"] input').blur();
    await firstRow.locator('[data-rc363-field="ldm"] input').fill('0.4');
    await firstRow.locator('[data-rc363-field="ldm"] input').blur();
    await firstRow.locator('[data-rc363-field="l"] input').fill('120');
    await firstRow.locator('[data-rc363-field="l"] input').blur();
    await firstRow.locator('[data-rc363-field="w"] input').fill('80');
    await firstRow.locator('[data-rc363-field="w"] input').blur();
    await firstRow.locator('[data-rc363-field="h"] input').fill('100');
    await firstRow.locator('[data-rc363-field="h"] input').blur();

    const weight=firstRow.locator('[data-rc363-field="weight"] input');
    await weight.click();
    await expect(page.locator('#rc363WeightModal')).toBeVisible();
    await page.locator('#rc363WeightTarget').fill('7000');
    await page.getByRole('button',{name:/Gewicht gleich aufteilen/i}).click();
    await page.locator('#rc363WeightModal').getByRole('button',{name:/Übernehmen/i}).click();

    await page.evaluate(runId=>{
      const s=window.__EXPORTHUB_GET_STATE__?.();
      if(!s||!s.shipment)throw new Error('RC1320 aktueller Sendungsentwurf fehlt');
      s.shipment._e2eRunId=runId;
    },session.runId);

    await page.evaluate(()=>{window.__RC1320_SAVED_EVENTS__=[];window.addEventListener('exporthub:shipment-saved',e=>window.__RC1320_SAVED_EVENTS__.push(e?.detail||{}));});
    await page.locator('#rc363SaveShipment').click();
    await expect.poll(()=>page.evaluate(()=>window.__RC1320_SAVED_EVENTS__?.length||0),{timeout:40_000}).toBeGreaterThan(0);
    await settleStateSave(page,{timeout:40_000});

    const saved=await page.evaluate(()=>window.__RC1320_SAVED_EVENTS__.at(-1)||null);
    expect(String(saved?.reference||'').toUpperCase()).toBe(ref);
    expect(saved?.shipment).toBeTruthy();
    const subShipments=Array.isArray(saved?.shipment?.subShipments)?saved.shipment.subShipments:[];
    expect(subShipments.length,'70 Euro-Paletten müssen automatisch mehrere LKW erzeugen').toBeGreaterThan(1);
    expect(Number(saved.shipment.requiredTruckCount||0)).toBe(subShipments.length);

    const totalSubColli=subShipments.reduce((sum,sub)=>sum+(Array.isArray(sub?.rows)?sub.rows.reduce((n,row)=>n+Number(row?.count||0),0):0),0);
    expect(totalSubColli).toBe(70);

    await expect(page.locator('#rc1017-subshipments')).toBeVisible({timeout:15_000});
    await expect(page.locator('#rc1017-subshipments [data-rc1017-subshipment]')).toHaveCount(subShipments.length);
    await assertNoHorizontalOverflow(page);

    const issued=[];
    for(const sub of subShipments){
      const id=String(sub.subShipmentId||'');
      expect(id).toMatch(/-TRUCK-\d+$/);
      const article=page.locator('[data-rc1017-subshipment="'+id+'"]');
      await expect(article).toBeVisible();
      await expect(article.locator('[data-action="rc1017-print-subshipment"]')).toBeVisible();
      await expect(article.locator('[data-action="rc1017-stow-subshipment"]')).toBeVisible();
      const responsePromise=page.waitForResponse(r=>r.url().includes('/api/pickup-init')&&r.request().method()==='POST',{timeout:45_000});
      await article.locator('[data-action="rc1017-qr-subshipment"]').click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      const data=await response.json().catch(()=>({}));
      expect(data?.token).toMatch(/^[A-Za-z0-9_-]{6,160}$/);
      expect(String(data?.subShipmentId||'')).toBe(id);
      issued.push({
        id,
        token:String(data.token),
        colli:(Array.isArray(sub.rows)?sub.rows:[]).reduce((n,row)=>n+Math.max(0,Math.round(Number(row?.count||0))),0)
      });
    }
    expect(new Set(issued.map(x=>x.token)).size).toBe(issued.length);

    const beforeReload=await persistedShipment(page,session,ref);
    expect(beforeReload.status).toBe(200);
    expect(beforeReload.shipment?.subShipments?.length).toBe(subShipments.length);
    expect(beforeReload.shipment?.requiredTruckCount).toBe(subShipments.length);

    loader=await createLoaderPin(page,session);

    await completePickup(page.context(),issued[0].token,issued[0].colli,loader.pin,1);
    await expect.poll(async()=>{
      const current=await persistedShipment(page,session,ref);
      return String(current.shipment?.status||current.shipment?.processStatus||'');
    },{timeout:45_000,message:'Nach dem ersten LKW muss die Hauptsendung teilweise abgeholt sein'}).toBe('Teilweise abgeholt');

    const partial=await persistedShipment(page,session,ref);
    expect(partial.shipment?.multiTruckLocked).toBe(true);
    expect(partial.shipment?.subShipments?.filter(x=>/confirmed|picked|abgeholt|pod|completed/i.test(String(x?.status||''))).length).toBe(1);
    expect(partial.shipment?.subShipments?.find(x=>String(x?.subShipmentId||'')===issued[0].id)?.pickupHistory?.length).toBeGreaterThan(0);

    for(let index=1;index<issued.length;index++){
      await completePickup(page.context(),issued[index].token,issued[index].colli,loader.pin,index+1);
    }

    await expect.poll(async()=>{
      const current=await persistedShipment(page,session,ref);
      return String(current.shipment?.status||current.shipment?.processStatus||'');
    },{timeout:60_000,message:'Nach dem letzten LKW muss die Hauptsendung vollständig abgeholt sein'}).toBe('Abgeholt');

    const finalState=await persistedShipment(page,session,ref);
    expect(finalState.shipment?.pickupComplete).toBe(true);
    expect(finalState.shipment?.subShipments?.length).toBe(issued.length);
    for(const part of finalState.shipment?.subShipments||[]){
      expect(String(part?.status||'')).toMatch(/confirmed|picked|abgeholt|pod|completed/i);
      expect(part?.locked).toBe(true);
      expect(Array.isArray(part?.pickupHistory)&&part.pickupHistory.length>0).toBe(true);
    }

    await page.reload({waitUntil:'domcontentloaded'});
    await waitReady(page);
    const afterReload=await persistedShipment(page,session,ref);
    expect(String(afterReload.shipment?.status||afterReload.shipment?.processStatus||'')).toBe('Abgeholt');
    expect(afterReload.shipment?.multiTruckLocked).toBe(true);
    expect(afterReload.shipment?.subShipments?.length).toBe(issued.length);

    await assertNoSourceLeak(page);
    const saveAborts=acknowledgeConfirmedStateSaveNavigationAbort(runtime);
    expect(saveAborts).toBeLessThanOrEqual(1);
    await assertRuntimeClean(runtime,testInfo);
  }finally{
    if(loader?.id){
      await loader.call({action:'delete',id:loader.id}).catch(()=>{});
    }
  }
});
