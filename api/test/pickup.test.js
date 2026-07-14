import test from 'node:test';
import assert from 'node:assert/strict';
import { createPickupService, MemoryRepository, MemoryBlobStore } from '../src/shared/core.js';

const TOKEN = 'a'.repeat(48);
function setup() {
  let now = new Date('2026-07-14T12:00:00.000Z');
  const repository = new MemoryRepository();
  const blobs = new MemoryBlobStore();
  const service = createPickupService({ repository, blobs, now: () => new Date(now) });
  return { service, repository, blobs, setNow: (value) => { now = new Date(value); } };
}

test('PIN ist nicht Bestandteil des öffentlichen Status', async () => {
  const { service } = setup();
  const result = await service.init({ token: TOKEN, pin: '123456', shipmentId: 'S1', reference: 'REF1', customer: 'Kunde' });
  assert.equal(result.status, 201);
  assert.equal('pin' in result.body, false);
  assert.equal('pinHash' in result.body, false);
});

test('falscher PIN wird abgelehnt und richtiger PIN bestätigt einmalig', async () => {
  const { service } = setup();
  await service.init({ token: TOKEN, pin: '123456', shipmentId: 'S1', reference: 'REF1', customer: 'Kunde' });
  assert.equal((await service.confirm({ token: TOKEN, pin: '000000' })).status, 401);
  const ok = await service.confirm({ token: TOKEN, pin: '123456' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.confirmedAt);
  assert.equal((await service.confirm({ token: TOKEN, pin: '123456' })).status, 409);
});

test('fünf falsche Versuche sperren den PIN zeitweise', async () => {
  const { service } = setup();
  await service.init({ token: TOKEN, pin: '123456', shipmentId: 'S1', reference: 'REF1' });
  for (let i = 0; i < 4; i++) assert.equal((await service.confirm({ token: TOKEN, pin: '000000' })).status, 401);
  assert.equal((await service.confirm({ token: TOKEN, pin: '000000' })).status, 423);
  assert.equal((await service.confirm({ token: TOKEN, pin: '123456' })).status, 423);
});

test('POD-Upload ist nur mit zeitlich begrenztem Uploadschlüssel möglich', async () => {
  const { service, setNow } = setup();
  await service.init({ token: TOKEN, pin: '123456', shipmentId: 'S1', reference: 'REF1' });
  const confirmed = await service.confirm({ token: TOKEN, pin: '123456' });
  const image = Buffer.from('testimage').toString('base64');
  assert.equal((await service.upload({ token: TOKEN, uploadKey: 'falsch', images: [{ name: 'pod.jpg', type: 'image/jpeg', dataBase64: image }] })).status, 401);
  const uploaded = await service.upload({ token: TOKEN, uploadKey: confirmed.body.uploadKey, images: [{ name: 'pod.jpg', type: 'image/jpeg', dataBase64: image }] });
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.podFiles.length, 1);
  setNow('2026-07-14T13:01:00.000Z');
  assert.equal((await service.upload({ token: TOKEN, uploadKey: confirmed.body.uploadKey, images: [{ name: 'pod2.jpg', type: 'image/jpeg', dataBase64: image }] })).status, 401);
});

test('POD-Datei kann nach Bestätigung abgerufen werden', async () => {
  const { service } = setup();
  await service.init({ token: TOKEN, pin: '123456', shipmentId: 'S1', reference: 'REF1' });
  const confirmed = await service.confirm({ token: TOKEN, pin: '123456' });
  const image = Buffer.from('testimage').toString('base64');
  const uploaded = await service.upload({ token: TOKEN, uploadKey: confirmed.body.uploadKey, images: [{ name: 'pod.jpg', type: 'image/jpeg', dataBase64: image }] });
  const file = await service.podFile(TOKEN, uploaded.body.podFiles[0].id);
  assert.equal(file.status, 200);
  assert.equal(file.body.toString(), 'testimage');
});


test('fester sichtbarer PIN 25846 wird intern als 025846 einmalig bestätigt', async () => {
  const { service } = setup();
  await service.init({ token: TOKEN, pin: '025846', shipmentId: 'S25846', reference: 'PIN25846' });
  const ok = await service.confirm({ token: TOKEN, pin: '025846' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.confirmedAt);
  assert.equal((await service.confirm({ token: TOKEN, pin: '025846' })).status, 409);
});
