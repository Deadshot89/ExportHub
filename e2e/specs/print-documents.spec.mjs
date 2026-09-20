import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  assertNoSourceLeak,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('RC1190 P2: Gesamtdruck erzeugt im echten Browser einen nicht-leeren vollständigen Dokumentkontext',async({page,context},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Gesamtdruck-Abnahme läuft einmal auf dem Laptop-Profil.');
  test.setTimeout(60_000);

  await context.addInitScript(()=>{
    window.__RC1190_PRINT_CAPTURE__=null;
    const capture=()=>{
      try{
        window.__RC1190_PRINT_CAPTURE__={
          title:String(document.title||''),
          text:String(document.body&&document.body.innerText||''),
          html:String(document.documentElement&&document.documentElement.outerHTML||'')
        };
      }catch(_){}
    };
    try{
      Object.defineProperty(window,'print',{configurable:true,writable:true,value:capture});
    }catch(_){
      try{window.print=capture}catch(__){}
    }
  });

  const guards=[attachRuntimeGuards(page,testInfo)];
  context.on('page',popup=>guards.push(attachRuntimeGuards(popup,testInfo)));

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const seeded=await page.evaluate(()=>{
    const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    if(!state)return null;
    const lists=[state.savedShipments,state.shipments].filter(Array.isArray);
    let sh=null;
    for(const list of lists){if(list.length){sh=list[0];break}}
    if(!sh){
      sh={id:'rc1190-e2e',ref:'R1190X'};
      if(!Array.isArray(state.shipments))state.shipments=[];
      state.shipments.unshift(sh);
    }
    const id=String(sh.id||sh.shipmentId||sh.ref||sh.reference||'rc1190-e2e').trim();
    const ref=String(sh.ref||sh.reference||sh.referenceNumber||sh.shipmentRef||id).trim()||'R1190X';
    const row={
      id:'rc1190-row',
      packaging:'Euro Palette',
      type:'Euro Palette',
      packageType:'Euro Palette',
      quantity:1,
      count:1,
      amount:1,
      weight:100,
      length:120,
      width:80,
      height:120,
      description:'RC1190 Browserware',
      goodsDescription:'RC1190 Browserware',
      warenbeschreibung:'RC1190 Browserware'
    };
    Object.assign(sh,{
      id,
      shipmentId:id,
      ref,
      reference:ref,
      referenceNumber:ref,
      customerName:'RC1190 Browserkunde',
      recipient:'RC1190 Empfänger',
      recipientName:'RC1190 Empfänger',
      recipientAddress:'Teststraße 1, 59100 Teststadt, Niederlande',
      destinationCountry:'NL',
      recipientCountry:'NL',
      country:'NL',
      rows:[row],
      colli:[row],
      collis:[row],
      packages:[row],
      totalColli:1,
      totalWeight:100,
      goodsDescription:'RC1190 Browserware',
      description:'RC1190 Browserware'
    });
    state.shipment=sh;
    state.currentShipment=sh;
    state.selectedShipment=sh;
    state.currentShipmentId=id;
    state.selectedShipmentId=id;
    state.activeShipmentId=id;
    state.documentShipmentId=id;
    return{id,ref};
  });
  expect(seeded&&seeded.ref,'synthetische Drucksendung konnte nicht vorbereitet werden').toBeTruthy();

  let printButton=null;
  for(const [view,labels,required] of [
    ['documents',['Ladeliste & CMR','Dokumente & CMR','Dokumente','CMR'],/Ladeliste|CMR|Dokument/i],
    ['shipmentview',['Sendungsansicht','Sendung ansehen'],/Sendung|Dokument/i]
  ]){
    await openExportHubView(page,view,labels,required,{allowProgrammaticFallback:true});
    const action=page.locator('[data-index352-action="print-all"]').first();
    if(await action.count()&&await action.isVisible().catch(()=>false)){printButton=action;break}
    const textAction=page.locator('button,a,[role="button"]').filter({hasText:/Gesamtausgabe\s*drucken|Gesamtdruck/i}).first();
    if(await textAction.count()&&await textAction.isVisible().catch(()=>false)){printButton=textAction;break}
  }
  expect(printButton,'Gesamtdruck-Aktion ist aus der UI nicht erreichbar').toBeTruthy();

  await printButton.click({timeout:10_000});

  let capture=null;
  await expect.poll(async()=>{
    for(const p of context.pages()){
      const value=await p.evaluate(()=>window.__RC1190_PRINT_CAPTURE__||null).catch(()=>null);
      if(value&&String(value.html||'').length>500){
        capture=value;
        return String(value.html||'').length;
      }
    }
    await sleep(100);
    return 0;
  },{timeout:20_000,message:'Gesamtdruck hat keinen druckbaren Dokumentkontext erzeugt'}).toBeGreaterThan(500);

  expect(capture).toBeTruthy();
  expect(capture.html.length).toBeGreaterThan(1000);
  expect(capture.text).toContain(seeded.ref);
  expect(capture.html).toMatch(/rc352-cover/i);
  expect(capture.text).toMatch(/Ladeliste/i);
  expect(capture.text).toMatch(/CMR/i);
  expect(capture.text).toMatch(/RC1190 Browserware/i);

  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  for(const guard of guards)await assertRuntimeClean(guard,testInfo);
});
