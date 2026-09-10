import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const avisPage = fs.readFileSync(new URL('../customer-avis.html', import.meta.url), 'utf8');
const avisApi = fs.readFileSync(new URL('../api/customer-avis/index.js', import.meta.url), 'utf8');

// Production changes that would make these tests fail:
// 1) hiding customer-approved attachments or the POD from the Avis,
// 2) removing the carrier pickup-time form / appointment action,
// 3) closing the Avis after pickup without keeping documents readable,
// 4) serving only the initial minimal Avis snapshot instead of current shipment data.

test('customer Avis renders all released shipment attachments and POD support', () => {
  assert.match(avisPage, /function\s+docHtml\s*\(/);
  assert.match(avisPage, /downloadUrl/);
  assert.match(avisPage, /POD herunterladen/);
  assert.match(avisPage, /Öffnen \/ herunterladen/);
  assert.match(avisPage, /Dokumente\s*&\s*Anhänge|Dokumente und Anhänge/);
});

test('carrier can still submit pickup date, time window and plate through the Avis page', () => {
  assert.match(avisPage, /name="pickupDate"/);
  assert.match(avisPage, /name="timeFrom"/);
  assert.match(avisPage, /name="timeTo"/);
  assert.match(avisPage, /name="plate"/);
  assert.match(avisPage, /name="shipmentReference"[^>]*readonly/);
  assert.match(avisPage, /action:\s*'appointment'/);
});

test('closed Avis stays read-only but keeps shipment documents and POD readable', () => {
  const closedBranch = avisPage.match(/if\(data\.closed===true\|\|actual\)\{([\s\S]*?)return\}/);
  assert.ok(closedBranch, 'closed Avis branch must exist');
  assert.match(closedBranch[1], /docHtml/);
  assert.match(closedBranch[1], /data\.documents/);
  assert.match(closedBranch[1], /data\.pod/);
  assert.doesNotMatch(closedBranch[1], /avisForm/);
});

test('Avis API keeps released documents and POD in the read-only payload after actual pickup', () => {
  const actualBranch = avisApi.match(/if\(actual\)return\{([^;]+)\};/);
  assert.ok(actualBranch, 'actual-pickup payload must exist');
  assert.match(actualBranch[1], /documents:docs/);
  assert.match(actualBranch[1], /pod:\{[^}]*documents:podDocs/);
});

test('released Avis attachments remain downloadable after pickup while appointment changes stay blocked', () => {
  assert.doesNotMatch(avisApi, /if\(dateTimeOf\(sh\)&&doc\.category!==['"]POD['"]\)throw error\(['"]AVIS_CLOSED['"]/);
  assert.match(avisApi, /if\(dateTimeOf\(target\)\)throw error\(['"]AVIS_CLOSED['"]/);
});

test('Avis API derives public data from the current persisted shipment and keeps appointment persistence', () => {
  assert.match(avisApi, /findShipment\(state,/);
  assert.match(avisApi, /documentRecords\(sh\)/);
  assert.match(avisApi, /rowsOf\(sh\)/);
  assert.match(avisApi, /saveAppointment/);
  assert.match(avisApi, /applyAppointment/);
});
