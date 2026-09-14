import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qrTest=fs.readFileSync('test/rc1045-qr-backward-compatibility.test.mjs','utf8');
const closeout=fs.readFileSync('test/rc1065-chat-closeout.test.mjs','utf8');

test('RC1105: alte ausgegebene QR-Links bleiben dauerhaft Bestandteil der Regression',()=>{
  assert.match(qrTest,/historische QR-Linkformen bleiben auf pickup\.html lesbar/);
  assert.match(qrTest,/alter und neuer QR derselben Sendung bleiben aktiv und teilen resourceKey/);
  assert.match(closeout,/QR-Bestandsschutz hält alte Linkparameter und resourceKey bei/);
});
