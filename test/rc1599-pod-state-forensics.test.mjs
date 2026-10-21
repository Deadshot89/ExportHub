import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mergeShipmentProtected } = require('../api/shared/merge.js');
import { compareTeamStateSnapshots } from '../scripts/rc1599-pod-state-forensics.mjs';

const make = (shipments = [], savedShipments = []) => ({ state: { shipments, savedShipments }});
const stamp = '2026-10-21T10:50:00.000Z';
const shipment = (ref, status, extra = {}) => ({ ref, status, processStatus: status, updatedAt: stamp, _syncUpdatedAt: stamp, ...extra });

test('RC1599: no snapshot is mutated by offline read-only comparison', () => {
  const a = make([shipment('AA11AA', 'POD vorhanden', { podFiles: [{blobName:'some/pdf.pdf'}] })]);
  const b = make([shipment('AA11AA', 'Abgeholt', {podFiles: []})]);
  const prev = JSON.stringify(a), next = JSON.stringify(b);
  const report = compareTeamStateSnapshots(a,b);
  assert.equal(JSON.stringify(a), prev);
  assert.equal(JSON.stringify(b), next);
  assert.equal(report.changes.podToPickedUp, 1);
  assert.equal(report.changes.podMetadataRemoved, 1);
  assert.ok(!JSON.stringify(report).includes('AA11AA'), 'Shipment identifiers must not leak by default');
});

test('RC1599: detects same-status resurfacing with unchanged per-shipment timestamps', () => {
  const before = make([shipment('REF9A','Abgeholt')]);
  const after = make([shipment('REF9A','POD vorhanden')]);
  const report = compareTeamStateSnapshots(before,after,{includeReferences:true});
  assert.equal(report.changes.pickedUpToPod,1);
  assert.equal(report.changes.pickedUpToPodWithoutTimestampChange,1);
  assert.equal(report.sensitiveReferences[0].reference,'REF9A');
});

test('RC1599: cross-collection conflicts and saved-only PODs are included', () => {
  const before = make([shipment('AB2','Abgeholt')], [shipment('AB2','Abgeholt'),shipment('ONLYSAVED','POD vorhanden')]);
  const after = make([shipment('AB2','Abgeholt')], [shipment('AB2','POD vorhanden'),shipment('ONLYSAVED','Abgeholt')]);
  const report = compareTeamStateSnapshots(before,after);
  assert.equal(report.after.conflictingStatuses,1);
  assert.equal(report.after.duplicatedAcrossCollections,1);
  assert.equal(report.changes.becameCrossCollectionConflict,1);
  assert.equal(report.changes.pickedUpToPod,1);
  assert.equal(report.changes.podToPickedUp,1);
});

test('RC1599: sub-shipment metadata cannot be mistaken for verified signed originals', () => {
  const record = shipment('B2026','POD vorhanden', {subShipments:[{podFiles:[{name:'pod.pdf',blobName:'rc995/production/mock/automatic/a.pdf'}]}]});
  const report = compareTeamStateSnapshots(make([record]),make([record]));
  assert.equal(report.before.entriesWithPodMetadata,1);
  assert.equal(report.before.entriesWithDurablePointers,1);
  assert.match(report.note,/NOT proof/);
});

test('RC1599: scan confirmations are not proof of a POD', () => {
  const report = compareTeamStateSnapshots(make([shipment('X11','POD vorhanden',{podFiles:[{kind:'scan-confirmation',blobName:'x'}]})]),make());
  assert.equal(report.before.entriesWithPodMetadata,0);
  assert.equal(report.changes.referencesMissingAfter,1);
});

test('RC1599: audit considers status and processStatus independently (even when the fields disagree)', () => {
  const a = make([shipment('DISCORD', 'Abgeholt', { processStatus: 'POD vorhanden' })]);
  const b = make([shipment('DISCORD', 'Abgeholt', { processStatus: 'Abgeholt' })]);
  const report = compareTeamStateSnapshots(a,b);
  assert.equal(report.before.sameEntryStatusDisagreement,1);
  assert.equal(report.before.podStatusEntries,1);
  assert.equal(report.after.sameEntryStatusDisagreement,0);
  assert.equal(report.changes.statusesChanged,1);
  assert.equal(report.changes.podToPickedUp,1);
});

test('RC1599/RC1603: equal-timestamp stale POD status cannot resurrect after server correction', () => {
  // The original regression demonstrably resurrected POD; RC1603 guards this ambiguous tie.
  // This test does not assert which writer caused the 89 production cases.
  const protectedRecord = shipment('FORENSIC1', 'Abgeholt');
  const staleBrowser = shipment('FORENSIC1', 'POD vorhanden');
  const original = JSON.stringify(protectedRecord);
  const result = mergeShipmentProtected(protectedRecord, staleBrowser);
  assert.equal(result.status, 'Abgeholt');
  assert.equal(result.processStatus, 'Abgeholt');
  assert.equal(JSON.stringify(protectedRecord), original, 'The reproduction must remain immutable');
});

test('RC1599: invalid snapshot rejects rather than inventing data', () => {
  assert.throws(()=>compareTeamStateSnapshots(null,make()),/Team-State snapshot/);
});

test('RC1608: duplicates inside a single collection are flagged instead of silently overwriting POD status', () => {
  const before = make([
    shipment('DUPPOD', 'POD vorhanden'),
    shipment('DUPPOD', 'Abgeholt')
  ]);
  const after = make([
    shipment('DUPPOD', 'Abgeholt'),
    shipment('DUPPOD', 'Abgeholt')
  ]);
  const beforeRaw = JSON.stringify(before);
  const afterRaw = JSON.stringify(after);
  const report = compareTeamStateSnapshots(before, after);
  assert.equal(report.before.ambiguousDuplicateReferences, 1);
  assert.equal(report.after.ambiguousDuplicateReferences, 1);
  assert.equal(report.changes.ambiguousDuplicateReferences, 1);
  assert.equal(report.structuralReviewRequired, true);
  assert.equal(report.changes.podToPickedUp, 0, 'Do not invent a pairing for ambiguous duplicates');
  assert.ok(!JSON.stringify(report).includes('DUPPOD'), 'References remain redacted');
  assert.equal(JSON.stringify(before), beforeRaw);
  assert.equal(JSON.stringify(after), afterRaw);
});

test('RC1608: duplicate in only the after snapshot is also flagged', () => {
  const before = make([shipment('DUPAFTER', 'POD vorhanden')]);
  const after = make([shipment('DUPAFTER', 'Abgeholt'), shipment('DUPAFTER', 'POD vorhanden')]);
  const report = compareTeamStateSnapshots(before, after, { includeReferences: true });
  assert.equal(report.before.ambiguousDuplicateReferences, 0);
  assert.equal(report.after.ambiguousDuplicateReferences, 1);
  assert.equal(report.changes.ambiguousDuplicateReferences, 1);
  assert.ok(report.sensitiveReferences.some(x => x.kind === 'ambiguous-duplicate-reference'));
});

test('RC1608: malformed or partial snapshots fail closed instead of reporting zero differences', () => {
  const valid = make();
  assert.throws(() => compareTeamStateSnapshots({ state: {} }, valid), /shipments or savedShipments array required/);
  assert.throws(() => compareTeamStateSnapshots({ state: { shipments: {} } }, valid), /shipments or savedShipments array required/);
  assert.throws(() => compareTeamStateSnapshots({ state: { shipments: [], savedShipments: {} } }, valid), /savedShipments must be an array/);
  assert.throws(() => compareTeamStateSnapshots({ state: null }, valid), /state must be an object/);
});

test('RC1608: distinct collections remain comparable without duplicate warnings', () => {
  const before = make([shipment('BOTH', 'POD vorhanden')],[shipment('BOTH', 'POD vorhanden')]);
  const after = make([shipment('BOTH', 'Abgeholt')],[shipment('BOTH', 'POD vorhanden')]);
  const report = compareTeamStateSnapshots(before, after);
  assert.equal(report.changes.podToPickedUp, 1);
  assert.equal(report.changes.ambiguousDuplicateReferences, 0);
  assert.equal(report.structuralReviewRequired, false);
});

test('RC1608: disappearing collection copy is included in manual-review count', () => {
  const before = make([shipment('ONE', 'Abgeholt')],[shipment('ONE', 'POD vorhanden')]);
  const after = make([shipment('ONE', 'Abgeholt')],[]);
  const report = compareTeamStateSnapshots(before, after);
  assert.equal(report.changes.missingCollectionCopiesAfter, 1);
  assert.equal(report.structuralReviewRequired, true);
});
