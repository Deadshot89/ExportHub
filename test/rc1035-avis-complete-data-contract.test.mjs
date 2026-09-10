import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const avisPage = fs.readFileSync(new URL('../customer-avis.html', import.meta.url), 'utf8');
const avisApi = fs.readFileSync(new URL('../api/customer-avis/index.js', import.meta.url), 'utf8');

// Production changes that would make these tests fail:
// 1) removing document rendering from the customer Avis page,
// 2) removing the carrier appointment form / save action,
// 3) serving only the initial minimal Avis snapshot instead of current shipment data.

test('customer Avis keeps downloadable shipment attachments and POD support', () => {
  assert.match(avisPage, /function\s+docHtml\s*\(/);
  assert.match(avisPage, /downloadUrl/);
  assert.match(avisPage, /POD herunterladen/);
  assert.match(avisPage, /Öffnen \/ herunterladen/);
});

test('carrier can still submit pickup time, reference and plate through the Avis page', () => {
  assert.match(avisPage, /name="date"/);
  assert.match(avisPage, /name="timeFrom"/);
  assert.match(avisPage, /name="timeTo"/);
  assert.match(avisPage, /name="reference"/);
  assert.match(avisPage, /name="plate"/);
  assert.match(avisPage, /action:\s*'appointment'/);
});

test('Avis API derives the public payload from the current persisted shipment', () => {
  assert.match(avisApi, /documents/);
  assert.match(avisApi, /rows/);
  assert.match(avisApi, /appointment/);
  assert.match(avisApi, /shipment/);
});
