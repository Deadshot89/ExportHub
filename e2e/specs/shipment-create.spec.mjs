import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  settleStateSave,
  openExportHubView,
  attachRuntimeGuards,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

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
      locationId:String(l&& (l.id||l.locationId||l.siteId)||''),
      locationName:String(l&& (l.name||l.locationName||l.siteName)||'')
    };
  },runId);
}

async function referenceInput(page){
  const byLabel=page.getByLabel(/Sendungsreferenz\s*\/\s*Referenznummer/i).first();
  if(await byLabel.count())return byLabel;
  return page.locator('#rc363BlockCustomer input[maxlength="6"][pattern*="A-Z0-9"]').first();
}

test('RC1171 P0: Sendung erstellen läuft vollständig über die Benutzeroberfläche bis Reload und Übersicht',async({page},testInfo)=>{
  test.setTimeout(120_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1','RC1171 läuft nur im mutierenden TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','RC1171 läuft genau einmal auf dem Laptop-Profil.');

  const runtime=attachRuntimeGuards(page,testInfo);
  const session=await installE2ESession(page);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen'],/Sendung erstellen|Versandauftrag/i,{allowProgrammaticFallback:true});

  const customer=await e2eCustomer(page,session.runId);
  expect(customer,'RC1171 E2E-Kunde fehlt').toBeTruthy();
  expect(customer?.id).toBeTruthy();
  expect(customer?.locationId).toBeTruthy();

  const newShipment=page.locator('#rc380NewShipment').or(page.getByRole('button',{name:/^\+?\s*Neue Sendung$/i})).first();
  await expect(newShipment).toBeVisible();
  await newShipment.click();
  await expect(page.locator('#rc363BlockCustomer')).toBeVisible();

  const customerSearch=page.locator('#shipmentCustomerSearch');
  await expect(customerSearch).toBeVisible();
  await customerSearch.fill([customer.account,customer.name].filter(Boolean).join(' · '));
  await customerSearch.press('Enter');
  await expect.poll(()=>page.evaluate(()=>String((window.__EXPORTHUB_GET_STATE__?.().shipment||{}).customerId||'')),{timeout:12_000}).toBe(customer.id);

  const location=page.locator('#index289LocationSelect');
  await expect(location).toBeVisible();
  if(await location.locator('option').count()>1)await location.selectOption(customer.locationId);
  await expect(location).toHaveValue(customer.locationId,{timeout:10_000});
  await expect.poll(()=>page.evaluate(()=>{
    const s=window.__EXPORTHUB_GET_STATE__?.()||{};
    let sh=null;
    try{sh=typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null}catch(_){}
    sh=sh||s.shipment||s.currentShipment||s.selectedShipment||{};
    return String(sh.locationId||sh.selectedLocationId||sh.siteId||sh.destinationId||'');
  }),{timeout:10_000}).toBe(customer.locationId);
  await expect(page.locator('#rc363BlockCustomer')).not.toContainText(/Standort fehlt|Adresse fehlt\. Sendungserstellung blockiert/i,{timeout:10_000});

  await settleStateSave(page,{timeout:25_000});
  const refInput=await referenceInput(page);
  await expect(refInput).toBeVisible();
  await expect(refInput).toHaveAttribute('readonly','');
  await expect(refInput).toHaveAttribute('aria-readonly','true');
  const ref=String(await refInput.inputValue()).trim().toUpperCase();
  expect(ref,'Automatisch erzeugte Sendungsreferenz').toMatch(/^[A-Z0-9]{6}$/);

  await page.evaluate(()=>{window.__RC1171_SAVED_EVENTS__=[];window.addEventListener('exporthub:shipment-saved',e=>window.__RC1171_SAVED_EVENTS__.push(e&&e.detail||{}));});
  const saveButton=page.locator('#rc363SaveShipment');
  await expect(saveButton).toBeVisible();

  // Colli über die sichtbaren Bedienelemente erfassen.
  const firstRow=page.locator('#rc573ColliCard .rc363-owned-row').first();
  await expect(firstRow).toBeVisible();
  const packagingToggle=firstRow.locator('[data-rc682-packaging-toggle]').first();
  await packagingToggle.click();
  const palletOption=page.locator('.rc682-packaging-option').filter({hasText:/Europalette/i}).first();
  await expect(palletOption).toBeVisible();
  await palletOption.click();

  await firstRow.locator('[data-rc363-field="count"] input').fill('1');
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
  await page.locator('#rc363WeightTarget').fill('100');
  await page.getByRole('button',{name:/Gewicht gleich aufteilen/i}).click();
  await page.locator('#rc363WeightModal').getByRole('button',{name:/Übernehmen/i}).click();
  await expect.poll(()=>weight.inputValue(),{timeout:5000}).toMatch(/^100(?:[.,]0+)?$/);

  const goods=page.getByLabel(/Warenbeschreibung/i).first();
  if(await goods.count())await goods.fill('E2E TEST Kunststoffteile');

  // Nur Test-Metadatum setzen, damit der Server-Cleanup exakt diesen Datensatz entfernt.
  await page.evaluate(runId=>{
    const s=window.__EXPORTHUB_GET_STATE__?.();
    if(!s||!s.shipment)throw new Error('Aktueller Sendungsentwurf fehlt');
    s.shipment._e2eRunId=runId;
  },session.runId);

  await page.evaluate(()=>{window.__RC1171_SAVED_EVENTS__=[];});
  await saveButton.click();
  await expect.poll(()=>page.evaluate(()=>Array.isArray(window.__RC1171_SAVED_EVENTS__)?window.__RC1171_SAVED_EVENTS__.length:0),{timeout:30_000}).toBeGreaterThan(0);
  await settleStateSave(page,{timeout:30_000});

  const savedEvent=await page.evaluate(()=>window.__RC1171_SAVED_EVENTS__[window.__RC1171_SAVED_EVENTS__.length-1]||null);
  expect(String(savedEvent?.reference||'').toUpperCase()).toBe(ref);

  // Reale Serverpersistenz nach Reload prüfen.
  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:30_000});

  const persisted=await page.evaluate(async({token,runId,ref})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    const data=await response.json().catch(()=>({}));
    const list=Array.isArray(data&&data.state&&data.state.shipments)?data.state.shipments:[];
    const sh=list.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').toUpperCase()===ref);
    return{status:response.status,found:sh?{
      ref:String(sh.ref||sh.reference||'').toUpperCase(),
      customerName:String(sh.customerName||sh.customer?.name||''),
      locationId:String(sh.locationId||sh.selectedLocationId||''),
      rows:Array.isArray(sh.rows)?sh.rows:[]
    }:null};
  },{token:session.token,runId:session.runId,ref});

  expect(persisted.status).toBe(200);
  expect(persisted.found?.ref).toBe(ref);
  expect(persisted.found?.customerName).toContain('E2E TEST CUSTOMER');
  expect(persisted.found?.locationId).toBe(customer.locationId);
  expect(persisted.found?.rows?.length).toBeGreaterThan(0);

  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#content')).toContainText(ref,{timeout:15_000});
  await expect(page.locator('#content')).toContainText(/E2E TEST CUSTOMER/i,{timeout:15_000});

  const refNode=page.getByText(ref,{exact:true}).first();
  await expect(refNode).toBeVisible();
  const card=refNode.locator('xpath=ancestor::*[self::article or contains(@class,"card")][1]');
  const openButton=card.getByRole('button',{name:/Sendung öffnen|Öffnen|Bearbeiten|Übernehmen/i}).first();
  if(await openButton.count()){
    await openButton.click();
    await expect(page.locator('#rc363BlockCustomer')).toBeVisible({timeout:12_000});
    const reopenedRef=await referenceInput(page);
    await expect(reopenedRef).toHaveValue(ref);
  }

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
