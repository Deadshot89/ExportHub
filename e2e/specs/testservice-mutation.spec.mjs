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
  await assertRuntimeClean(runtime,testInfo);
});
