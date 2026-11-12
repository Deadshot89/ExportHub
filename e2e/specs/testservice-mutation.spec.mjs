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

test('RC1139 P0: TESTSERVICE Kunde und Sendung speichern, Reload und Azure-Readback',async({page},testInfo)=>{
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
    // Only the revision is needed before the additive save; avoid a
    // full multi-megabyte team-state download.
    const response=await fetch('/api/exporthub-state?mode=meta',{
      method:'GET',credentials:'same-origin',cache:'no-store',
      headers:{'Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'}
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token});
  // RC1674: report only stable API error codes, never token, message or body.
  const readErrorCode=String(read.data?.code||'UNKNOWN').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,64);
  expect(read.status,`TESTSERVICE metadata API HTTP ${read.status} / ${readErrorCode}`).toBe(200);
  expect(read.data?.ok).toBe(true);

  const stamp=new Date().toISOString();
  const reminderEligibleAt=new Date(Date.now()-7*24*60*60*1000).toISOString();
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
    avisFirstMailSentAt:reminderEligibleAt,
    avisInitialMailSentAt:reminderEligibleAt,
    totalColli:1,
    totalWeight:100,
    totalLdm:0.2,
    rows:[{type:'Europalette',packaging:'Europalette',count:1,weight:100,ldm:0.2,l:120,w:80,h:100}],
    _e2eRunId:session.runId
  };

  // P0: Persist and reload a customer independently from the shipment.
  // The fixture cleanup removes only rows tagged with this E2E run ID.
  const customer={
    id:'E2E-CUSTOMER-SAVE-'+session.runId,
    account:'E2E-SAVE-'+session.runId,
    name:'E2E AZURE CUSTOMER '+session.runId,
    customerName:'E2E AZURE CUSTOMER '+session.runId,
    country:'DE',
    active:true,
    createdAt:stamp,
    updatedAt:stamp,
    _e2eRunId:session.runId
  };
  // RC1629: small additive payloads. The authoritative server merges by
  // stable shipment/customer identity, preserving all unrelated records.
  // Sending full arrays previously exceeded the 30-MB Azure SWA request cap.
  const customers=[customer];
  const shipments=[shipment];
  const savedShipments=[{...shipment}];

  const saved=await page.evaluate(async({token,runId,ref,revision,shipments,savedShipments,customers})=>{
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
        state:{shipments,savedShipments,customers}
      })
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,runId:session.runId,ref,revision:read.data?.revision||0,shipments,savedShipments,customers});

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
    const persistedCustomers=Array.isArray(data&&data.state&&data.state.customers)?data.state.customers:[];
    const customer=persistedCustomers.find(x=>x&&x.id==='E2E-CUSTOMER-SAVE-'+runId&&x._e2eRunId===runId);
    return{
      status:response.status,
      ok:data&&data.ok===true,
      found:found?{ref:found.ref||found.reference,customerName:found.customerName||found.customer?.name,status:found.status||found.processStatus}:null,
      customer:customer?{id:customer.id,name:customer.name,account:customer.account}:null
    };
  },{token:session.token,runId:session.runId,ref});

  expect(persisted.status).toBe(200);
  expect(persisted.ok).toBe(true);
  expect(persisted.customer?.id).toBe('E2E-CUSTOMER-SAVE-'+session.runId);
  expect(persisted.customer?.name).toBe('E2E AZURE CUSTOMER '+session.runId);
  expect(persisted.customer?.account).toBe('E2E-SAVE-'+session.runId);
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


test('RC1255 P2: AVIS-Erinnerung läuft über TESTSERVICE UI, Outlook-Entwurf, AVIS-Link und History',async({page},testInfo)=>{
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
    // Only the revision is required here. Avoid a ~43 MB full-state response.
    const response=await fetch('/api/exporthub-state?mode=meta',{
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
    // RC1358: Dieser E2E-Fall prüft ausdrücklich die Erinnerung. Die Erstmail muss daher
    // mindestens drei Arbeitstage zurückliegen, sonst zeigt die UI korrekt „Lieferavis senden“.
    avisFirstMailSentAt:new Date(Date.now()-7*24*60*60*1000).toISOString(),
    avisInitialMailSentAt:new Date(Date.now()-7*24*60*60*1000).toISOString(),
    totalColli:1,
    totalWeight:100,
    totalLdm:0.2,
    rows:[{type:'Europalette',packaging:'Europalette',count:1,weight:100,ldm:0.2,l:120,w:80,h:100}],
    _e2eRunId:session.runId
  };
  // This API merges shipment rows by stable id/reference. Never POST all
  // existing shipments: Azure Static Web Apps limits requests to 30 MB.
  // An additive one-record delta also preserves unrelated shipments.
  const shipments=[shipment];
  const savedShipments=[{...shipment}];

  const firstSave=await page.evaluate(async({token,runId,ref,revision,shipments,savedShipments})=>{
    // Fixture preparation writes outside this API's worker cache. A default POST checks the current team ETag before authenticating.
    const response=await fetch('/api/exporthub-state?ack=1',{
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
  expect(firstSave.status,'RC1255 fixture save: '+String(firstSave.data?.code||'')+' '+String(firstSave.data?.message||'')).toBe(200);
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
  expect(issued.url).toMatch(/^https:\/\/ashy-grass-065b7b803-testservice\.westeurope\.6\.azurestaticapps\.net\/customer-avis\.html\?token=[A-Za-z0-9_-]+&environment=testservice(?:&|$)/);

  const linked=await page.evaluate(async({token,runId,shipment,ref,avisUrl,avisToken,revision})=>{
    // Merge a single shipment delta; a full-state POST exceeds the 30 MB
    // Static Web Apps request limit when team-state grows large.
    const linkedShipment=Object.assign({},shipment,{
      customerAvisUrl:avisUrl,avisUrl,customerAvisToken:avisToken,avisToken,
      customerAvisEnabled:true,avisEnabled:true,updatedAt:new Date().toISOString(),
      _e2eRunId:runId
    });
    const response=await fetch('/api/exporthub-state?ack=1',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':'testservice'},
      body:JSON.stringify({
        environment:'testservice',clientVersion:'RC1255-E2E',baseRevision:Number(revision||0),
        deviceId:'e2e-playwright',operationId:'RC1255-link-'+runId+'-'+ref,
        reason:'RC1255 Avis reminder E2E link',
        state:{shipments:[linkedShipment],savedShipments:[linkedShipment]}
      })
    });
    return{status:response.status,data:await response.json().catch(()=>({}))};
  },{token:session.token,runId:session.runId,shipment,ref,avisUrl:issued.url,avisToken:issued.data.token,revision:firstSave.data?.revision||initial.data?.revision||0});
  expect(linked.status,'RC1255 fixture link save: '+String(linked.data?.code||'')+' '+String(linked.data?.message||'')).toBe(200);
  expect(linked.data?.ok).toBe(true);

  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await settleStateSave(page,{timeout:25_000});
  await openExportHubView(page,'shipmentoverview',['Sendungsübersicht','Sendungen'],/Sendungsübersicht|Sendungen/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#content')).toContainText(ref,{timeout:15_000});

  const refNode=page.getByText(ref,{exact:true}).first();
  await expect(refNode).toBeVisible();
  const card=refNode.locator('xpath=ancestor::*[self::article or contains(@class,"card")][1]');
  const reminderButton=card.getByRole('button',{name:/Avis-Erinnerung in Outlook öffnen/i}).first();
  await expect(reminderButton).toBeVisible({timeout:15_000});
  await reminderButton.click();

  const dialog=page.locator('#rc1166AvisReminderDialog');
  await expect(dialog).toBeVisible();
  const recipient=dialog.locator('[data-recipient]');
  await expect(recipient).toHaveValue(prepared.email);
  const serverMailRequests=[];
  page.on('request',request=>{if(request.url().includes('/api/avis-reminder-mail'))serverMailRequests.push(request.url());});
  await page.evaluate(()=>{
    window.__rc1434Drafts=[];
    document.addEventListener('click',event=>{
      const a=event.target.closest&&event.target.closest('a[data-rc1166-mail-draft]');
      if(a){window.__rc1434Drafts.push(a.href);event.preventDefault();}
    },true);
  });
  await dialog.locator('[data-open]').click();
  const sendStatus=dialog.locator('[data-send-status]');
  await expect(sendStatus).toHaveAttribute('data-kind','ok');
  await expect(sendStatus).toContainText(/Mailentwurf.*vorbereitet/i);
  const drafts=await page.evaluate(()=>window.__rc1434Drafts);
  expect(drafts).toHaveLength(1);
  const draft=new URL(drafts[0]);
  expect(draft.protocol).toBe('mailto:');
  expect(decodeURIComponent(draft.pathname)).toBe(prepared.email);
  expect(draft.searchParams.get('subject')).toBe('Erinnerung – Lieferavis '+ref);
  expect(draft.searchParams.get('body')).toContain(issued.url+'&lang=de');
  const draftCc=(draft.searchParams.get('cc')||'').split(';').map(email=>email.trim().toLowerCase()).filter(Boolean);
  // Der TESTSERVICE-Kunde hat bewusst keinen manuellen CC im Kundenordner.
  expect(draftCc).toEqual([]);
  // Large TESTSERVICE team state can take longer than the historical 18 s
  // flush cap. Keep the live Azure persistence/readback mandatory, bounded.
  await settleStateSave(page,{timeout:85_000});

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
  expect(proof.labels).toContain('Avis-Erinnerung in Outlook geöffnet');
  expect(proof.labels).not.toContain('Avis-Erinnerung versendet');
  expect(proof.mailTypes).not.toContain('avis-reminder');
  expect(proof.auditTypes).not.toContain('AVIS_REMINDER_SENT');
  expect(serverMailRequests).toEqual([]);

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


test('RC1985 P0: confirmed task deletion survives two independent TESTSERVICE browser contexts',async({page,browser},testInfo)=>{
  test.setTimeout(240_000);
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1'||process.env.EXPORTHUB_E2E_MUTATION!=='1',
    'Only the signed, mutating TESTSERVICE main gate may exercise the Azure-backed deletion proof.');
  test.skip(testInfo.project.name!=='laptop','Run the Azure-backed two-client proof only once.');

  const session=await installE2ESession(page);
  const id='E2E-TASK-'+session.runId;
  const freshId='E2E-TASK-FRESH-'+session.runId;
  const at=new Date().toISOString();
  const task={id,title:'RC1985 E2E two-client delete '+session.runId,
    sourceType:'manual',area:'E2E TESTSERVICE',status:'open',
    createdAt:at,updatedAt:at,_e2eRunId:session.runId};
  const freshTask={id:freshId,title:'RC1985 E2E independent task '+session.runId,
    sourceType:'manual',area:'E2E TESTSERVICE',status:'open',
    createdAt:at,updatedAt:at,_e2eRunId:session.runId};

  async function stateRequest(p,mode,payload){
    return p.evaluate(async ({mode,payload,token})=>{
      const saving=mode==='save';
      const response=await fetch('/api/exporthub-state?mode='+mode+(saving?'&ack=1':''),{
        method:saving?'POST':'GET',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','Accept':'application/json',
          'X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,
          'X-ExportHUB-Environment':'testservice'},
        body:saving?JSON.stringify(payload):undefined
      });
      const data=await response.json().catch(()=>({}));
      return{status:response.status,ok:data.ok===true,revision:Number(data.revision||0),
        ackOnly:data.ackOnly===true,concurrentMerge:data.concurrentMerge===true,
        code:String(data.code||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,64)};
    },{mode,payload,token:session.token});
  }
  async function readTaskProof(p){
    return p.evaluate(async ({token,id,freshId})=>{
      const response=await fetch('/api/exporthub-state?mode=read&full=1',{
        method:'GET',credentials:'same-origin',cache:'no-store',
        headers:{'Accept':'application/json','X-ExportHUB-Token':token,
          'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,
          'X-ExportHUB-Environment':'testservice'}
      });
      const data=await response.json().catch(()=>({}));
      const s=data.state||{},tasks=Array.isArray(s.tasks)?s.tasks:[],
        tombstones=Array.isArray(s._teamSyncMeta&&s._teamSyncMeta.tombstones)?
          s._teamSyncMeta.tombstones:[];
      return{status:response.status,ok:data.ok===true,
        deletedExists:tasks.some(t=>t&&t.id===id),
        independentExists:tasks.some(t=>t&&t.id===freshId),
        tombstoneConfirmed:tombstones.some(t=>t&&t.collection==='tasks'&&
          t.id===id&&t.explicitUserAction===true)};
    },{token:session.token,id,freshId});
  }

  const guardA=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  const initial=await stateRequest(page,'meta');
  expect(initial.status).toBe(200);
  expect(initial.ok).toBe(true);
  const created=await stateRequest(page,'save',{
    environment:'testservice',clientVersion:'RC1985-E2E',
    baseRevision:initial.revision,deviceId:'rc1985-first',
    operationId:'RC1985-CREATE-'+session.runId,
    reason:'RC1985 synthetic two-client deletion proof',
    state:{tasks:[task]}
  });
  expect(created.status).toBe(200);
  expect(created.ackOnly).toBe(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);

  const otherContext=await browser.newContext({
    baseURL:process.env.EXPORTHUB_E2E_BASE_URL||'http://127.0.0.1:4173'
  });
  try{
    const other=await otherContext.newPage();
    const guardB=attachRuntimeGuards(other,testInfo);
    await installE2ESession(other);
    await other.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(other);
    await expect.poll(()=>other.evaluate(taskId=>
      (window.__EXPORTHUB_GET_STATE__?.().tasks||[]).some(t=>t&&t.id===taskId),id),
      {timeout:25_000}).toBe(true);

    await openExportHubView(page,'taskdetail',['Aufgabenansicht'],/Aufgaben/i,
      {allowProgrammaticFallback:true});
    await expect(page.locator('[data-rc1570-tv-search]')).toBeVisible();
    await page.locator('[data-rc1570-tv-search]').fill(task.title);
    const deleteButton=page.locator('[data-rc1570-tv-delete="'+id+'"]');
    await expect(deleteButton).toBeVisible({timeout:20_000});
    page.once('dialog',dialog=>dialog.accept());
    await deleteButton.click();
    await expect(page.locator('.rc1570-tv-saved')).toBeVisible({timeout:55_000});
    await settleStateSave(page,{timeout:35_000});
    const afterDelete=await readTaskProof(page);
    expect(afterDelete.status).toBe(200);
    expect(afterDelete.ok).toBe(true);
    expect(afterDelete.deletedExists,'Server must confirm the user deletion').toBe(false);
    expect(afterDelete.tombstoneConfirmed,'Azure must retain an explicit deletion marker').toBe(true);

    // The other context still holds the now-stale original task, and saves
    // a different new task with its old revision and a distinct device ID.
    const stale=await stateRequest(other,'save',{
      environment:'testservice',clientVersion:'RC1985-E2E',
      baseRevision:created.revision,deviceId:'rc1985-stale-second',
      operationId:'RC1985-STALE-'+session.runId,
      reason:'RC1985 synthetic second client stale save',
      state:{tasks:[{...task,updatedAt:new Date(Date.now()+10000).toISOString()},freshTask]}
    });
    expect(stale.status).toBe(200);
    expect(stale.ackOnly).toBe(true);
    expect(stale.concurrentMerge,'The second client must exercise a stale-revision merge').toBe(true);

    await other.reload({waitUntil:'domcontentloaded'});
    await waitReady(other);
    const final=await readTaskProof(other);
    expect(final.status).toBe(200);
    expect(final.ok).toBe(true);
    expect(final.deletedExists,'A stale client must not restore the deleted task').toBe(false);
    expect(final.independentExists,'Unrelated work from the second client must survive').toBe(true);
    expect(final.tombstoneConfirmed,'Explicit deletion must survive the second write').toBe(true);
    await assertRuntimeClean(guardA,testInfo);
    await assertRuntimeClean(guardB,testInfo);
  }finally{
    await otherContext.close();
  }
});
