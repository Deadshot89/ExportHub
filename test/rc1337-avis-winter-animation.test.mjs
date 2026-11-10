import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const root='customer-avis.html';
const portal=fs.readFileSync(root,'utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const admin=fs.readFileSync('assets/rc1065-registration-cc.js','utf8');
const closure=require('../api/shared/avis-mail-html.js');
const base={enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',lastPickupDate:'2026-12-18',lastPickupTime:'14:30',reopenDate:'2027-01-04',leadDays:21};

function portalRenderer(lang){
 const start=portal.indexOf('var closureCopy={'),end=portal.indexOf('var lastAvisRenderKey',start);
 assert.ok(start>0&&end>start);
 const mod={exports:{}};
 const ctx={module:mod,closureLanguage:lang,Intl,Date,esc(v){return String(v).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}};
 vm.runInNewContext(portal.slice(start,end)+'\nmodule.exports={portalClosureBanner};',ctx);
 return mod.exports.portalClosureBanner;
}
test('RC1337: a single admin-managed closure record provides a strictly opt-in animation flag',()=>{
 const active=closure.activeClosureNotices({settings:{closureNotices:[{...base,animateSnow:true}]}},new Date('2026-12-14T12:00:00Z'));
 assert.equal(active.length,1);
 assert.equal(active[0].animateSnow,true);
 assert.equal(closure.activeClosureNotices({settings:{closureNotices:[base]}},new Date('2026-12-14T12:00:00Z'))[0].animateSnow,false);
 assert.equal(closure.activeClosureNotices({settings:{closureNotices:[{...base,animateSnow:'true'}]}},new Date('2026-12-14T12:00:00Z'))[0].animateSnow,false);
});
test('RC1337: mail and portal notice toggles are independent while booking stays blocked',()=>{
 const now=new Date('2026-12-14T12:00:00Z'),hidden={...base,mailEnabled:false,portalEnabled:false,animateSnow:true};
 const list=(record,channel)=>closure.activeClosureNotices({settings:{closureNotices:[record]}},now,channel);
 assert.equal(list(hidden).length,1);
 assert.equal(list(hidden,'mail').length,0);
 assert.equal(list(hidden,'portal').length,0);
 assert.equal(list({...hidden,mailEnabled:true},'mail').length,1);
 assert.equal(list({...hidden,portalEnabled:true},'portal').length,1);
 assert.equal(list(base,'mail').length,1);
 assert.equal(list(base,'portal').length,1);
 assert.ok(closure.closureForPickupDate({settings:{closureNotices:[hidden]}},'2026-12-24'));
 assert.match(admin,/name="mailEnabled" checked/);
 assert.match(admin,/name="portalEnabled" checked/);
 assert.match(admin,/rows\[index\]\[prop\]=rows\[index\]\[prop\]===false/);
 const mailApi=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
 const portalApi=fs.readFileSync('api/customer-avis/index.js','utf8');
 assert.match(mailApi,/activeClosureNotices\(current\.team&&current\.team\.state,new Date\(\),'mail'\)/);
 assert.match(portalApi,/activeClosureNotices\(state,new Date\(\),'portal'\)/);
});
test('RC1337: public closure response shares only approved dates and animation preference',()=>{
 const start=api.indexOf('function publicClosureFields(notice){'),end=api.indexOf('function availabilityWithClosure(',start);
 assert.ok(start>0&&end>start);
 const mod={exports:{}};
 vm.runInNewContext(api.slice(start,end)+'\nmodule.exports=publicClosureFields;', {module:mod});
 const data=mod.exports({...base,animateSnow:true,internalUserId:'not-public',leadDays:21});
 assert.equal(data.animateSnow,true);
 assert.equal(data.leadDays,undefined);
 assert.equal(data.internalUserId,undefined);
 assert.equal(mod.exports({...base}).animateSnow,false);
});
test('RC1337: winter notice remains one existing closure card with localized wording, never a second banner',()=>{
 const languages=['de','en','pl','es','fr','it'];
 for(const lang of languages){
  const render=portalRenderer(lang);
  const plain=render([{...base,animateSnow:false}],false);
  const festive=render([{...base,animateSnow:true}],false);
  assert.equal((festive.match(/rc1328-portal-closure/g)||[]).length,1,lang);
  assert.ok(festive.includes('rc1337-avis-winter'),lang);
  assert.ok(festive.includes('aria-hidden="true"'),lang);
  assert.ok(festive.includes('rc1337-festive-greeting'),lang);
  assert.ok(!plain.includes('rc1337-avis-winter'),lang);
  assert.ok(!plain.includes('rc1337-festive-decor'),lang);
  assert.ok(!plain.includes('rc1337-festive-greeting'),lang);
 }
});
test('RC1337: admin animation switches have translations in all six configured languages',()=>{
 for(const lang of ['de','en','pl','es','fr','it']){
  const dictionary=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
  for(const key of ['snowAnimation','snowEnable','snowDisable','snowOn','snowOff','mailVisible','portalVisible','mailShow','mailHide','portalShow','portalHide']){
   assert.ok(dictionary['closureMail.'+key]?.length>8,lang+':'+key);
  }
 }
});
test('RC1337: animation is restricted to card, reduced motion disables it and original appointment flow remains intact',()=>{
 assert.match(portal,/prefers-reduced-motion:reduce/);
 assert.match(portal,/pointer-events:none/);
 assert.match(portal,/rc1337-festive-drift/);
 assert.match(portal,/if\(availability\.closed\)return portalClosureBanner\(\[availability\.closure\],true\)/);
 assert.match(portal,/PICKUP_BUSINESS_CLOSED/);
 assert.match(admin,/name="animateSnow"/);
 assert.match(admin,/rows\[index\]\.animateSnow=rows\[index\]\.animateSnow!==true/);
 assert.match(admin,/await persistClosureEntries\(rows\)/);
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(build,/fs\.copyFileSync\(path\.join\(ROOT,'customer-avis\.html'\),path\.join\(OUT,'customer-avis\.html'\)\)/);
});
test('RC1337: changed runtime, server and embedded scripts parse',()=>{
 for(const path of ['assets/rc1065-registration-cc.js','api/customer-avis/index.js','api/shared/avis-mail-html.js']){
  execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
 }
 for(const snippet of [...portal.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]){
  if(snippet[1].trim())new Function(snippet[1]);
 }
});
