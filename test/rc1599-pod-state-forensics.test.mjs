import test from 'node:test';
import assert from 'node:assert/strict';
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

test('RC1599: invalid snapshot rejects rather than inventing data', () => {
  assert.throws(()=>compareTeamStateSnapshots(null,make()),/Team-State snapshot/);
});
