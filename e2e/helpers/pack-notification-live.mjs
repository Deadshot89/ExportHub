import {expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  installE2ESession,
  settleStateSave,
  attachRuntimeGuards,
  acknowledgeConfirmedStateSaveNavigationAbort,
  assertRuntimeClean,
  assertNoHorizontalOverflow
} from './exporthub-browser.mjs';

export function packStationTokenFromFixture(){
  const explicit=String(process.env.EXPORTHUB_E2E_PACK_STATION_TOKEN||'').trim();
  if(explicit)return explicit;
  const encoded=String(process.env.EXPORTHUB_E2E_USER_B64||'').trim();
  if(!encoded)return'';
  try{
    const user=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
    return String(user&&user._e2ePackStationToken||'').trim();
  }catch(_){return'';}
}

async function createPackNotification(page,token,suffix='A'){
  const expected=suffix==='B'
    ?{sourceName:`E2E-${suffix}.pdf`,canonicalName:'SIDE250071282.pdf',pdfText:'Delivery note SIDE 250071282'}
    :{sourceName:`E2E-${suffix}.pdf`,canonicalName:'DNC3019222063.pdf',pdfText:'Delivery note DNC 3019222063'};
  await page.goto(`/pack/${encodeURIComponent(token)}?lang=de`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#packHome')).toBeVisible({timeout:20_000});
  await page.locator('#packNewShipment').click();
  await expect(page.locator('#packForm')).toBeVisible();
  await page.locator('#packCustomer').fill(`E2E PACK CUSTOMER ${suffix}`);
  await expect(page.locator('#packCustomerManualConfirm')).toBeVisible({timeout:10_000});
  await page.locator('#packCustomerManualConfirm').click();
  await page.locator('#packPackageType').selectOption({label:'Euro Palette'});
  await page.locator('#packPackageCount').fill('2');
  await page.locator('#packWeight').fill('680');
  const rows=page.locator('[data-pack-package]');
  await expect(rows).toHaveCount(2);
  for(let i=0;i<2;i++){
    await rows.nth(i).locator('[data-dim="length"]').fill('120');
    await rows.nth(i).locator('[data-dim="width"]').fill('80');
    await rows.nth(i).locator('[data-dim="height"]').fill(i===0?'145':'130');
  }
  await page.locator('#packDocuments').setInputFiles({
    name:expected.sourceName,
    mimeType:'application/pdf',
    buffer:Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Length 48 >>\nstream\nBT (${expected.pdfText}) Tj ET\nendstream\nendobj\n%%EOF`,'latin1')
  });
  await expect(page.locator('#packDocumentList')).toContainText(expected.canonicalName,{timeout:10_000});
  await expect(page.locator('#packDocumentList')).not.toContainText(expected.sourceName);

  const saveDraft=page.locator('#packSaveDraft');
  const saveResponsePromise=page.waitForResponse(response=>{
    try{
      const url=new URL(response.url());
      return url.pathname.endsWith('/api/pack-notification')&&url.searchParams.get('action')==='draft-save';
    }catch(_){return false;}
  },{timeout:30_000});
  await saveDraft.click();
  const saveResponse=await saveResponsePromise;
  expect(saveResponse.ok(),`draft-save HTTP ${saveResponse.status()}`).toBeTruthy();
  const savePayload=await saveResponse.json();
  expect(savePayload?.ok).toBe(true);
  expect(savePayload?.draft?.id).toBeTruthy();
  await expect(page.locator('#packHome')).toBeVisible({timeout:20_000});
  await expect(page.locator('#packForm')).toBeHidden();
  await expect(page.locator('#packDraftSavedFeedback')).toBeVisible();
  await expect(page.locator('#packDraftSavedFeedback')).toHaveText(/\S/);
  await expect(page.locator('#packNewShipment')).toBeEnabled();
  await expect(page.locator('#packError')).toBeHidden();
  // A packer must be able to start the next shipment immediately without
  // replacing the draft that was just persisted.
  await page.locator('#packNewShipment').click();
  await expect(page.locator('#packForm')).toBeVisible();
  await expect(page.locator('#packCustomer')).toHaveValue('');
  await expect(page.locator('#packDocumentList')).toBeEmpty();
  await page.locator('#packBackHome').click();
  await expect(page.locator('#packHome')).toBeVisible();
  const card=page.locator('[data-draft-id]').filter({hasText:`E2E PACK CUSTOMER ${suffix}`}).first();
  await expect(card).toBeVisible({timeout:20_000});
  const draftId=await card.getAttribute('data-draft-id');
  expect(draftId).toBe(String(savePayload.draft.id));
  await card.click();
  await expect(page.locator('#packForm')).toBeVisible({timeout:20_000});
  await expect(page.locator('#packCustomer')).toHaveValue(`E2E PACK CUSTOMER ${suffix}`);
  await expect(page.locator('#packPackageCount')).toHaveValue('2');
  await expect(page.locator('#packDocumentList')).toContainText(expected.canonicalName);
  await expect(page.locator('#packDocumentList')).not.toContainText(expected.sourceName);

  await expect(page.locator('#packSubmit')).toBeEnabled();
  // Selected files are stored in state while the native chooser is reset for the next upload.
  await expect(page.locator('#packDocuments')).toHaveValue('');
  expect(await page.locator('#packForm').evaluate(form=>form.checkValidity())).toBe(true);
  await page.locator('#packSubmit').click();
  await expect(page.locator('#packSuccess')).toBeVisible({timeout:30_000});
  const reference=String(await page.locator('#packSuccessReference').innerText()).trim();
  expect(reference).toMatch(/^PK-/);
  return{reference,canonicalName:expected.canonicalName};
}

export async function runPackNotificationLiveFlow(browser,testInfo,token){
  expect(String(token||'')).toMatch(/^E2E-PACK-/);
  const packA=await browser.newContext();
  const packB=await browser.newContext();
  try{
    const pageA=await packA.newPage();
    const pageB=await packB.newPage();
    const [resultA,resultB]=await Promise.all([
      createPackNotification(pageA,token,'A'),
      createPackNotification(pageB,token,'B')
    ]);
    const refA=resultA.reference,refB=resultB.reference;
    expect(refA).not.toBe(refB);

    const internal=await browser.newContext();
    try{
      const page=await internal.newPage();
      const runtime=attachRuntimeGuards(page,testInfo);
      const session=await installE2ESession(page);
      await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
      await waitReady(page);
      await settleStateSave(page,{timeout:30_000});

      const nav=page.locator('[data-pack-notifications-nav]');
      await expect(nav).toBeVisible({timeout:30_000});
      await nav.click();
      const section=page.locator('#packNotificationInbox');
      await expect(section).toBeVisible({timeout:30_000});
      await expect(section).toContainText(refA);
      await expect(section).toContainText(refB);
      const task=section.locator('[data-pack-notification-id]').filter({hasText:refA}).first();
      await task.click();
      await expect(page.locator('#packNotificationDetail')).toBeVisible();
      await expect(page.locator('#packNotificationDetail')).toContainText('680 kg');
      await expect(page.locator('#packNotificationDetail')).toContainText('120 × 80 × 145');
      await expect(page.locator('#packNotificationDetail')).toContainText(resultA.canonicalName);
      // A filename in the task is insufficient: fetch the real stored PDF from
      // the protected Blob API using the same authenticated viewer as the UI.
      const originalPdf=await page.evaluate(async({ref,canonicalName})=>{
        const s=window.__EXPORTHUB_GET_STATE__?.()||{};
        const n=(s.packNotifications||[]).find(x=>x.reference===ref);
        const file=(n?.documents||[]).find(x=>x.name===canonicalName);
        const viewer=window.ExportHUBDocumentBlob1059;
        // Include only test-file metadata in a failing assertion. Never log
        // auth tokens, private file bytes or the Blob's full storage path.
        if(!file||!viewer?.isBlobDocument?.(file))return{
          available:false,diagnostic:{
            notificationFound:!!n,
            documentCount:(n?.documents||[]).length,
            candidates:(n?.documents||[]).map(d=>({
              name:String(d.name||'').slice(0,160),
              storage:String(d.storage||'').slice(0,20),
              blobReferencePresent:!!d.blobName,
              inlineDataPresent:!!(d.data||d.dataUrl||d.base64)
            })),
            viewerLoaded:!!viewer,
            viewerHasBlobCheck:typeof viewer?.isBlobDocument==='function',
            targetDocumentFound:!!file
          }
        };
        const bytes=await viewer.fetchBytes(file);
        return{available:true,name:file.name,storage:file.storage,blobName:file.blobName,
          count:bytes.length,signature:String.fromCharCode(...bytes.slice(0,5))};
      },{ref:refA,canonicalName:resultA.canonicalName});
      expect(originalPdf.available,'original Packmeldung must have a retrievable real PDF: '+JSON.stringify(originalPdf.diagnostic||{})).toBe(true);
      expect(originalPdf.signature).toBe('%PDF-');
      expect(originalPdf.count).toBeGreaterThan(40);
      expect(originalPdf.storage).toBe('blob');

      await page.locator('#packNotificationDetail [data-pack-action="shipment"]').first().click();
      await expect(page.locator('#rc363BlockCustomer')).toBeVisible({timeout:30_000});
      await expect(page.locator('#shipmentCustomerSearch')).toHaveValue(/E2E PACK CUSTOMER A/i);
      const draft=await page.evaluate(()=>{
        const state=window.__EXPORTHUB_GET_STATE__?.()||{};
        const sh=state.shipment||state.currentShipment||state.selectedShipment||{};
        return{packNotificationId:sh.packNotificationId,deliveryFiles:sh.deliveryFiles||[]};
      });
      expect(draft.packNotificationId).toBeTruthy();
      expect(draft.deliveryFiles.some(file=>file.source==='pack_notification'&&file.customerAvisVisible===false&&file.name===resultA.canonicalName&&file.storage==='blob'&&file.blobName===originalPdf.blobName)).toBe(true);

      // RC1670: The handoff is not proven by an unsaved draft. Exercise the
      // canonical shipment save, reload the app, read server state and fetch the
      // exact PDF blob from that persisted shipment record.
      const customer=await page.evaluate(runId=>{
        const s=window.__EXPORTHUB_GET_STATE__?.()||{};
        const c=(s.customers||[]).find(x=>x&&x._e2eRunId===runId);
        if(!c)return null;
        const locations=[...(Array.isArray(c.locations)?c.locations:[]),...(Array.isArray(c.sites)?c.sites:[]),...(Array.isArray(c.standorte)?c.standorte:[])];
        const location=locations.find(x=>x&&x._e2eRunId===runId)||locations[0];
        return{id:String(c.id||''),account:String(c.account||c.customerNumber||''),name:String(c.name||c.customerName||''),locationId:String(location&&(location.id||location.locationId||location.siteId)||'')};
      },session.runId);
      expect(customer?.id,'TESTSERVICE fixture customer must exist for real shipment save').toBeTruthy();
      expect(customer?.locationId,'TESTSERVICE fixture customer must have a destination').toBeTruthy();
      const customerSearch=page.locator('#shipmentCustomerSearch');
      await customerSearch.fill([customer.account,customer.name].filter(Boolean).join(' · '));
      await customerSearch.press('Enter');
      await expect.poll(()=>page.evaluate(()=>String(window.__EXPORTHUB_GET_STATE__?.().shipment?.customerId||'')),{timeout:15_000}).toBe(customer.id);
      const location=page.locator('#index289LocationSelect');
      await expect(location).toBeVisible({timeout:15_000});
      await expect.poll(()=>location.locator('option').evaluateAll((opts,id)=>opts.some(o=>o.value===id),customer.locationId),{timeout:15_000}).toBe(true);
      await location.selectOption({value:customer.locationId});
      await expect(location).toHaveValue(customer.locationId);
      const rows=page.locator('#rc573ColliCard .rc363-owned-row');
      await expect(rows.first()).toBeVisible();
      for(let i=0;i<await rows.count();i++){
        const ldm=rows.nth(i).locator('[data-rc363-field="ldm"] input');
        if(await ldm.count()){await ldm.fill('0.4');await ldm.blur();}
      }
      const goods=page.getByLabel(/Warenbeschreibung/i).first();
      if(await goods.count())await goods.fill('E2E TEST delivery note handoff');
      // RC1676: the shipment reference belongs to the Sendungsdaten block, not
      // #rc363BlockCustomer. Keep the real visible six-character E2E gate.
      const refField=page.getByLabel(/Sendungsreferenz\s*\/\s*Referenznummer/i).first();
      await expect(refField).toBeVisible();
      const shipmentRef=String(await refField.inputValue()).trim().toUpperCase();
      expect(shipmentRef).toMatch(/^[A-Z0-9]{6}$/);
      const ready=await page.evaluate(({runId,notificationId,blobName})=>{
        const s=window.__EXPORTHUB_GET_STATE__?.()||{},sh=s.shipment||{};
        if(sh.packNotificationId!==notificationId)return false;
        if(!(sh.deliveryFiles||[]).some(file=>file.blobName===blobName))return false;
        sh._e2eRunId=runId;
        return true;
      },{runId:session.runId,notificationId:draft.packNotificationId,blobName:originalPdf.blobName});
      expect(ready,'pack ownership and original PDF must survive customer selection').toBe(true);
      await page.evaluate(()=>{window.__RC1670_SAVED_EVENTS__=[];window.addEventListener('exporthub:shipment-saved',e=>window.__RC1670_SAVED_EVENTS__.push(e?.detail||{}));});
      await expect(page.locator('#rc363SaveShipment')).toBeEnabled();
      await page.locator('#rc363SaveShipment').click();
      await expect.poll(()=>page.evaluate(ref=>(window.__RC1670_SAVED_EVENTS__||[]).some(e=>String(e.reference||e.ref||'').toUpperCase()===ref)),{timeout:40_000}).toBe(true);
      await expect.poll(()=>page.evaluate(({ref,notificationId,blobName})=>{
        const s=window.__EXPORTHUB_GET_STATE__?.()||{};
        const all=[...(s.shipments||[]),...(s.savedShipments||[]),...(s.sharedShipments||[])];
        const sh=all.find(row=>String(row.ref||row.reference||'').toUpperCase()===ref&&row.packNotificationId===notificationId);
        return !!sh&&(sh.deliveryFiles||[]).some(file=>file.blobName===blobName);
      },{ref:shipmentRef,notificationId:draft.packNotificationId,blobName:originalPdf.blobName}),{timeout:40_000}).toBe(true);
      await settleStateSave(page,{timeout:30_000});
      await page.reload({waitUntil:'domcontentloaded'});
      await waitReady(page);
      await settleStateSave(page,{timeout:30_000});
      const persisted=await page.evaluate(async({token,ref,notificationId,blobName})=>{
        const res=await fetch('/api/exporthub-state?mode=read&full=1',{method:'GET',credentials:'same-origin',cache:'no-store',
          headers:{Accept:'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,Authorization:'Bearer '+token,'X-ExportHUB-Environment':'testservice'}});
        const data=await res.json().catch(()=>({}));
        const s=data.state||{},all=[...(s.shipments||[]),...(s.savedShipments||[]),...(s.sharedShipments||[])];
        const sh=all.find(item=>String(item.ref||item.reference||'').toUpperCase()===ref&&item.packNotificationId===notificationId);
        const doc=(sh?.deliveryFiles||[]).find(item=>item.blobName===blobName);
        if(!doc)return{status:res.status,found:!!sh,document:false};
        const viewer=window.ExportHUBDocumentBlob1059;
        if(!viewer?.isBlobDocument?.(doc))return{status:res.status,found:true,document:false};
        const bytes=await viewer.fetchBytes(doc);
        return{status:res.status,found:true,document:true,storage:doc.storage,
          blobName:doc.blobName,name:doc.name,count:bytes.length,signature:String.fromCharCode(...bytes.slice(0,5)),
          customerVisible:doc.customerVisible,avisVisible:doc.customerAvisVisible};
      },{token:session.token,ref:shipmentRef,notificationId:draft.packNotificationId,blobName:originalPdf.blobName});
      expect(persisted.status).toBe(200);
      expect(persisted.found,'shipment must survive server-side read after page reload').toBe(true);
      expect(persisted.document,'real delivery note PDF must survive save and reload').toBe(true);
      expect(persisted.storage).toBe('blob');
      expect(persisted.blobName).toBe(originalPdf.blobName);
      expect(persisted.name).toBe(resultA.canonicalName);
      expect(persisted.signature).toBe('%PDF-');
      expect(persisted.count).toBeGreaterThan(40);
      expect(persisted.customerVisible).toBe(false);
      expect(persisted.avisVisible).toBe(false);

      await assertNoHorizontalOverflow(page);
      // A confirmed server save may have an aborted keepalive when reloading.
      // Only allow the documented navigation abort after the server read above.
      expect(acknowledgeConfirmedStateSaveNavigationAbort(runtime)).toBeLessThanOrEqual(1);
      await assertRuntimeClean(runtime,testInfo);
    }finally{
      await internal.close();
    }
  }finally{
    await packA.close();
    await packB.close();
  }
}
