import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const api=fs.readFileSync('api/customer-avis/index.js','utf8');

test('RC1436: Kunden-Avis speichert Erstbestätigung und Änderungen mit Vorher/Nachher',()=>{
  assert.match(api,/customerAvisAppointmentHistory/);
  assert.match(api,/details:\{reference,before,after/);
  assert.match(api,/oldDate:before\.date,newDate:after\.date/);
  assert.match(api,/oldPlate:before\.plate,newPlate:after\.plate/);
});

test('RC1436: zentrale History bevorzugt die vollständigen Rohdetails vor der normalisierten Kopie',()=>{
  assert.match(history,/function mergeShipmentEvents\(sh,normalized\)/);
  assert.match(history,/rawById/);
  assert.match(history,/Object\.assign\(\{\},normalizedDetails,rawDetails\)/);
});

test('RC1436: Kundenaktion ist in der History eindeutig als AVIS-Kundenaktion erkennbar',()=>{
  assert.match(history,/function customerAvisEvent\(e\)/);
  assert.match(history,/Kunde hat Abholung bestätigt/);
  assert.match(history,/Kunde hat Abholung geändert/);
  assert.match(history,/Kunde über AVIS-Link/);
});

test('RC1436: History zeigt bei Kundenänderungen einzelne geänderte Felder inklusive Bemerkung',()=>{
  assert.match(history,/function customerAvisDetailParts\(e\)/);
  assert.match(history,/before\.note/);
  assert.match(history,/after\.note/);
  assert.match(history,/Abholdatum/);
  assert.match(history,/Zeitfenster/);
  assert.match(history,/Kennzeichen/);
  assert.match(history,/Bemerkung/);
});

test('RC1436: Kunden-Avis-Ereignisse werden optisch hervorgehoben und separat gezählt',()=>{
  assert.match(history,/rc1084-customer-avis/);
  assert.match(history,/countCustomerAvis/);
  assert.match(history,/Kunden-Avis/);
});
