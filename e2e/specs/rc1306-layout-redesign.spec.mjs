import {test,expect} from '@playwright/test';
import {
  appEntry, waitReady, openExportHubView, assertNoHorizontalOverflow,
  assertNoSourceLeak, attachRuntimeGuards, assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

async function openShipment(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger/i);
  await expect(page.locator('#rc363BlockCustomer')).toBeVisible();
  await expect(page.locator('#rc363BlockShipment')).toBeVisible();
}

const DESIGNS=['classic','premium','neu','frost','graphit','azur','stahl','polar'];

async function setDesign(page,design){
  await page.evaluate(value=>{
    if(!window.ExportHUBDesignSwitcher)throw new Error('ExportHUBDesignSwitcher missing');
    window.ExportHUBDesignSwitcher.apply(value);
  },design);
  await expect.poll(()=>page.evaluate(()=>window.ExportHUBDesignSwitcher.current())).toBe(design);
}

async function commonAssertions(page){
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  const duplicates=await page.evaluate(()=>{
    const ids=['rc363BlockCustomer','rc363BlockShipment','rc573ColliCard','rc363BlockDocuments','rc363BlockStow','rc363BlockAbdDecision','rc363BlockMail','rc363BlockActions'];
    return ids.map(id=>({id,count:document.querySelectorAll('#'+id).length}));
  });
  for(const row of duplicates)expect(row.count,row.id+' duplicated').toBeLessThanOrEqual(1);
}

test('RC1310/RC1930: Design-Wechsel baut keinen Alt-Layout-Arbeitsbereich auf',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'classic');
  await page.evaluate(()=>{
    window.__RC1310_LAYOUT_ADDS__=0;
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes||[]){
          if(node.nodeType!==1)continue;
          if(node.id==='rc1306Workspace')window.__RC1310_LAYOUT_ADDS__++;
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.__RC1310_LAYOUT_OBSERVER__=observer;
  });
  for(const design of DESIGNS)await setDesign(page,design);
  await page.waitForTimeout(220);
  const builds=await page.evaluate(()=>{
    window.__RC1310_LAYOUT_OBSERVER__?.disconnect();
    return window.__RC1310_LAYOUT_ADDS__;
  });
  expect(builds).toBe(0);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1412: Neue Sendung setzt den Entwurf zurück ohne die montierte Sendungsansicht neu aufzubauen',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  await setDesign(page,'classic');

  const before=await page.evaluate(()=>{
    window.__RC1412_LAYOUT_NODE__=document.getElementById('rc363FixedShipmentLayout')||document.getElementById('rc573ShipmentShell');
    window.__RC1412_CUSTOMER_NODE__=document.getElementById('rc363BlockCustomer');
    window.__RC1412_CONTENT_NODE__=document.getElementById('content');
    const sh=window.__EXPORTHUB_GET_STATE__?.().shipment||{};
    return{ref:String(sh.ref||sh.reference||'').trim().toUpperCase()};
  });
  expect(before.ref).toMatch(/^[A-Z0-9]{6}$/);

  const newShipment=page.locator('#rc380NewShipment').or(page.getByRole('button',{name:/^\+?\s*Neue Sendung$/i})).first();
  await expect(newShipment).toBeVisible();
  await newShipment.evaluate(button=>button.click());
  await expect(page.locator('#rc363BlockCustomer')).toBeVisible();

  const after=await page.evaluate(()=>({
    layoutPreserved:window.__RC1412_LAYOUT_NODE__===(document.getElementById('rc363FixedShipmentLayout')||document.getElementById('rc573ShipmentShell')),
    customerPreserved:window.__RC1412_CUSTOMER_NODE__===document.getElementById('rc363BlockCustomer'),
    contentPreserved:window.__RC1412_CONTENT_NODE__===document.getElementById('content'),
    ref:String((window.__EXPORTHUB_GET_STATE__?.().shipment||{}).ref||'').trim().toUpperCase(),
    fresh:(window.__EXPORTHUB_GET_STATE__?.().shipment||{}).__rc562Fresh===true
  }));

  expect(after.layoutPreserved,'Sendungs-Layout wurde beim neuen Entwurf ersetzt').toBe(true);
  expect(after.customerPreserved,'Kundenblock wurde beim neuen Entwurf ersetzt').toBe(true);
  expect(after.contentPreserved,'#content wurde beim neuen Entwurf ersetzt').toBe(true);
  expect(after.ref).toMatch(/^[A-Z0-9]{6}$/);
  expect(after.fresh).toBe(true);
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1930: entfernte Designs Modern Business, Glass und Neon Night fallen auf Original zurück',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  for(const legacy of ['modern','glass','neon']){
    await page.evaluate(value=>window.ExportHUBDesignSwitcher.apply(value),legacy);
    await expect.poll(()=>page.evaluate(()=>window.ExportHUBDesignSwitcher.current())).toBe('classic');
    await expect(page.locator('html')).toHaveAttribute('data-eh-design','classic');
    await expect(page.locator('html')).not.toHaveAttribute('data-eh-layout-mode',/./);
    await expect(page.locator('#rc1306Workspace')).toHaveCount(0);
  }
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1930: jedes Design behält alle Bausteine der Sendungserfassung genau einmal',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  for(const design of DESIGNS){
    await setDesign(page,design);
    await page.waitForTimeout(150);
    await expect(page.locator('#rc363BlockCustomer'),design).toHaveCount(1);
    await expect(page.locator('#rc363BlockShipment'),design).toHaveCount(1);
    await commonAssertions(page);
  }
  await assertRuntimeClean(runtime,testInfo);
});

test('RC1306/RC1930: Rückkehr zu Original stellt die ursprüngliche Struktur wieder her',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openShipment(page);
  const original=await page.locator('#rc363BlockCustomer').evaluate(el=>({parentId:el.parentElement?el.parentElement.id:'',parentClass:el.parentElement?el.parentElement.className:''}));
  for(const design of ['azur','polar','neu']){
    await setDesign(page,design);
    await setDesign(page,'classic');
    await expect(page.locator('html')).not.toHaveAttribute('data-eh-palette',/./);
    await expect(page.locator('html')).not.toHaveAttribute('data-eh-layout',/./);
    const restored=await page.locator('#rc363BlockCustomer').evaluate(el=>({parentId:el.parentElement?el.parentElement.id:'',parentClass:el.parentElement?el.parentElement.className:''}));
    expect(restored,design).toEqual(original);
  }
  await commonAssertions(page);
  await assertRuntimeClean(runtime,testInfo);
});
