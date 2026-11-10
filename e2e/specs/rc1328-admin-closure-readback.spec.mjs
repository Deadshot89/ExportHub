import fs from 'node:fs';
import {createRequire} from 'node:module';
import {test,expect} from '@playwright/test';

const require=createRequire(import.meta.url);
const closure=require('../../api/shared/avis-mail-html.js');
const dictionary=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

// Run the original admin script in a standalone browser with an in-memory,
// confirmed save/readback adapter. No auth, Azure storage, Graph or customer APIs.
async function bootAdmin(page,{admin=true}={}){
 await page.route('**/api/**',route=>route.abort('blockedbyclient'));
 await page.setContent('<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="content"></main></body></html>',{waitUntil:'domcontentloaded'});
 await page.evaluate(({dictionary,admin})=>{
  window.__closureState={
   view:'settings',currentUser:{role:admin?'Global Admin':'Benutzer'},
   settings:{closureNotices:[]}
  };
  window.__EXPORTHUB_GET_STATE__=()=>window.__closureState;
  window.__closureWrites=0;
  window.__closureAttempts=0;
  window.__closureSaved=null;
  window.__closureFailNext=false;
  window.ExportHUBI18n={
   t(key,vars){
    let text=dictionary[key]||key;
    for(const [k,v] of Object.entries(vars||{}))text=text.replaceAll('{{'+k+'}}',String(v));
    return text;
   },language(){return'de'}
  };
  window.ExportHUBClean={
   async queueSave(){return true},
   async flushSave(){
    window.__closureAttempts++;
    if(window.__closureFailNext){window.__closureFailNext=false;return false}
    window.__closureWrites++;
    window.__closureSaved=structuredClone(window.__closureState);
    return true;
   }
  };
 },{dictionary,admin});
 await page.addScriptTag({path:'assets/rc1065-registration-cc.js'});
 await page.evaluate(()=>window.ExportHUBRC1065RegistrationCC.installSettings());
 return page.locator('#rc1328ClosureSettings');
}

test('RC1328 admin browser: confirmed save, reloaded state and both visibility switches preserve booking policy',async({page})=>{
 const box=await bootAdmin(page);
 await expect(box).toBeVisible();
 const form=box.locator('[data-rc1328-form]');
 for(const [key,value] of Object.entries({
  startDate:'2026-12-21',endDate:'2027-01-01',
  lastPickupDate:'2026-12-18',lastPickupTime:'14:30',
  reopenDate:'2027-01-04',leadDays:'21'
 })){
  await form.locator('[name="'+key+'"]').fill(value);
 }
 await form.locator('[name="mailEnabled"]').uncheck();
 await form.locator('[name="portalEnabled"]').check();
 await form.locator('[name="animateSnow"]').check();
 await form.locator('[type="submit"]').click();
 await expect.poll(()=>page.evaluate(()=>window.__closureWrites)).toBe(1);
 const first=await page.evaluate(()=>structuredClone(window.__closureSaved.settings.closureNotices[0]));
 expect(first).toMatchObject({
  enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',
  lastPickupDate:'2026-12-18',lastPickupTime:'14:30',reopenDate:'2027-01-04',
  leadDays:21,mailEnabled:false,portalEnabled:true,animateSnow:true
 });
 const date=new Date('2026-12-14T12:00:00Z');
 expect(closure.activeClosureNotices({settings:{closureNotices:[first]}},date,'mail')).toHaveLength(0);
 expect(closure.activeClosureNotices({settings:{closureNotices:[first]}},date,'portal')).toHaveLength(1);
 expect(closure.closureForPickupDate({settings:{closureNotices:[first]}},'2026-12-24')).not.toBeNull();
 expect(closure.closureForPickupDate({settings:{closureNotices:[first]}},'2027-01-04')).toBeNull();
 expect(closure.closureForPickupSlot({settings:{closureNotices:[first]}},'2026-12-18','13:00','15:00')).not.toBeNull();

 // Simulate a fresh page state built from the last *confirmed* server snapshot,
 // rather than trusting the editor's mutable state object.
 await page.evaluate(()=>{
  window.__closureState=structuredClone(window.__closureSaved);
  document.getElementById('rc1328ClosureSettings')?.remove();
  window.ExportHUBRC1065RegistrationCC.installSettings();
 });
 await expect(box.locator('[data-rc1328-entries] li')).toHaveCount(1);
 await expect(box.locator('[data-rc1328-entries]')).toContainText('2026-12-21');
 await expect(box.locator('[data-rc1328-entries]')).toContainText('14:30');

 // The first channel button is mail; the second is the public Avis portal.
 await box.locator('.rc1337-channel-toggle').first().click();
 await expect.poll(()=>page.evaluate(()=>window.__closureWrites)).toBe(2);
 let second=await page.evaluate(()=>structuredClone(window.__closureSaved.settings.closureNotices[0]));
 expect(second.mailEnabled).toBe(true);
 expect(second.portalEnabled).toBe(true);
 expect(closure.activeClosureNotices({settings:{closureNotices:[second]}},date,'mail')).toHaveLength(1);
 await box.locator('.rc1337-channel-toggle').nth(1).click();
 await expect.poll(()=>page.evaluate(()=>window.__closureWrites)).toBe(3);
 second=await page.evaluate(()=>structuredClone(window.__closureSaved.settings.closureNotices[0]));
 expect(second.mailEnabled).toBe(true);
 expect(second.portalEnabled).toBe(false);
 // Hiding the visual announcement must never reopen a prohibited pickup date.
 expect(closure.closureForPickupDate({settings:{closureNotices:[second]}},'2026-12-24')).not.toBeNull();
 await page.locator('#rc1328ClosureSettings .rc1337-snow-toggle').click();
 await expect.poll(()=>page.evaluate(()=>window.__closureWrites)).toBe(4);
 expect(await page.evaluate(()=>window.__closureSaved.settings.closureNotices[0].animateSnow)).toBe(false);
});

test('RC1328 admin browser: failed save restores original state and stale row cannot be overwritten',async({page})=>{
 const box=await bootAdmin(page);
 await page.evaluate(()=>{
  const row={
   enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',
   lastPickupDate:'2026-12-18',lastPickupTime:'14:30',
   reopenDate:'2027-01-04',leadDays:14,
   mailEnabled:true,portalEnabled:true,animateSnow:false
  };
  window.__closureState.settings.closureNotices=[row];
  window.__closureSaved=structuredClone(window.__closureState);
  document.getElementById('rc1328ClosureSettings')?.remove();
  window.ExportHUBRC1065RegistrationCC.installSettings();
 });
 await expect(box.locator('[data-rc1328-entries] li')).toHaveCount(1);
 await page.evaluate(()=>window.__closureFailNext=true);
 await box.locator('.rc1337-channel-toggle').first().click();
 await expect(box.locator('[data-rc1328-status]')).toHaveAttribute('data-kind','error');
 expect(await page.evaluate(()=>window.__closureState.settings.closureNotices[0].mailEnabled)).toBe(true);
 expect(await page.evaluate(()=>window.__closureSaved.settings.closureNotices[0].mailEnabled)).toBe(true);
 expect(await page.evaluate(()=>window.__closureWrites)).toBe(0);

 // A backend/refetch update makes the rendered row obsolete; its old index
 // must not modify the newer row or persist anything.
 await page.evaluate(()=>window.__closureState.settings.closureNotices[0].startDate='2026-12-22');
 await box.locator('.rc1337-snow-toggle').click();
 await expect(box.locator('[data-rc1328-status]')).toHaveAttribute('data-kind','error');
 expect(await page.evaluate(()=>window.__closureWrites)).toBe(0);
 expect(await page.evaluate(()=>window.__closureState.settings.closureNotices[0].animateSnow)).toBe(false);
});

test('RC1328 admin browser: regular users never see closure administration',async({page})=>{
 const box=await bootAdmin(page,{admin:false});
 await expect(box).toHaveCount(0);
 await expect(page.locator('#rc1065RegistrationCcSettings')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__closureWrites)).toBe(0);
});
