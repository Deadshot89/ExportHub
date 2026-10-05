import {test,expect} from '@playwright/test';
import fs from 'node:fs';

test('RC1436: Übersicht öffnet Outlook-AVIS mit ausschließlich manuellem Kundenordner-CC',async({page})=>{
 const mailRequests=[];
 page.on('request',request=>{if(request.url().includes('/api/avis-reminder-mail'))mailRequests.push(request.url());});
 await page.setContent('<html><head></head><body data-exporthub-view="shipmentoverview"><main id="content"><article class="shipment-card" data-shipment-id="S1"><h2>ABC123</h2><div class="actions"></div></article></main></body></html>');
 const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
 await page.evaluate(de=>{
  const sh={id:'S1',reference:'ABC123',customerId:'SE1',customerName:'Essentra Sweden',customerAvisToken:'abc',customerAvisUrl:'https://www.exporthub360.de/avis/abc',avisFirstMailSentAt:'2026-09-01T10:00:00Z'};
  window.appState={shipment:{id:'OTHER',reference:'OTHER1'},shipments:[sh],savedShipments:[{...sh}],customers:[{id:'SE1',name:'Essentra Sweden',customerEmail:'customer@example.com',carrierEmail:'carrier@example.com',salesContacts:[{email:'sales@example.com'}],cc:'copy@example.com'}],currentUser:{name:'Tobias'}};
  window.__EXPORTHUB_GET_STATE__=()=>window.appState;
  window.ExportHUBClean={queueSave(){}};
  window.ExportHUBI18n={t(key,vars){let text=de[key]||key;for(const [k,v] of Object.entries(vars||{}))text=text.replaceAll('{{'+k+'}}',String(v));return text;}};
  window.__drafts=[];
  document.addEventListener('click',event=>{
   const a=event.target.closest&&event.target.closest('a[data-rc1166-mail-draft]');
   if(a){window.__drafts.push(a.href);event.preventDefault();}
  },true);
 },de);
 for(const file of ['assets/rc1065-registration-cc.js','assets/rc1071-shipment-history.js','assets/rc1166-avis-reminder-overview.js'])await page.addScriptTag({path:file});
 await page.getByRole('button',{name:'Avis-Erinnerung in Outlook öffnen',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog.locator('[data-recipient]')).toHaveValue('customer@example.com');
 await dialog.locator('[data-target]').selectOption('carrier');
 await dialog.locator('[data-lang]').selectOption('en');
 await expect(dialog.locator('[data-recipient]')).toHaveValue('carrier@example.com');
 await expect(dialog.locator('[data-body]')).toHaveValue(/pickup date/);
 await dialog.getByRole('button',{name:'Mail in Outlook öffnen',exact:true}).click();
 await expect(dialog.locator('[data-send-status]')).toContainText('Bitte in Outlook prüfen und senden.');
 const result=await page.evaluate(()=>({drafts:window.__drafts,state:window.appState}));
 expect(result.drafts).toHaveLength(1);
 const draft=new URL(result.drafts[0]);
 expect(draft.protocol).toBe('mailto:');
 expect(decodeURIComponent(draft.pathname)).toBe('carrier@example.com');
 expect(draft.searchParams.get('subject')).toBe('Reminder – collection notice ABC123');
 expect(draft.searchParams.get('body')).toContain('https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc&lang=en');
 expect((draft.searchParams.get('cc')||'').split(';').map(x=>x.toLowerCase()).filter(Boolean)).toEqual(['copy@example.com']);
 expect(mailRequests).toEqual([]);
 expect(result.state.shipment.shipmentHistory).toBeUndefined();
 for(const sh of [...result.state.shipments,...result.state.savedShipments]){
  expect(sh.shipmentHistory).toHaveLength(1);
  expect(sh.shipmentHistory[0].type).toBe('mail-open');
  expect(sh.shipmentHistory[0].label).toBe('Avis-Erinnerung in Outlook geöffnet');
  expect(sh.mailSent).toBeUndefined();
 }
 await expect(dialog).toBeInViewport();
});