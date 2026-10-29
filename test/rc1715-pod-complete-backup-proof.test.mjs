import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const handlerSource = fs.readFileSync('api/pod-backup/index.js', 'utf8');
const archiveSource = fs.readFileSync('api/shared/pod-archive.js', 'utf8');

const hash = 'a'.repeat(64);
const baseRecord = {
  reference: 'ABC123',
  confirmedAt: '2026-10-28T09:00:00Z',
  signatureBlobName: 'signed/driver.png'
};

async function invoke(backup) {
  const record = { ...baseRecord, podBackup: backup };
  const store = {
    json: (status, body) => ({ status, body }),
    getRecord: async () => ({ record }),
    pickupComplete: () => true,
    updateTeam: async () => {},
    now: () => '2026-10-28T10:00:00Z'
  };
  const archive = {
    automaticPod: () => ({ id: 'existing-original' }),
    retryArchiveBackup: async () => ({ record, backup, file: { name: 'POD_ABC123_Ladeliste_unterschrieben.pdf' } }),
    confirmedDriveBackup: (b) => b.driveSaved === true && !!b.driveItemId &&
      /^[a-f0-9]{64}$/.test(b.hash) && b.hash === b.driveVerifiedHash && !!b.driveVerifiedAt,
    fileNameFor: () => 'POD_ABC123_Ladeliste_unterschrieben.pdf'
  };
  const modules = {
    crypto,
    '../shared/public-access-store': { resolve: async () => ({ resourceKey: hash, environment: 'testservice' }) },
    '../shared/pickup-store': store,
    '../shared/pod-archive': archive
  };
  const mod = { exports: {} };
  vm.runInNewContext(handlerSource, {
    module: mod, exports: mod.exports, require(name) {
      assert.ok(Object.hasOwn(modules, name), 'unexpected dependency: ' + name);
      return modules[name];
    }, Buffer, console
  }, { filename: 'pod-backup/index.js' });
  const context = {};
  await mod.exports(context, { method: 'POST', body: { token: 'test-token' } });
  assert.equal(context.res.status, 200);
  return context.res.body;
}

test('RC1715 P1: Azure archive without a Graph-readback original stays incomplete', async () => {
  const result = await invoke({ status: 'saved', azureSaved: true, archiveSaved: true, driveSaved: false, hash });
  assert.equal(result.ok, true, 'Azure save itself remains available');
  assert.equal(result.archiveSaved, true);
  assert.equal(result.saved, false, 'general success must not mean Azure-only');
  assert.equal(result.driveSaved, false);
  assert.equal(result.status, 'sharepoint-pending');
});

test('RC1715 P1: only an independently verified SharePoint original completes both backups', async () => {
  const result = await invoke({
    status: 'saved', azureSaved: true, archiveSaved: true, driveSaved: true,
    hash, driveItemId: 'real-graph-item', driveVerifiedHash: hash,
    driveVerifiedAt: '2026-10-28T10:00:00Z'
  });
  assert.equal(result.saved, true);
  assert.equal(result.driveSaved, true);
  assert.equal(result.status, 'saved');
});

test('RC1715 P1: mismatched Graph hash never completes the POD backup', async () => {
  const result = await invoke({
    status: 'saved', azureSaved: true, archiveSaved: true, driveSaved: true,
    hash, driveItemId: 'graph-item', driveVerifiedHash: 'b'.repeat(64),
    driveVerifiedAt: '2026-10-28T10:00:00Z'
  });
  assert.equal(result.saved, false);
  assert.equal(result.driveSaved, false);
  assert.equal(result.status, 'sharepoint-pending');
  assert.equal(result.driveItemId, '', 'unverified Graph links must stay hidden');
});

test('RC1715 P1: legacy saved status without an Azure archive never counts as fully backed up', async () => {
  const result = await invoke({ status: 'saved', azureSaved: true, archiveSaved: false, driveSaved: false, hash });
  assert.equal(result.saved, false);
  assert.equal(result.status, 'pending');
});

test('RC1715 P1: reference-specific reconcile does not count unverified SharePoint as already saved', () => {
  assert.match(archiveSource, /const targetSharePointPending = !!\(reference && referencePodReady > 0/);
  assert.match(archiveSource, /!graphDrive\.readiness\(\)\.configured/);
  assert.match(archiveSource, /drivePending\.length > 0/);
  assert.match(archiveSource, /driveBackfillEligible > driveBackfillSelected/);
  assert.match(archiveSource, /targetSharePointPending \? 'sharepoint-pending'/);
  assert.match(archiveSource, /const target = reference \?/);
});
