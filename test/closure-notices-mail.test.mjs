import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {activeClosureNotices,closureNoticePlain,closureNoticeHtml,renderAvisMailHtml}=require('../api/shared/avis-mail-html.js');

const closure={enabled:true,startDate:'2026-12-21',endDate:'2027-01-01',lastPickupDate:'2026-12-18',lastPickupTime:'15:00',reopenDate:'2027-01-04',leadDays:14};
const settings=(notices)=>({settings:{closureNotices:notices}});
const at=(day,hour='12:00')=>new Date(day+'T'+hour+':00Z');

test('Issue 1328: Schließhinweis beginnt genau 14 Kalendertage vorher und endet bei Wiederöffnung',()=>{
 assert.equal(activeClosureNotices(settings([closure]),at('2026-12-06')).length,0);
 assert.equal(activeClosureNotices(settings([closure]),at('2026-12-07')).length,1);
 assert.equal(activeClosureNotices(settings([closure]),at('2027-01-03')).length,1);
 assert.equal(activeClosureNotices(settings([closure]),at('2027-01-04')).length,0);
});

test('Issue 1328: Berlin-Tag bei UTC-Tagesgrenze und Sommerzeit',()=>{
 const c={...closure,startDate:'2027-04-05',endDate:'2027-04-06',lastPickupDate:'2027-04-02',reopenDate:'2027-04-07',leadDays:1};
 assert.equal(activeClosureNotices(settings([c]),at('2027-04-03','21:30')).length,0);
 assert.equal(activeClosureNotices(settings([c]),at('2027-04-03','22:30')).length,1);
});

test('Issue 1328: Nur explizit aktivierte, vollständige und chronologisch korrekte Daten',()=>{
 const cases=[
  {...closure,enabled:false},
  {...closure,lastPickupDate:''},
  {...closure,lastPickupDate:'2026-12-21'},
  {...closure,lastPickupTime:'25:70'},
  {...closure,reopenDate:'2027-01-01'},
  {...closure,startDate:'2026-02-30'},
  {...closure,leadDays:-1},
  {...closure,leadDays:100},
 ];
 cases.forEach(c=>assert.equal(activeClosureNotices(settings([c]),at('2026-12-15')).length,0,JSON.stringify(c)));
 assert.deepEqual(activeClosureNotices({taskCalendar:{closures:[closure]}},at('2026-12-15')),[],'Aufgabenplaner-Schließungen nicht automatisch extern veröffentlichen');
});

test('Issue 1328: Keine doppelten Hinweise; mehrere Zeiträume sortiert',()=>{
 const second={...closure,startDate:'2026-12-24',endDate:'2027-01-02',lastPickupDate:'2026-12-23',reopenDate:'2027-01-05'};
 const selected=activeClosureNotices(settings([second,closure,closure]),at('2026-12-20'));
 assert.equal(selected.length,2);
 assert.equal(selected[0].startDate,'2026-12-21');
});

test('Issue 1328: Texte in allen sechs AVIS-Sprachen, keine HTML-Tags im Klartext',()=>{
 const selected=activeClosureNotices(settings([closure]),at('2026-12-10'));
 const expected={
  de:'Wichtige Information',en:'Important notice',pl:'Ważna informacja',
  es:'Información importante',fr:'Information importante',it:'Informazione importante'
 };
 for(const [lang,heading] of Object.entries(expected)){
  const plain=closureNoticePlain(selected,lang);
  const html=closureNoticeHtml(selected,lang);
  assert.ok(plain.includes(heading),lang);
  assert.ok(html.includes(heading),lang);
  assert.ok(plain.includes('15:00'),lang);
  assert.doesNotMatch(plain,/<[a-z][^>]*>/i);
  assert.match(html,/role="presentation"/);
  assert.match(html,/border:2px solid/);
  assert.match(html,/<strong>/);
 }
 assert.match(closureNoticePlain(selected,'en'),/December 2026/);
 assert.match(closureNoticePlain(selected,'de'),/Dezember 2026/);
});

test('Issue 1328: Bestehender AVIS-Link und E-Mail-Text bleiben erhalten',()=>{
 const url='https://www.exporthub360.de/avis/ABC?lang=en';
 const body='Hello,\n'+url+'\nBest regards';
 const notice=closureNoticeHtml([closure],'en');
 const html=renderAvisMailHtml(body,'https://www.exporthub360.de/avis/ABC','en',notice);
 assert.match(html,/Important notice/);
 assert.match(html,/Click here to arrange pickup/);
 assert.match(html,/Best regards/);
 assert.match(html,/href="https:\/\/www.exporthub360.de\/avis\/ABC\?lang=en"/);
 const unchanged=renderAvisMailHtml(body,'https://www.exporthub360.de/avis/ABC','en');
 assert.doesNotMatch(unchanged,/Important notice/);
});

test('Issue 1328: Ungültige oder ausgeschaltete Konfiguration versendet keinen Hinweis',()=>{
 assert.deepEqual(activeClosureNotices({},at('2026-12-20')),[]);
 assert.deepEqual(activeClosureNotices(settings([]),at('2026-12-20')),[]);
 assert.deepEqual(activeClosureNotices(settings([{...closure,enabled:undefined}]),at('2026-12-20')),[]);
});
