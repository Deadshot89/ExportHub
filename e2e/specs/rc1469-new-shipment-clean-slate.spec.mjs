import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  assertNoHorizontalOverflow,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

test('RC1469 P0: Neue Sendung verwirft Alt-Daten im echten Browser',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);

  const contaminated=await page.evaluate(()=>{
    const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null;
    if(!state)throw new Error('ExportHUB-State fehlt');
    const stale=state.currentShipment||state.shipment;
    if(!stale||typeof stale!=='object')throw new Error('Aktueller Sendungs-Draft fehlt');
    Object.assign(stale,{
      ref:'ALT-REF-1469',reference:'ALT-REF-1469',shipmentRef:'ALT-REF-1469',referenceNumber:'ALT-REF-1469',
      customerId:'ALT-KD',customerNo:'ALT-4711',customerName:'ALT KUNDE',customerSearch:'ALT KUNDE',
      carrier:'ALT SPEDITION',carrierName:'ALT SPEDITION',comments:'ALT BEMERKUNG',notes:'ALT NOTIZ',
      totalWeight:850,totalColli:9,totalLdm:4.25,goodsValue:2400,status:'Abgeholt',draft:false,
      deliveryFiles:[{name:'ALT-DNC.pdf'}],deliveryNotesFiles:[{name:'ALT-DNC-2.pdf'}],
      lieferscheine:[{name:'ALT-LS.pdf'}],attachments:[{name:'ALT-ANHANG.pdf'}],
      abdFiles:[{name:'ALT-ABD.pdf'}],cmrFiles:[{name:'ALT-CMR.pdf'}],podFiles:[{name:'ALT-POD.pdf'}]
    });
    state.shipment=stale;state.currentShipment=stale;

    const remarks=Array.from(document.querySelectorAll('#rc363FixedShipmentLayout textarea, #rc573ShipmentShell textarea'));
    const remark=remarks.find(el=>/comment|remark|bemerk/i.test(((el.name||'')+' '+(el.id||'')+' '+((el.closest&&el.closest('label')||{}).textContent||''))));
    if(remark){remark.value='ALT BEMERKUNG DOM';remark.dispatchEvent(new Event('input',{bubbles:true}));remark.dispatchEvent(new Event('change',{bubbles:true}))}
    return{remarkPresent:!!remark};
  });

  const newShipment=page.locator('#rc380NewShipment').or(page.getByRole('button',{name:/^\+?\s*Neue Sendung$/i})).first();
  await expect(newShipment).toBeVisible();
  await newShipment.click();
  await expect.poll(()=>page.evaluate(()=>String((window.__EXPORTHUB_GET_STATE__?.().currentShipment||window.__EXPORTHUB_GET_STATE__?.().shipment||{}).reference||'')),{timeout:10_000}).not.toBe('ALT-REF-1469');

  const result=await page.evaluate(remarkPresent=>{
    const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};
    const sh=state.currentShipment||state.shipment||{};
    const remarks=Array.from(document.querySelectorAll('#rc363FixedShipmentLayout textarea, #rc573ShipmentShell textarea'));
    const remark=remarks.find(el=>/comment|remark|bemerk/i.test(((el.name||'')+' '+(el.id||'')+' '+((el.closest&&el.closest('label')||{}).textContent||''))));
    return{
      ref:String(sh.ref||sh.reference||''),customerId:String(sh.customerId||''),customerName:String(sh.customerName||''),
      carrier:String(sh.carrier||sh.carrierName||''),comments:String(sh.comments||sh.remarks||sh.remark||''),
      totalWeight:Number(sh.totalWeight||0),totalColli:Number(sh.totalColli||0),totalLdm:Number(sh.totalLdm||0),goodsValue:Number(sh.goodsValue||0),
      status:String(sh.status||''),draft:sh.draft===true,
      deliveryFiles:Array.isArray(sh.deliveryFiles)?sh.deliveryFiles.length:-1,
      deliveryNotesFiles:Array.isArray(sh.deliveryNotesFiles)?sh.deliveryNotesFiles.length:-1,
      lieferscheine:Array.isArray(sh.lieferscheine)?sh.lieferscheine.length:-1,
      attachments:Array.isArray(sh.attachments)?sh.attachments.length:-1,
      abdFiles:Array.isArray(sh.abdFiles)?sh.abdFiles.length:-1,
      cmrFiles:Array.isArray(sh.cmrFiles)?sh.cmrFiles.length:0,
      podFiles:Array.isArray(sh.podFiles)?sh.podFiles.length:-1,
      remarkPresent,
      remarkDom:remark?String(remark.value||''):''
    };
  },contaminated.remarkPresent);

  expect(result.ref).not.toBe('ALT-REF-1469');
  expect(result.ref).toBeTruthy();
  expect(result.customerId).toBe('');
  expect(result.customerName).toBe('');
  expect(result.carrier).toBe('');
  expect(result.comments).toBe('');
  expect(result.totalWeight).toBe(0);
  expect(result.totalColli).toBe(0);
  expect(result.totalLdm).toBe(0);
  expect(result.goodsValue).toBe(0);
  expect(result.status).toBe('Entwurf');
  expect(result.draft).toBe(true);
  expect(result.deliveryFiles).toBe(0);
  expect(result.deliveryNotesFiles).toBe(0);
  expect(result.lieferscheine).toBe(0);
  expect(result.attachments).toBe(0);
  expect(result.abdFiles).toBe(0);
  expect(result.cmrFiles).toBe(0);
  expect(result.podFiles).toBe(0);
  if(result.remarkPresent)expect(result.remarkDom).toBe('');

  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
