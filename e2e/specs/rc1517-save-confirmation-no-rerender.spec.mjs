import {test,expect} from '@playwright/test';
import {
  appEntry,
  waitReady,
  openExportHubView,
  attachRuntimeGuards,
  assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

async function openShipment(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'shipment',['Sendung erstellen','Neue Sendung','Sendung anlegen'],/Kunde|Empfänger|Colli|Lademeter/i,{allowProgrammaticFallback:true});
  await expect(page.locator('#rc363FixedShipmentLayout')).toBeVisible();
  await page.evaluate(()=>{
    window.__RC1517_LAYOUT_NODE__=document.getElementById('rc363FixedShipmentLayout');
  });
}

async function layoutIdentity(page){
  return page.evaluate(()=>{
    const current=document.getElementById('rc363FixedShipmentLayout');
    return {
      same:!!window.__RC1517_LAYOUT_NODE__&&window.__RC1517_LAYOUT_NODE__===current,
      connected:!!current&&current.isConnected,
      view:String(document.body?.getAttribute('data-exporthub-view')||document.getElementById('content')?.getAttribute('data-view')||'')
    };
  });
}

test.describe('RC1517: Save-Confirmation ohne Neurender im echten Chromium',()=>{
  test.beforeEach(({},testInfo)=>{
    test.skip(testInfo.project.name!=='laptop','Save-Confirmation-DOM-Identität wird einmal reproduzierbar in Chromium geprüft.');
  });

  test('Negativkontrolle erkennt einen absichtlich ersetzten Layout-Knoten',async({page})=>{
    await openShipment(page);
    const before=await layoutIdentity(page);
    expect(before.same).toBe(true);
    await page.evaluate(()=>{
      const current=document.getElementById('rc363FixedShipmentLayout');
      if(!current)throw new Error('Shipment-Layout fehlt');
      current.replaceWith(current.cloneNode(true));
    });
    const after=await layoutIdentity(page);
    expect(after.same,'Negativkontrolle muss einen echten DOM-Ersatz erkennen').toBe(false);
    expect(after.connected).toBe(true);
  });

  test('lokale No-Merge save-confirmation behält dieselbe Shipment-Layout-Instanz',async({page},testInfo)=>{
    const runtime=attachRuntimeGuards(page,testInfo);
    await openShipment(page);
    const before=await layoutIdentity(page);
    expect(before.same).toBe(true);

    const eventResult=await page.evaluate(()=>{
      const target=document.getElementById('rc363FixedShipmentLayout');
      const content=document.getElementById('content');
      let removedTarget=0,addedReplacement=0;
      const observer=new MutationObserver(records=>{
        for(const record of records){
          for(const node of record.removedNodes){
            if(node===target||(node.nodeType===1&&node.contains?.(target)))removedTarget++;
          }
          for(const node of record.addedNodes){
            if(node.nodeType===1&&(node.id==='rc363FixedShipmentLayout'||node.querySelector?.('#rc363FixedShipmentLayout')))addedReplacement++;
          }
        }
      });
      if(content)observer.observe(content,{childList:true,subtree:true});
      window.__RC1517_OBSERVER__=observer;
      window.__RC1517_MUTATIONS__=()=>({removedTarget,addedReplacement});
      window.dispatchEvent(new CustomEvent('exporthub:sync',{detail:{remote:true,reason:'save-confirmation',concurrentMerge:false}}));
      return true;
    });
    expect(eventResult).toBe(true);

    // Altpfade planten u. a. eine Nachbearbeitung nach 220 ms. 700 ms decken diesen Pfad bewusst ab.
    await page.waitForTimeout(700);
    const after=await layoutIdentity(page);
    const mutations=await page.evaluate(()=>{
      const result=typeof window.__RC1517_MUTATIONS__==='function'?window.__RC1517_MUTATIONS__():{};
      try{window.__RC1517_OBSERVER__?.disconnect()}catch(_){}
      return result;
    });

    expect(after.same,'No-Merge save-confirmation darf das montierte Sendungslayout nicht ersetzen').toBe(true);
    expect(after.connected,'Shipment-Layout muss nach der Save-Bestätigung verbunden bleiben').toBe(true);
    expect(mutations.removedTarget||0,'Save-Confirmation darf den Layout-Knoten nicht aus dem DOM entfernen').toBe(0);
    expect(mutations.addedReplacement||0,'Save-Confirmation darf keinen Ersatz für das Shipment-Layout einsetzen').toBe(0);
    await expect(page.locator('#rc363BlockCustomer')).toBeVisible();
    await expect(page.locator('#rc363BlockColli')).toBeVisible();
    await expect(page.locator('#rc363BlockDocuments')).toBeVisible();
    await expect(page.locator('#rc543MailArea')).toBeVisible();
    await assertRuntimeClean(runtime,testInfo);
  });
});
