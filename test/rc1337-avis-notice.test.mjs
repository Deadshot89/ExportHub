import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const notice=require('../api/shared/avis-notice-store');
const sample={
 enabledMail:true,enabledPage:true,animate:true,
 from:'2026-12-01T08:00',until:'2027-01-05T18:00',
 lastPickup:'2026-12-23T14:00',closedFrom:'2026-12-24T00:00',
 closedUntil:'2027-01-03T23:59',firstPickup:'2027-01-04T08:30'
};
test('RC1337: independent mail/page controls and cross-year Berlin activation',()=>{
 const s=notice.normalize(sample);
 assert.equal(notice.isActive(s,'page','2026-12-24T10:00'),true);
 assert.equal(notice.isActive(s,'page','2027-01-06T00:00'),false);
 assert.equal(notice.isActive({...s,enabledPage:false},'page','2026-12-24T10:00'),false);
 assert.equal(notice.isActive({...s,enabledPage:false},'mail','2026-12-24T10:00'),true);
 assert.equal(notice.berlinNow(new Date('2026-12-01T07:00:00Z')),'2026-12-01T08:00');
 assert.equal(notice.berlinNow(new Date('2026-07-01T07:00:00Z')),'2026-07-01T09:00');
});
test('RC1337: six languages and opt-in animation',()=>{
 for(const lang of ['de','en','pl','es','fr','it']){
  const p=notice.publicNotice(sample,lang,'2026-12-24T10:00');
  assert.ok(p.title&&p.intro&&p.lastLabel&&p.closedLabel&&p.firstLabel&&p.greeting,lang);
  assert.match(p.lastPickup,/2026/);
  assert.equal(p.animate,true);
  const mail=notice.appendEmail('Reference https://example.test/avis/abc?lang='+lang+'\n\n'+({de:'Mit freundlichen Grüßen',en:'Kind regards',pl:'Z poważaniem',es:'Atentamente',fr:'Cordialement',it:'Cordiali saluti'})[lang],sample,lang,'2026-12-24T10:00');
  assert.equal((mail.match(/https:\/\/example.test/g)||[]).length,1);
  assert.ok(mail.includes(p.title));
 }
 assert.equal(notice.publicNotice({...sample,enabledPage:false},'de','2026-12-24T10:00'),null);
 assert.equal(notice.appendEmail('Hallo\n\nGruß',{...sample,enabledMail:false},'de','2026-12-24T10:00'),'Hallo\n\nGruß');
});
test('RC1337: reject invalid/empty scheduling and reversed closure',()=>{
 assert.throws(()=>notice.normalize({...sample,closedFrom:'2027-01-06T09:00'}),/Betriebsruhe|erste Abholung/);
 assert.throws(()=>notice.normalize({...sample,lastPickup:''}),/Alle Termine/);
 assert.throws(()=>notice.normalize({...sample,from:'2026-13-99T23:99'}),/Ungültiges Datum/);
 assert.throws(()=>notice.normalize({...sample,until:'2026-11-01T12:00'}),/Anzeigeende/);
});
test('RC1337: public route is read-only, admin write is authenticated, release contains files',()=>{
 const route=fs.readFileSync('api/avis-notice/index.js','utf8');
 assert.match(route,/auth\.validateSession\(req\)/);
 assert.match(route,/auth\.isAdmin\(current\.user\)/);
 assert.match(route,/notice\.publicNotice/);
 assert.match(route,/notice\.emailBlock/);
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 for(const path of ['assets/rc1337-avis-settings.js','assets/rc1337-avis-notice-public.js'])assert.ok(build.includes("'"+path+"'"));
 const portal=fs.readFileSync('customer-avis.html','utf8');
 assert.match(portal,/rc1337-avis-notice-public\.js/);
 const mail=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
 assert.match(mail,/avisNotice\.appendEmail/);
 assert.match(fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8'),/rc1337AppendDraft/);
});
test('RC1337: all new and changed code parses',()=>{
 for(const file of [
  'api/shared/avis-notice-store.js','api/avis-notice/index.js','assets/rc1337-avis-settings.js',
  'assets/rc1337-avis-notice-public.js','assets/rc1065-registration-cc.js',
  'assets/rc1166-avis-reminder-overview.js','api/avis-reminder-mail/index.js'
 ])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
});