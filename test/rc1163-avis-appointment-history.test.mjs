import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const page=fs.readFileSync('customer-avis.html','utf8');
const audit=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1163: Lieferavis erlaubt Terminänderung bis zur tatsächlichen Abholung',()=>{
  assert.match(page,/value="'\+esc\(a\.date\|\|''\)\+'"/);
  assert.match(page,/form id="avisForm"/);
  assert.match(api,/if\(dateTimeOf\(target\)\)throw error\('AVIS_CLOSED'/);
  assert.match(api,/Abholung geschlossen\. Änderungen sind nicht mehr möglich/);
});

test('RC1163: Erstmeldung und Änderung werden revisionssicher mit alt und neu protokolliert',()=>{
  assert.match(api,/function appointmentSnapshot\(sh\)/);
  assert.match(api,/function sameAppointment\(a,b\)/);
  assert.match(api,/customerAvisAppointmentHistory/);
  assert.match(api,/shipmentHistory/);
  assert.match(api,/Abholtermin vom Kunden gemeldet/);
  assert.match(api,/Abholtermin vom Kunden geändert/);
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
  assert.match(audit,/Abholtermin:/);
  assert.match(audit,/x\.oldPlate\|\|x\.newPlate/);
});

test('RC1163: Build liefert neue Historie mit neuem Cache-Key aus',()=>{
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1177/);
  assert.match(build,/avisAppointmentRevisionHistory:'RC1163/);
  assert.match(build,/border:4mm solid #facc15/);\n  assert.match(build,/deckblattHighVisibility:'RC1198/);
  assert.match(build,/assets\/rc1160-customer-portal-credentials\.js\?v=1162/);
});
