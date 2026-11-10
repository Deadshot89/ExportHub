import fs from 'node:fs';
import {test,expect} from '@playwright/test';

// Browser proof uses the original production portal rendering functions and
// stylesheet with synthetic dates. No customer tokens, sessions or API calls.
const portal=fs.readFileSync('customer-avis.html','utf8');
const styles=portal.match(/<style>([\s\S]*?)<\/style>/i)?.[1];
const start=portal.indexOf('var closureCopy={');
const end=portal.indexOf('var lastAvisRenderKey',start);
if(!styles||start<0||end<=start)throw new Error('RC1337 production portal banner source unavailable');

const renderingSource=portal.slice(start,end);
const fixture=Object.freeze({
 startDate:'2026-12-21',
 endDate:'2027-01-01',
 lastPickupDate:'2026-12-18',
 lastPickupTime:'14:30',
 reopenDate:'2027-01-04'
});
const labels={
 de:'Letzte Abholung',
 en:'Last collection',
 pl:'Ostatni odbiór',
 es:'Última recogida',
 fr:'Dernier enlèvement',
 it:'Ultimo ritiro'
};

async function renderFixture(page,{lang='de',winter=false,blocked=false}={}){
 await page.setContent(
  '<!doctype html><html lang="'+lang+'"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<style>'+styles+'</style></head><body><main class="portal"><section class="card">'+
  '<div id="notice"></div><form><button type="button" id="continue">Weiter</button></form>'+
  '</section></main></body></html>',
  {waitUntil:'domcontentloaded'}
 );
 await page.addScriptTag({content:
  "var closureLanguage='de';"+
  "function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}\n"+
  renderingSource+
  "\nwindow.__rc1337Render=function(lang,notice,blocked){closureLanguage=lang;document.getElementById('notice').innerHTML=portalClosureBanner([notice],blocked)};"
 });
 await page.evaluate(({lang,winter,blocked,fixture})=>{
  window.__rc1337Render(lang,{...fixture,animateSnow:winter},blocked);
  window.__rc1337Clicked=0;
  document.getElementById('continue').addEventListener('click',()=>window.__rc1337Clicked++);
 },{lang,winter,blocked,fixture});
 return page.locator('#notice .rc1328-portal-closure');
}

for(const lang of Object.keys(labels)){
 test('RC1337 seasonal closure visible and readable in '+lang,async({page})=>{
  const card=await renderFixture(page,{lang});
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('role','note');
  await expect(card).toContainText(labels[lang]);
  await expect(card).toContainText('14:30');
  await expect(card).not.toHaveClass(/rc1337-avis-winter/);
  await expect(page.locator('#notice .rc1337-festive-decor')).toHaveCount(0);
  const box=await page.evaluate(()=>{
   const node=document.querySelector('#notice .rc1328-portal-closure');
   const r=node.getBoundingClientRect();
   return {left:r.left,right:r.right,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+2};
  });
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(box.viewport+1);
  expect(box.overflow).toBe(false);
  await page.locator('#continue').click();
  expect(await page.evaluate(()=>window.__rc1337Clicked)).toBe(1);
 });
}

test('RC1337 winter animation is opt-in, confined to notice and does not intercept the form',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});
 const card=await renderFixture(page,{lang:'de',winter:true});
 await expect(card).toHaveCount(1);
 await expect(card).toHaveClass(/rc1337-avis-winter/);
 await expect(card).toContainText('Wir wünschen euch frohe Weihnachten');
 await expect(page.locator('#notice .rc1337-festive-decor')).toHaveCount(2);
 const style=await page.locator('#notice .rc1337-festive-decor').first().evaluate(el=>{
  const s=getComputedStyle(el),a=el.getBoundingClientRect(),b=el.closest('.rc1337-avis-winter').getBoundingClientRect();
  return {animation:s.animationName,pointerEvents:s.pointerEvents,within:a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom};
 });
 expect(style.animation).toBe('rc1337-festive-drift');
 expect(style.pointerEvents).toBe('none');
 expect(style.within).toBe(true);
 await page.locator('#continue').click();
 expect(await page.evaluate(()=>window.__rc1337Clicked)).toBe(1);
});

test('RC1337 reduced motion disables animation; blocked appointments retain a clear warning',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const card=await renderFixture(page,{lang:'en',winter:true,blocked:true});
 await expect(card).toHaveAttribute('role','alert');
 await expect(card).toContainText('No pickups are available');
 await expect(card).toContainText('Last collection');
 const animation=await page.locator('#notice .rc1337-festive-decor').first().evaluate(el=>getComputedStyle(el).animationName);
 expect(animation).toBe('none');
 // Public API suppresses winter styling if the general portal notice is hidden.
 // The separate Node test verifies this server-side projection; this browser test
 // verifies the mandatory blocked-booking warning with factual, nonfestive data.
 await page.evaluate(fixture=>window.__rc1337Render('en',{...fixture,animateSnow:false},true),fixture);
 await expect(card).toHaveAttribute('role','alert');
 await expect(card).not.toHaveClass(/rc1337-avis-winter/);
 await expect(card).toContainText('No pickups are available');
 await expect(page.locator('#notice .rc1337-festive-decor')).toHaveCount(0);
});
