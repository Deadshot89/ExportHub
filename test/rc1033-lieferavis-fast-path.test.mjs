import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLIENT = fs.readFileSync('assets/rc1027-lieferavis-immediate.js', 'utf8');
const API = fs.readFileSync('api/customer-avis/index.js', 'utf8');

function bodyOf(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, `${start} fehlt`);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `${end} fehlt`);
  return source.slice(a, b);
}

test('RC1033: Auto-Lieferavis umgeht den alten Vollspeicher-Pfad', () => {
  const ensure = bodyOf(CLIENT, 'async function ensureCustomerAvis', 'function localizedUrl');
  assert.doesNotMatch(ensure, /previous\.toggle\(true\)/, 'Auto-Avis darf nicht mehr den alten Toggle mit erzwungenem Vollspeichern aufrufen');
  assert.match(ensure, /issueDraftAvis\(/, 'Auto-Avis muss den serverseitigen Fast-Path verwenden');
});

test('RC1033: Fast-Path sendet nur einen kleinen Avis-Entwurf', () => {
  assert.match(CLIENT, /function avisDraftSnapshot\(/, 'Client benötigt einen begrenzten Avis-Entwurf');
  assert.match(CLIENT, /shipmentSnapshot\s*:\s*avisDraftSnapshot\(/, 'Fast-Path muss den begrenzten Entwurf an die API senden');
  assert.doesNotMatch(CLIENT, /shipmentSnapshot\s*:\s*sh\b/, 'Die komplette Sendung darf nicht als Fast-Path-Payload gesendet werden');
});

test('RC1033/RC1052: API übernimmt einen noch ungespeicherten Sendungsentwurf ohne Vollspeicher-Write', () => {
  assert.match(API, /function sanitizeDraftSnapshot\(/, 'API muss Client-Entwürfe serverseitig whitelisten');
  assert.match(API, /function ensureDraftShipment\(/, 'API muss den sicheren Snapshot später beim ersten Kunden-Write materialisieren können');
  const issue = bodyOf(API, "if(req.method==='POST'&&(action==='issue'||action==='disable'))", "if(req.method==='POST'&&action==='authorize')");
  assert.match(issue, /payload\.shipmentSnapshot/, 'Issue-Pfad muss den Avis-Entwurf berücksichtigen');
  assert.match(issue, /sanitizeDraftSnapshot\(payload\.shipmentSnapshot/, 'Issue-Pfad muss den Draft als kleinen sicheren Snapshot übernehmen');
  assert.doesNotMatch(issue, /ensureDraftShipment\(state,subjectId,reference,payload\.shipmentSnapshot\)/, 'RC1052 darf den kompletten Team-State bei der Link-Erstellung nicht mehr schreiben');
});
