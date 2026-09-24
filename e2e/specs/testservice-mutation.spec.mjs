import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {
  appEntry,
  waitReady,
  settleStateSave,
  openExportHubView,
  attachRuntimeGuards,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  acknowledgeReadStateNavigationAbort,
  installE2ESession
} from '../helpers/exporthub-browser.mjs';

function headers(token){
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

test('RC1139 P0: TESTSERVICE Sitzung schreibt echten State, Reload liest ihn zurück und Übersicht zeigt die Sendung',async({page},testInfo)=>{
  test.setTimeout(180_000);
  test.skip(process.env.EXPORTHUB_E2E_MUTATION!=='1','Mutierender RC1139-Test läuft nur im TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','Mutierender RC1139-Test läuft genau einmal auf dem Laptop-Profil.');

  const runtime=attachRuntimeGuards(page,testInfo);
  const session=await installE2ESession(page);
  const ref=String(process.env.EXPORTHUB_E2E_REFERENCE||'').trim().toUpperCase();
  expect(ref).toMatch(/^E2E[A-Z0-9]{3}$/);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const read=await page.evaluate(async({token})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token});
  expect(read.status).toBe(200);
  expect(read.data?.ok).toBe(true);

  const stamp=new Date().toISOString();
  const shipment={
    id:'E2E-SHIP-'+session.runId,
    shipmentId:'E2E-SHIP-'+session.runId,
    ref,
    reference:ref,
    referenceNumber:ref,
    customerId:'E2E-CUSTOMER',
    customerName:'E2E TEST CUSTOMER',
    customer:{id:'E2E-CUSTOMER',name:'E2E TEST CUSTOMER',customerName:'E2E TEST CUSTOMER'},
    recipientName:'E2E TEST RECEIVER',
    recipientAddress:'E2E Teststraße 1, 00000 Test',
    destinationCountry:'DE',
    status:'Erstellt',
    processStatus:'Erstellt',
    createdAt:stamp,
    updatedAt:stamp,
    totalColli:1,
    totalWeight:100,
    totalLdm:0.2,
    rows:[{type:'Europalette',packaging:'Europalette',count:1,weight:100,ldm:0.2,l:120,w:80,h:100}],
    _e2eRunId:session.runId
  };

  const state=read.data?.state&&typeof read.data.state==='object'?read.data.state:{};
  const shipments=Array.isArray(state.shipments)?state.shipments.filter(x=>x&&x._e2eRunId!==session.runId):[];
  const savedShipments=Array.isArray(state.savedShipments)?state.savedShipments.filter(x=>x&&x._e2eRunId!==session.runId):[];
  shipments.push(shipment);
  savedShipments.push({...shipment});

  const saved=await page.evaluate(async({token,runId,ref,revision,shipments,savedShipments})=>{
    const response=await fetch('/api/exporthub-state?mode=save&ack=1',{
      method:'POST',
      credentials:'same-origin',
      cache:'no-store',
      headers:{
        'Content-Type':'application/json','Accept':'application/json',
        'X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,
        'X-ExportHUB-Environment':'testservice'
      },
      body:JSON.stringify({
        environment:'testservice',
        clientVersion:'RC1145-E2E',
        baseRevision:Number(revision||0),
        deviceId:'e2e-playwright',
        operationId:'RC1145-'+runId+'-'+ref,
        reason:'RC1145 browser mutation gate',
        state:{shipments,savedShipments}
      })
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,runId:session.runId,ref,revision:read.data?.revision||0,shipments,savedShipments});

  expect(saved.status).toBe(200);
  expect(saved.data?.ok).toBe(true);
  expect(saved.data?.ackOnly).toBe(true);

  await settleStateSave(page,{timeout:25_000});
  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:25_000});

  const persisted=await page.evaluate(async({token,runId,ref})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    const data=await response.json().catch(()=>({}));
    const shipments=Array.isArray(data&&data.state&&data.state.shipments)?data.state.shipments:[];
    const found=shipments.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').toUpperCase()===ref);
    return{status:response.status,ok:data&&data.ok===true,found:found?{ref:found.ref||found.reference,customerName:found.customerName||found.customer?.name,status:found.status||found.processStatus}:null};
  },{token:session.token,runId:session.runId,ref});

  expect(persisted.status).toBe(200);
  expect(persisted.ok).toBe(true);
  expect(persisted.found?.ref).toBe(ref);
  expect(persisted.found?.customerName).toMatch(/E2E TEST CUSTOMER/i);

  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#content')).toContainText(ref,{timeout:15_000});
  await expect(page.locator('#content')).toContainText(/E2E TEST CUSTOMER/i,{timeout:15_000});

  const historyWritten=await page.evaluate(({runId,ref})=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    const sh=s&&Array.isArray(s.shipments)&&s.shipments.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').toUpperCase()===ref);
    const api=window.ExportHUBShipmentHistory1071;
    if(!s||!sh||!api)return{ok:false,reason:'shipment-history-runtime-fehlt'};
    s.currentShipment=sh;
    s.currentShipmentId=sh.id||sh.shipmentId;
    s.selectedShipmentId=sh.id||sh.shipmentId;
    s.view='shipmentview';
    api.recordDocumentAction(sh,'open','ABD','ABD_'+ref+'.pdf');
    api.recordDocumentAction(sh,'print','CMR','CMR_'+ref+'.pdf');
    const currentUser=typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'?window.__EXPORTHUB_GET_CURRENT_USER__():s.currentUser;
    api.append(sh,{
      type:'mail-sent',
      label:'Versandanmeldung versendet',
      actor:api.actor(currentUser),
      details:{reference:ref,to:'e2e@example.invalid',subject:'Versandanmeldung '+ref,mailType:'registration'}
    });
    return{
      ok:true,
      labels:(sh.shipmentHistory||[]).map(x=>x&&x.label).filter(Boolean),
      actors:(sh.shipmentHistory||[]).map(x=>x&&x.actor&&x.actor.name).filter(Boolean)
    };
  },{runId:session.runId,ref});

  expect(historyWritten.ok).toBe(true);
  expect(historyWritten.labels).toEqual(expect.arrayContaining(['ABD – geöffnet','CMR – gedruckt','Versandanmeldung versendet']));
  expect(historyWritten.actors.some(Boolean)).toBe(true);
  await settleStateSave(page,{timeout:25_000});

  const historyPersisted=await page.evaluate(async({token,runId,ref})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    const data=await response.json().catch(()=>({}));
    const shipments=Array.isArray(data&&data.state&&data.state.shipments)?data.state.shipments:[];
    const found=shipments.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').toUpperCase()===ref);
    return{
      status:response.status,
      labels:Array.isArray(found&&found.shipmentHistory)?found.shipmentHistory.map(x=>x&&x.label).filter(Boolean):[],
      actors:Array.isArray(found&&found.shipmentHistory)?found.shipmentHistory.map(x=>x&&x.actor&&x.actor.name).filter(Boolean):[]
    };
  },{token:session.token,runId:session.runId,ref});

  expect(historyPersisted.status).toBe(200);
  expect(historyPersisted.labels).toEqual(expect.arrayContaining(['ABD – geöffnet','CMR – gedruckt','Versandanmeldung versendet']));
  expect(historyPersisted.actors.some(name=>/E2E TEST Browser/i.test(String(name||'')))).toBe(true);

  await openExportHubView(page,'history',['Historie'],/Historie|Aktivitätsverlauf/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#content')).toContainText(ref,{timeout:15_000});
  await expect(page.locator('#content')).toContainText('ABD – geöffnet',{timeout:15_000});
  await expect(page.locator('#content')).toContainText('CMR – gedruckt',{timeout:15_000});
  await expect(page.locator('#content')).toContainText('Versandanmeldung versendet',{timeout:15_000});
  await expect(page.locator('#content')).toContainText(/E2E TEST Browser/i,{timeout:15_000});

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await settleStateSave(page,{timeout:25_000});
  const readNavigationAborts=acknowledgeReadStateNavigationAbort(runtime);
  expect(readNavigationAborts,'Unerwartet viele beim View-Wechsel abgebrochene State-Reads').toBeLessThanOrEqual(1);
  await assertRuntimeClean(runtime,testInfo);
});


test('RC1255 P2: AVIS-Erinnerung läuft über TESTSERVICE UI, echte Mail, AVIS-Link und History',async({page},testInfo)=>{
  test.setTimeout(180_000);
  test.skip(process.env.EXPORTHUB_E2E_MUTATION!=='1','RC1255 läuft nur im mutierenden TESTSERVICE-Gate.');
  test.skip(testInfo.project.name!=='laptop','RC1255 läuft genau einmal auf dem Laptop-Profil.');

  const runtime=attachRuntimeGuards(page,testInfo);
  const session=await installE2ESession(page);
  const ref=('R'+crypto.createHash('sha256').update(session.runId).digest('hex').slice(0,5)).toUpperCase();

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const prepared=await page.evaluate(runId=>{
    const s=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};
    const customer=Array.isArray(s&&s.customers)?s.customers.find(x=>x&&x._e2eRunId===runId):null;
    return customer?{
      id:String(customer.id||''),
      name:String(customer.name||customer.customerName||''),
      email:String(customer.customerEmail||customer.email||'')
    }:null;
  },session.runId);
  expect(prepared,'RC1255 E2E-Kunde fehlt').toBeTruthy();
  expect(prepared?.id).toBeTruthy();
  expect(prepared?.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

  const initial=await page.evaluate(async token=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },session.token);
  expect(initial.status).toBe(200);
  expect(initial.data?.ok).toBe(true);

  const stamp=new Date().toISOString();
  const shipment={
    id:'E2E-REMINDER-'+session.runId,
    shipmentId:'E2E-REMINDER-'+session.runId,
    ref,
    reference:ref,
    referenceNumber:ref,
    customerId:prepared.id,
    customerName:prepared.name,
    customerEmail:prepared.email,
    recipientName:'E2E TEST RECEIVER',
    recipientAddress:'E2E Teststraße 1, 00000 Teststadt',
    destinationCountry:'DE',
    status:'Erstellt',
    processStatus:'Erstellt',
    createdAt:stamp,
    updatedAt:stamp,
    totalColli:1,
    totalWeight:100,
    totalLdm:0.2,
    rows:[{type:'Europalette',packaging:'Europalette',count:1,weight:100,ldm:0.2,l:120,w:80,h:100}],
    _e2eRunId:session.runId
  };
  const state=initial.data?.state&&typeof initial.data.state==='object'?initial.data.state:{};
  const shipments=Array.isArray(state.shipments)?state.shipments.filter(x=>x&&x.id!==shipment.id):[];
  const savedShipments=Array.isArray(state.savedShipments)?state.savedShipments.filter(x=>x&&x.id!==shipment.id):[];
  shipments.push(shipment);
  savedShipments.push({...shipment});

  const firstSave=await page.evaluate(async({token,runId,ref,revision,shipments,savedShipments})=>{
    const response=await fetch('/api/exporthub-state?mode=save&ack=1',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'},
      body:JSON.stringify({
        environment:'testservice',clientVersion:'RC1255-E2E',baseRevision:Number(revision||0),
        deviceId:'e2e-playwright',operationId:'RC1255-create-'+runId+'-'+ref,
        reason:'RC1255 Avis reminder E2E shipment',
        state:{shipments,savedShipments}
      })
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,runId:session.runId,ref,revision:initial.data?.revision||0,shipments,savedShipments});
  expect(firstSave.status).toBe(200);
  expect(firstSave.data?.ok).toBe(true);

  const issued=await page.evaluate(async({token,shipment})=>{
    const response=await fetch('/api/customer-avis',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'},
      body:JSON.stringify({action:'issue',environment:'testservice',shipmentId:shipment.id,reference:shipment.reference,shipmentSnapshot:shipment})
    });
    const data=await response.json().catch(()=>({}));
    return{status:response.status,data,url:data&&data.url?new URL(data.url,location.origin).toString():''};
  },{token:session.token,shipment});
  expect(issued.status).toBe(200);
  expect(issued.data?.ok).toBe(true);
  expect(issued.data?.issued).toBe(true);
  expect(issued.data?.token).toBeTruthy();
  expect(issued.url).toMatch(/\/customer-avis\.html\?token=/);

  const linked=await page.evaluate(async({token,runId,shipmentId,ref,avisUrl,avisToken})=>{
    const read=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    const current=await read.json().catch(()=>({}));
    if(!read.ok)return{status:read.status,data:current};
    const state=current.state&&typeof current.state==='object'?current.state:{};
    const patch=list=>(Array.isArray(list)?list:[]).map(sh=>{
      if(!sh||String(sh.id||sh.shipmentId||'')!==shipmentId)return sh;
      return Object.assign({},sh,{customerAvisUrl:avisUrl,avisUrl,customerAvisToken:avisToken,avisToken,customerAvisEnabled:true,avisEnabled:true,updatedAt:new Date().toISOString(),_e2eRunId:runId});
    });
    const shipments=patch(state.shipments),savedShipments=patch(state.savedShipments);
    const response=await fetch('/api/exporthub-state?mode=save&ack=1',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'},
      body:JSON.stringify({
        environment:'testservice',clientVersion:'RC1255-E2E',baseRevision:Number(current.revision||0),
        deviceId:'e2e-playwright',operationId:'RC1255-link-'+runId+'-'+ref,
        reason:'RC1255 Avis reminder E2E link',
        state:{shipments,savedShipments}
      })
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,runId:session.runId,shipmentId:shipment.id,ref,avisUrl:issued.url,avisToken:issued.data.token});
  expect(linked.status).toBe(200);
  expect(linked.data?.ok).toBe(true);

  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:25_000});
  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#content')).toContainText(ref,{timeout:15_000});

  const refNode=page.getByText(ref,{exact:true}).first();
  await expect(refNode).toBeVisible();
  const card=refNode.locator('xpath=ancestor::*[self::article or contains(@class,"card")][1]');
  const reminderButton=card.getByRole('button',{name:/Avis-Erinnerung senden/i}).first();
  await expect(reminderButton).toBeVisible({timeout:15_000});
  await reminderButton.click();

  const dialog=page.locator('#rc1166AvisReminderDialog');
  await expect(dialog).toBeVisible();
  const recipient=dialog.locator('[data-recipient]');
  await expect(recipient).toHaveValue(prepared.email);
  const mailResponsePromise=page.waitForResponse(response=>response.url().includes('/api/avis-reminder-mail')&&response.request().method()==='POST',{timeout:45_000});
  await dialog.locator('[data-open]').click();
  const mailResponse=await mailResponsePromise;
  const mailDiagnostic=await mailResponse.json().catch(()=>({}));
  console.log('RC1255 AVIS mail response',JSON.stringify({status:mailResponse.status(),code:String(mailDiagnostic&&mailDiagnostic.code||''),version:String(mailDiagnostic&&mailDiagnostic.version||'')}));
  const sendStatus=dialog.locator('[data-send-status]');
  await expect(sendStatus).toHaveAttribute('data-kind','ok',{timeout:45_000});
  await expect(sendStatus).toContainText(/Erinnerungsmail erfolgreich/i);

  const proof=await page.evaluate(async({token,runId,ref})=>{
    const response=await fetch('/api/exporthub-state?mode=read&full=1',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    const data=await response.json().catch(()=>({}));
    const state=data&&data.state&&typeof data.state==='object'?data.state:{};
    const sh=Array.isArray(state.shipments)?state.shipments.find(x=>x&&x._e2eRunId===runId&&String(x.ref||x.reference||'').toUpperCase()===ref):null;
    return{
      status:response.status,
      labels:Array.isArray(sh&&sh.shipmentHistory)?sh.shipmentHistory.map(x=>x&&x.label).filter(Boolean):[],
      mailTypes:Array.isArray(sh&&sh.mailHistory)?sh.mailHistory.map(x=>x&&x.type).filter(Boolean):[],
      auditTypes:Array.isArray(state.auditLog)?state.auditLog.filter(x=>x&&x.details&&String(x.details.reference||'').toUpperCase()===ref).map(x=>x.type):[]
    };
  },{token:session.token,runId:session.runId,ref});
  expect(proof.status).toBe(200);
  expect(proof.labels).toContain('Avis-Erinnerung versendet');
  expect(proof.mailTypes).toContain('avis-reminder');
  expect(proof.auditTypes).toContain('AVIS_REMINDER_SENT');

  const avisPage=await page.request.get(issued.url);
  expect(avisPage.status()).toBe(200);
  expect(await avisPage.text()).toMatch(/Lieferavis|Abholung|Avis/i);

  const authorize=await page.request.post(new URL('/api/customer-avis',issued.url).toString(),{
    headers:{'Content-Type':'application/json','X-ExportHUB-Environment':'testservice'},
    data:{action:'authorize',token:issued.data.token,reference:ref,environment:'testservice'}
  });
  expect(authorize.status()).toBe(200);
  const authorized=await authorize.json().catch(()=>({}));
  expect(String(authorized.reference||authorized.ref||'').toUpperCase()).toBe(ref);
  expect(authorized.session).toBeTruthy();

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await settleStateSave(page,{timeout:25_000});
  const readNavigationAborts=acknowledgeReadStateNavigationAbort(runtime);
  expect(readNavigationAborts,'RC1255: unerwartet viele abgebrochene State-Reads').toBeLessThanOrEqual(1);
  await assertRuntimeClean(runtime,testInfo);
});
