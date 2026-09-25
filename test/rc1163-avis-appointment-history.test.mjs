import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const page=fs.readFileSync('customer-avis.html','utf8');
const audit=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

test('RC1163: Lieferavis erlaubt Terminänderung bis zur tatsächlichen Abholung',()=>{
  assert.match(page,/value="'\+esc\(a\.date\|\|''\)\+'"/);
  assert.match(page,/form id="avisForm"/);
  assert.match(api,/if\(dateTimeOf\(target\)\)throw error\('AVIS_CLOSED'/);
  assert.match(api,/api\.avis\.closedChanges/);
});

test('RC1163: Erstmeldung und Änderung werden revisionssicher mit alt und neu protokolliert',()=>{
  assert.match(api,/function appointmentSnapshot\(sh\)/);
  assert.match(api,/function sameAppointment\(a,b\)/);
  assert.match(api,/customerAvisAppointmentHistory/);
  assert.match(api,/shipmentHistory/);
  assert.match(api,/api\.avis\.appointmentCreated/);
  assert.match(api,/api\.avis\.appointmentChanged/);
  assert.match(api,/oldDate:before\.date,newDate:after\.date/);
  assert.match(api,/oldTimeFrom:before\.timeFrom/);
  assert.match(api,/newTimeFrom:after\.timeFrom/);
  assert.match(api,/oldPlate:before\.plate,newPlate:after\.plate/);
});

test('RC1163: Erstmeldung wird immer erfasst, unveränderte Wiederholung erzeugt keinen künstlichen Historieneintrag',()=>{
  assert.match(api,/first=!text\(target&&\(target\.customerAvisResponseAt\|\|target\.avisResponseAt\)\)/);
  assert.match(api,/changed=first\|\|!sameAppointment\(before,after\)/);
  assert.match(api,/event=changed\?/);
  assert.match(api,/if\(event\)appendAppointmentHistory\(sh,event\)/);
});

test('RC1163: Historie zeigt alten und neuen Termin lesbar an',()=>{
  assert.match(audit,/x\.oldDate\|\|x\.newDate/);
  assert.match(audit,/field\('pickupAppointment'/);
  assert.equal(historyDe['history.field.pickupAppointment'],'Abholtermin');
  assert.match(audit,/x\.oldPlate\|\|x\.newPlate/);
});

test('RC1163: Build liefert neue Historie mit neuem Cache-Key aus',()=>{
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1177/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:3mm solid #111827/);
  assert.match(build,/assets\/rc1160-customer-portal-credentials\.js\?v=1162/);
});
