import {expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  installE2ESession,
  settleStateSave,
  attachRuntimeGuards,
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
  await expect(saveDraft).toBeEnabled({timeout:5_000});
  await expect(page.locator('#packError')).toBeHidden();
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
      await installE2ESession(page);
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

      await page.locator('[data-pack-action="shipment"]').click();
      await expect(page.locator('#rc363BlockCustomer')).toBeVisible({timeout:30_000});
      await expect(page.locator('#shipmentCustomerSearch')).toHaveValue(/E2E PACK CUSTOMER A/i);
      const draft=await page.evaluate(()=>{
        const state=window.__EXPORTHUB_GET_STATE__?.()||{};
        const sh=state.shipment||state.currentShipment||state.selectedShipment||{};
        return{packNotificationId:sh.packNotificationId,deliveryFiles:sh.deliveryFiles||[]};
      });
      expect(draft.packNotificationId).toBeTruthy();
      expect(draft.deliveryFiles.some(file=>file.source==='pack_notification'&&file.customerAvisVisible===false&&file.name===resultA.canonicalName)).toBe(true);

      await assertNoHorizontalOverflow(page);
      await assertRuntimeClean(runtime,testInfo);
    }finally{
      await internal.close();
    }
  }finally{
    await packA.close();
    await packB.close();
  }
}
