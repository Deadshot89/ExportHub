import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');

for (const file of ['index.html','TESTVERSION.html']) {
  test(`${file}: QR wird erst nach bestätigter Server-Registrierung freigegeben`, () => {
    const html = read(file);
    const start = html.indexOf('function historicalQr(sh)');
    assert.ok(start >= 0, 'historicalQr fehlt');
    const chunk = html.slice(start, start + 700);
    assert.match(chunk, /pickupQrRegistered===true/);
    assert.match(chunk, /pickupQrRegisteredAt/);
    assert.doesNotMatch(chunk, /pickupQrCreatedAt/, 'Ein nur lokal erzeugter Token darf nicht als registrierter QR gelten');
  });
}

test('Public-Access übernimmt den kryptografischen 48-Hex Pickup-Token des Clients', () => {
  const source = read('api/shared/public-access-store.js');
  assert.match(source, /requestedToken/);
  assert.match(source, /payload&&payload\.token/);
  assert.match(source, /\^\[a-f0-9\]\{48\}\$/);
});
