import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

async function openAbdSop(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);
  const open=page.locator('[data-sop-open="SOP-EH-060"]').first();
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]')).toBeVisible();
  await expect(page.locator('[data-sop-training-start="SOP-EH-060"]')).toBeVisible();
  await expect(page.locator('[data-sop-exam-start="SOP-EH-060"]')).toBeVisible();
}

async function openShipment(page){
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);
  await expect(page.locator('#rc363BlockDocuments')).toBeVisible();
  await expect(page.locator('#rc363BlockAbdDecision')).toBeVisible();
  await expect(page.locator('#rc363BlockAbdDecision')).toHaveAttribute('data-tour-key','shipment-abd-decision');
}

async function learningRecord(page){
  return page.evaluate(()=>{
    const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};
    let user=null;
    try{if(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function')user=window.__EXPORTHUB_GET_CURRENT_USER__()||null;}catch(_){}
    user=user||state.currentUser||state.activeUser||{};
    const userId=String(user.id||user.userId||user.user||user.username||user.login||'').trim();
    const sop=window.ExportHubSopTourRuntime?.effectiveSop?.('SOP-EH-060')||window.ExportHubIsoSopCatalog?.get?.('SOP-EH-060')||{};
    const version=String(sop.version||sop.currentVersion||'').trim();
    return {
      userId,
      version,
      record:window.ExportHubSopProgress?.get?.(state,userId,'SOP-EH-060',version)||null
    };
  });
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1503: Demo-Training bleibt simuliert und protokolliert Tour-Fortschritt (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    const productive=[];
    page.on('request',request=>{
      const url=request.url();
      if(/\/api\/(?:mail|avis|pickup-token|qr|pallet|external-portal)(?:[/?]|$)/i.test(url))productive.push(`${request.method()} ${url}`);
    });

    await openAbdSop(page);
    await page.locator('[data-sop-training-start="SOP-EH-060"]').click();
    await expect(page.locator('[data-sop-training-banner]')).toBeVisible();
    await expect(page.locator('[data-sop-training-banner]')).toContainText(/TRAININGSMODUS/i);
    await expect(page.locator('[data-sop-training-banner]')).toContainText(/Keine produktiven Daten werden verändert/i);

    await openShipment(page);
    await page.locator('#rc363BlockAbdDecision').click({position:{x:8,y:8}});
    await expect(page.locator('.rc1501-sop-tour-panel')).toContainText(/Training abgeschlossen/i);

    const simulation=await page.evaluate(()=>window.ExportHubSopTraining?.simulate?.('status',{reference:'DEMO-E2E',status:'Bereit zur Abholung'}));
    expect(simulation?.ok).toBe(true);
    expect(simulation?.simulated).toBe(true);
    expect(simulation?.externalExecuted).toBe(false);
    expect(productive).toEqual([]);

    const progress=await learningRecord(page);
    expect(progress.userId).not.toBe('');
    expect(progress.version).not.toBe('');
    expect(progress.record?.viewedAt).toBeTruthy();
    expect(progress.record?.startedAt).toBeTruthy();
    expect(progress.record?.tourCompletedAt).toBeTruthy();
    await assertNoHorizontalOverflow(page);
  });

  test(`RC1503: lösungsfreie Prüfung besteht nach korrekter Benutzeraktion und speichert Versuch (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await openAbdSop(page);
    await page.locator('[data-sop-exam-start="SOP-EH-060"]').click();
    const shell=page.locator('[data-sop-exam-shell]');
    await expect(shell).toBeVisible();
    await expect(shell).toContainText(/Prüfung/i);
    await expect(shell).not.toContainText(/Tipp|Öffne in der Sendung den ABD-Bereich|erwartetes Ergebnis/i);

    await openShipment(page);
    await expect(page.locator('#rc363BlockAbdDecision')).not.toHaveClass(/rc1501-sop-tour-target/);
    await page.locator('#rc363BlockAbdDecision').click({position:{x:8,y:8}});
    await shell.locator('[data-sop-exam-finish]').click();
    await expect(shell).toContainText(/Bestanden/i);

    const progress=await learningRecord(page);
    expect(progress.record?.examAttempts).toHaveLength(1);
    expect(progress.record?.examAttempts?.[0]?.passed).toBe(true);
    expect(progress.record?.completedAt).toBeTruthy();
    await assertNoHorizontalOverflow(page);
  });

  test(`RC1503: falsche Prüfungsaktion führt zu Noch nicht bestanden und bleibt diagnostisch gespeichert (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await openAbdSop(page);
    await page.locator('[data-sop-exam-start="SOP-EH-060"]').click();
    const shell=page.locator('[data-sop-exam-shell]');
    await expect(shell).toBeVisible();

    await openShipment(page);
    await page.locator('#rc363BlockDocuments').click({position:{x:8,y:8}});
    await shell.locator('[data-sop-exam-finish]').click();
    await expect(shell).toContainText(/Noch nicht bestanden/i);

    const progress=await learningRecord(page);
    expect(progress.record?.examAttempts).toHaveLength(1);
    const attempt=progress.record?.examAttempts?.[0];
    expect(attempt?.passed).toBe(false);
    expect(Array.isArray(attempt?.errors)&&attempt.errors.length>0).toBe(true);
    expect(Array.isArray(attempt?.skippedSteps)&&attempt.skippedSteps.length>0).toBe(true);
    await assertNoHorizontalOverflow(page);
  });
}
