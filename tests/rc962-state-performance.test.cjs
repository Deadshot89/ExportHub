'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

function loadStateInternals() {
  const file = path.resolve(__dirname, '../api/exporthub-state/index.js');
  const source = fs.readFileSync(file, 'utf8') + '\nmodule.exports.__rc962Test = { TEAM_WARM_CACHE, rememberWarmTeam, readTeamCachedForSession, sanitizeForClient };\n';
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(source, file);
  return mod.exports.__rc962Test;
}

function readableJson(value) {
  return (async function*(){
    yield Buffer.from(JSON.stringify(value), 'utf8');
  })();
}

async function main() {
  const api = loadStateInternals();
  api.TEAM_WARM_CACHE.clear();

  const team = {
    schemaVersion: 3,
    revision: 42,
    updatedAt: '2026-09-02T18:00:00.000Z',
    state: {
      shipments: [{ id: 'S1', ref: 'ABC123', documents: [{ name: 'proof.pdf', data: 'data:application/pdf;base64,AAAA' }] }],
      customers: [{ id: 'C1', name: 'Testkunde' }],
      view: 'shipment'
    },
    users: [{ id: 'U1', name: 'Tobias', role: 'Admin', password: 'secret', loginSecurity: { attempts: 1 } }],
    authBootstrap: { secret: 'server-only' },
    recentOperations: [{ id: 'op-1' }]
  };

  let productionPropertyReads = 0;
  const production = {
    environment: 'production',
    teamBlobName: 'team-state.json',
    team: { getProperties: async () => { productionPropertyReads += 1; return { etag: 'etag-42' }; } }
  };

  assert.strictEqual(api.rememberWarmTeam(production, team, 'etag-42'), true);

  const saveHit = await api.readTeamCachedForSession(production, 'save');
  assert.strictEqual(saveHit.cacheMode, 'memory-save');
  assert.strictEqual(saveHit.value, team, 'RC962: Production-memory-save darf den kompletten Teamstand nicht tief kopieren.');
  assert.strictEqual(productionPropertyReads, 0, 'RC1538: Production-save muss den schnellen Warm-Cache ohne ETag-Roundtrip behalten.');

  const readHit = await api.readTeamCachedForSession(production, 'read');
  assert.strictEqual(productionPropertyReads, 1, 'RC962: normaler Production-read darf den Warm-Cache per ETag validieren.');
  assert.strictEqual(readHit.cacheMode, 'memory-etag');
  assert.strictEqual(readHit.value, team, 'RC962: memory-etag darf den kompletten Teamstand nicht tief kopieren.');

  api.TEAM_WARM_CACHE.clear();
  const fixtureTeam = {
    ...team,
    revision: 43,
    updatedAt: '2026-10-14T18:48:00.000Z',
    users: team.users.concat([{ id: 'E2E-U1', name: 'E2E TEST Browser', user: 'e2e-browser', active: true, role: 'Admin', authVersion: 1 }])
  };
  let propertyReads = 0;
  let blobReads = 0;
  const testservice = {
    environment: 'testservice',
    teamBlobName: 'testservice/team-state.json',
    team: {
      getProperties: async () => { propertyReads += 1; return { etag: 'etag-43' }; },
      download: async () => {
        blobReads += 1;
        return { etag: 'etag-43', readableStreamBody: readableJson(fixtureTeam) };
      }
    }
  };

  assert.strictEqual(api.rememberWarmTeam(testservice, team, 'etag-42'), true);
  const testserviceSave = await api.readTeamCachedForSession(testservice, 'save');
  assert.strictEqual(propertyReads, 1, 'RC1538: TESTSERVICE-save muss den Blob-ETag vor Nutzung eines Warm-Caches prüfen.');
  assert.strictEqual(blobReads, 1, 'RC1538: Bei geändertem TESTSERVICE-ETag muss der aktuelle Team-State neu geladen werden.');
  assert.strictEqual(testserviceSave.cacheMode, 'full-read');
  assert.strictEqual(testserviceSave.value.revision, 43);
  assert.ok(testserviceSave.value.users.some(user => user.id === 'E2E-U1' && user.active === true), 'RC1538: Der vom Fixture neu angelegte E2E-Benutzer muss beim Save sichtbar sein.');

  const client = api.sanitizeForClient(team, false);
  assert.notStrictEqual(client, team, 'Client-Antwort braucht ein eigenes Root-Objekt.');
  assert.notStrictEqual(client.state, team.state, 'Client-State braucht ein eigenes Root-Objekt.');
  assert.strictEqual(client.state.shipments, team.state.shipments, 'RC962: große persistierte Collections sollen beim Read nicht erneut tief kopiert werden.');
  assert.strictEqual(client.state.customers, team.state.customers, 'RC962: große persistierte Collections sollen beim Read nicht erneut tief kopiert werden.');
  assert.strictEqual(client.state.view, undefined, 'Lokale UI-Felder dürfen weiterhin nicht an Clients ausgeliefert werden.');
  assert.strictEqual(client.authBootstrap, undefined, 'Server-only Auth-Daten dürfen weiterhin nicht ausgeliefert werden.');
  assert.strictEqual(client.recentOperations, undefined, 'Server-only Operationsdaten dürfen weiterhin nicht ausgeliefert werden.');
  assert.notStrictEqual(client.users, team.users, 'Benutzer müssen weiterhin separat bereinigt werden.');
  assert.strictEqual(client.users[0].password, undefined, 'Passwörter dürfen weiterhin nicht ausgeliefert werden.');
  assert.strictEqual(team.users[0].password, 'secret', 'Die Quellstruktur darf bei der Bereinigung nicht mutiert werden.');

  JSON.stringify(client);
  console.log('RC962/RC1538 state performance regression test: OK');
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
