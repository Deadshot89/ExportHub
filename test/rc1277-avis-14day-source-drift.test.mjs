import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');

test('RC1277: öffentliche AVIS-API meldet exakt die fachlichen 14 Kalendertage',()=>{
  assert.match(api,/addCalendarDays\(picked,14\)/);
  const markers=api.match(/postPickupDays:14/g)||[];
  assert.equal(markers.length,2,'offener und geschlossener AVIS-Payload müssen 14 Tage melden');
  assert.doesNotMatch(api,/postPickupDays:3/);
});

test('RC1277: eingebettete Mailpfade enthalten keine alte 3-Tage-Regel mehr',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const source=fs.readFileSync(file,'utf8');
    const start=source.indexOf('function injectMailBody(sh,target,body,langOverride)');
    const end=source.indexOf('function click(e)',start);
    assert.ok(start>0&&end>start,file+': injectMailBody fehlt');
    const block=source.slice(start,end);
    assert.match(block,/14 Kalendertage nach der tatsächlichen Abholung|14 calendar days after the actual collection/);
    assert.doesNotMatch(block,/3 Tage nach Abholung|drei Tage nach der Abholung|drei Kalendertage|3 Arbeitstage|drei Arbeitstage|three business days|three calendar days/i);
  }
});
