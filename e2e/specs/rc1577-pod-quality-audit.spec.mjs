import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1577: the admin POD audit only reports first. After confirmation it regenerates PODs in the browser and
// puts PODs that could not be repaired on "Abgeholt" with a review flag that the canonical status respects.
test('RC1577: POD-Prüfung berichtet zuerst, erzeugt nach Bestätigung neu und setzt den Rest auf Abgeholt',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Admin-Ablauf wird einmal im echten Chromium geprüft.');
  test.setTimeout(120_000);
  page.on('dialog',dialog=>dialog.accept());

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const refs=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=200;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,200);ctx.strokeStyle='#000';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(20,100);ctx.lineTo(580,120);ctx.stroke();
    const sig=canvas.toDataURL('image/jpeg',.8);
    const list=window.__EXPORTHUB_GET_STATE__().shipments.slice(0,2);
    list.forEach((sh,i)=>{
      const pickup={complete:true,driverName:'Fahrer '+i,licensePlate:'KÜN R 76'+i,loaderName:'Verlader',confirmedAt:'2026-10-17T08:41:00.000Z',signatureData:sig,returnedEuroPallets:0};
      Object.assign(sh,{status:'POD vorhanden',processStatus:'POD vorhanden',freigabe:'Abgeholt',pickedUp:true,pickupConfirmed:true,pickupToken:'tok'+i,driverName:pickup.driverName,
        signatureData:sig,driverSignature:sig,pickupDriverSignature:sig,signatureAvailable:true,pickupConfirmedAt:pickup.confirmedAt,pickupHistory:[pickup]});
    });
    const ref=sh=>String(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id).trim().toUpperCase();
    const [regenerateRef,reviewRef]=list.map(ref);
    // The demo build answers /api/* itself, so the two endpoints are mocked at fetch level.
    window.__rc1577={auditCalls:[],backupCalls:[]};
    const original=window.fetch,reply=body=>Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}}));
    const row=(reference,verdict,reason,extra)=>Object.assign({reference,customer:'Fake Kunde',confirmedAt:'2026-10-17T08:41:00.000Z',verdict,reason,files:[]},extra||{});
    window.fetch=function(input,init){
      const url=String(input&&input.url||input);
      if(/\/api\/pod-quality-audit/.test(url)){
        const body=JSON.parse(init&&init.body||'{}');window.__rc1577.auditCalls.push(body);
        const rows=Array.isArray(body.references)&&body.references.length
          ?body.references.map(r=>row(r,'ok','CURRENT_LAYOUT'))
          :[row(regenerateRef,'regenerate','OLD_LAYOUT'),row(reviewRef,'review','POD_NOT_READABLE',{missing:'SIGNATURE_NOT_STORED'}),row('OKREF1','ok','CURRENT_LAYOUT')];
        return reply({ok:true,version:'RC1577',rows,nextCursor:null});
      }
      if(/\/api\/pod-backup(?:$|[?#])/.test(url)){
        const body=JSON.parse(init&&init.body||'{}');window.__rc1577.backupCalls.push({reference:body.reference,renderLayout:body.renderLayout,hasPdf:String(body.pdfBase64||'').length>1000,source:body.source});
        return reply({ok:true,saved:true,status:'saved',savedAt:new Date().toISOString(),fileName:'POD_'+body.reference+'.pdf',hash:'abc'});
      }
      return original.apply(this,arguments);
    };
    return [regenerateRef,reviewRef];
  });
  const [regenerateRef,reviewRef]=refs;
  const calls=()=>page.evaluate(()=>window.__rc1577);

  expect(await page.evaluate(()=>!!window.ExportHUBPodQualityAudit&&window.EXPORTHUB_POD_RENDER_LAYOUT)).toBe('RC1595');
  // RC1595: the unrelated global notification-hint layer can cross this click coordinate.
  // Use accessible keyboard activation to verify the POD modal workflow without bypassing app handlers.
  await page.locator('#podBackupBtn').focus();
  await page.keyboard.press('Enter');
  await page.locator('#rc1577PodAuditOpen').click();
  await expect(page.locator('#rc1577PodAuditModal')).toBeVisible();
  await page.locator('#rc1577PodAuditStart').click();
  await expect(page.locator('#rc1577PodAuditModal [data-verdict="regenerate"] tr[data-reference="'+regenerateRef+'"]')).toBeVisible();
  await expect(page.locator('#rc1577PodAuditModal [data-verdict="review"] tr[data-reference="'+reviewRef+'"]')).toBeVisible();
  await expect(page.locator('#rc1577PodAuditModal [data-rc1577-ok-count="1"]')).toBeVisible();

  // Report only: nothing changed yet.
  expect((await calls()).backupCalls).toEqual([]);
  expect(await page.evaluate(r=>window.__EXPORTHUB_GET_STATE__().shipments.find(s=>String(s.ref||s.reference||s.shipmentRef||s.referenceNumber||s.id).trim().toUpperCase()===r).podReviewRequired,reviewRef)).toBeFalsy();

  await page.locator('#rc1577PodAuditApply').click();
  await expect(page.locator('#rc1577PodAuditModal [data-verdict="flagged"] tr[data-reference="'+reviewRef+'"]')).toBeVisible({timeout:90_000});

  const {auditCalls,backupCalls}=await calls();
  expect(backupCalls).toEqual([{reference:regenerateRef,renderLayout:'RC1595',hasPdf:true,source:'admin-confirmed-pod-regenerate'}]);
  expect(auditCalls.some(c=>Array.isArray(c.references)&&c.references[0]===regenerateRef)).toBe(true);

  const statusOf=r=>page.evaluate(ref=>{
    const sh=window.__EXPORTHUB_GET_STATE__().shipments.find(s=>String(s.ref||s.reference||s.shipmentRef||s.referenceNumber||s.id).trim().toUpperCase()===ref);
    try{window.ExportHUBMailStatus373.recalculate(sh)}catch(_){}
    return{status:sh.status,flag:sh.podReviewRequired===true,canonical:window.ExportHUBRC543.computeShipmentStatus(sh)};
  },r);
  expect(await statusOf(reviewRef)).toEqual({status:'Abgeholt',flag:true,canonical:'Abgeholt'});
  expect((await statusOf(regenerateRef)).status).toBe('POD vorhanden');

  await page.locator('[data-rc1577-release="'+reviewRef+'"]').click();
  expect(await statusOf(reviewRef)).toEqual({status:'POD vorhanden',flag:false,canonical:'POD vorhanden'});

  // RC1595: target a specific 6-character shipment (e.g. production issue 8LSUHW) without scanning the full archive.
  await page.locator('#rc1577PodAuditReference').fill(regenerateRef);
  await page.locator('#rc1577PodAuditScanRef').click();
  await expect(page.locator('#rc1577PodAuditForce')).toBeVisible();
  await page.locator('#rc1577PodAuditForce').click();
  await expect(page.locator('#rc1577PodAuditModal [data-verdict="regenerate"] tr[data-reference="'+regenerateRef+'"]')).toBeVisible();
  expect((await calls()).backupCalls).toHaveLength(1); // queueing alone must never overwrite the existing POD
});
