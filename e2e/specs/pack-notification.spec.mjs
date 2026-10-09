import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,installE2ESession,settleStateSave,attachRuntimeGuards,assertRuntimeClean,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

const token=String(process.env.EXPORTHUB_E2E_PACK_STATION_TOKEN||'').trim();

async function createPackNotification(page,suffix='A'){
  await page.goto(`/pack/${encodeURIComponent(token)}`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#packHome')).toBeVisible({timeout:20_000});
  await page.locator('#packNewShipment').click();
  await expect(page.locator('#packForm')).toBeVisible();
  await page.locator('#packCustomer').fill(`E2E PACK CUSTOMER ${suffix}`);
  await expect(page.locator('#packCustomerManualConfirm')).toBeVisible({timeout:10_000});
  await page.locator('#packCustomerManualConfirm').click();
  await page.locator('#packDeliveryNoteReference').fill(`DNC-E2E-${suffix}`);
  await page.locator('#packPackageType').selectOption({label:'Europalette'});
  await page.locator('#packPackageCount').fill('2');
  await page.locator('#packWeight').fill('680');
  const rows=page.locator('[data-pack-package]');
  await expect(rows).toHaveCount(2);
  for(let i=0;i<2;i++){
    await rows.nth(i).locator('[data-dim="length"]').fill('120');
    await rows.nth(i).locator('[data-dim="width"]').fill('80');
    await rows.nth(i).locator('[data-dim="height"]').fill(i===0?'145':'130');
  }
  await page.locator('#packDocuments').setInputFiles({name:`E2E-${suffix}.pdf`,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});

  await page.locator('#packSaveDraft').click();
  await expect(page.locator('#packValidationHint')).toContainText('Entwurf gespeichert',{timeout:20_000});
  await page.locator('#packBackHome').click();
  await expect(page.locator('#packHome')).toBeVisible();
  const card=page.locator('[data-draft-id]').filter({hasText:`E2E PACK CUSTOMER ${suffix}`}).first();
  await expect(card).toBeVisible({timeout:20_000});
  await expect(card).toContainText('Anzahl Paletten');
  await card.click();
  await expect(page.locator('#packFormMode')).toContainText('Entwurf weiterbearbeiten');
  await expect(page.locator('#packCustomer')).toHaveValue(`E2E PACK CUSTOMER ${suffix}`);
  await expect(page.locator('#packDeliveryNoteReference')).toHaveValue(`DNC-E2E-${suffix}`);
  await expect(page.locator('#packPackageCount')).toHaveValue('2');

  await expect(page.locator('#packSubmit')).toBeEnabled();
  await page.locator('#packSubmit').click();
  await expect(page.locator('#packSuccess')).toBeVisible({timeout:30_000});
  const reference=String(await page.locator('#packSuccessReference').innerText()).trim();
  expect(reference).toMatch(/^PK-/);
  return reference;
}

test('QR pack flow saves and resumes draft, then creates notification detail and shipment handoff',async({browser},testInfo)=>{
  test.setTimeout(180_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1'||!token,'requires live mutable TESTSERVICE and EXPORTHUB_E2E_PACK_STATION_TOKEN');
  test.skip(testInfo.project.name!=='laptop','runs once on laptop profile');

  const packA=await browser.newContext();
  const packB=await browser.newContext();
  const pageA=await packA.newPage();
  const pageB=await packB.newPage();
  const [refA,refB]=await Promise.all([createPackNotification(pageA,'A'),createPackNotification(pageB,'B')]);
  expect(refA).not.toBe(refB);
  await packA.close();await packB.close();

  const internal=await browser.newContext();
  const page=await internal.newPage();
  const runtime=attachRuntimeGuards(page,testInfo);
  await installE2ESession(page);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:30_000});
  await openExportHubView(page,'tasks',['Aufgaben'],/Aufgaben|Packmeldungen/i,{allowProgrammaticFallback:true});

  const section=page.locator('#packNotificationTaskSection');
  await expect(section).toBeVisible({timeout:30_000});
  await expect(section).toContainText(refA);
  await expect(section).toContainText(refB);
  const task=section.locator('[data-pack-task-id]').filter({hasText:refA}).first();
  await task.click();
  await expect(page.locator('#packNotificationDetail')).toBeVisible();
  await expect(page.locator('#packNotificationDetail')).toContainText('680 kg');
  await expect(page.locator('#packNotificationDetail')).toContainText('120 × 80 × 145');
  await expect(page.locator('#packNotificationDetail')).toContainText('E2E-A.pdf');

  await page.locator('[data-pack-action="shipment"]').click();
  await expect(page.locator('#rc363BlockCustomer')).toBeVisible({timeout:30_000});
  await expect(page.locator('#shipmentCustomerSearch')).toHaveValue(/E2E PACK CUSTOMER A/i);
  const draft=await page.evaluate(()=>{
    const state=window.__EXPORTHUB_GET_STATE__?.()||{};
    const sh=state.shipment||state.currentShipment||state.selectedShipment||{};
    return{packNotificationId:sh.packNotificationId,deliveryFiles:sh.deliveryFiles||[]};
  });
  expect(draft.packNotificationId).toBeTruthy();
  expect(draft.deliveryFiles.some(file=>file.source==='pack_notification'&&file.customerAvisVisible===false)).toBe(true);

  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
  await internal.close();
});
