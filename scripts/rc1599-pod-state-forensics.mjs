#!/usr/bin/env node
// RC1599 – Offline, read-only comparison of existing Team-State backup snapshots.
// Never calls Azure, does not alter shipment data, and redacts references by default.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const COLLECTIONS = ['shipments', 'savedShipments'];
const UPPER = value => String(value ?? '').trim().toUpperCase();
const STRING = value => String(value ?? '').trim();
const STATUS = value => STRING(value).toLocaleLowerCase('de-DE');
const POD_STATUS = new Set(['pod vorhanden', 'pod available']);
const PICKED_UP = new Set(['abgeholt', 'picked up', 'collected']);

function stateOf(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new TypeError('Expected a JSON object with a Team-State snapshot');
  const state = Object.prototype.hasOwnProperty.call(document, 'state') ? document.state : document;
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Malformed Team-State snapshot: state must be an object');
  if (!['shipments', 'savedShipments'].some(key => Array.isArray(state[key])))
    throw new TypeError('Malformed Team-State snapshot: shipments or savedShipments array required');
  for (const key of COLLECTIONS) {
    if (Object.prototype.hasOwnProperty.call(state, key) && !Array.isArray(state[key]))
      throw new TypeError('Malformed Team-State snapshot: ' + key + ' must be an array');
  }
  return state;
}
function referenceOf(sh) {
  const candidates = ['ref', 'reference', 'shipmentRef', 'referenceNumber', 'referenceNo', 'refNo', 'refNr', 'sendungsnummer', 'exporthubRef', 'exportHubReference'];
  for (const key of candidates) if (STRING(sh?.[key])) return UPPER(sh[key]);
  return '';
}
function podFilesOf(sh) {
  const files = Array.isArray(sh?.podFiles) ? sh.podFiles : [];
  const subs = Array.isArray(sh?.subShipments) ? sh.subShipments : [];
  return [...files, ...subs.flatMap(sub => Array.isArray(sub?.podFiles) ? sub.podFiles : [])]
    .filter(file => file && typeof file === 'object' && STATUS(file.kind) !== 'scan-confirmation');
}
function durableFileCount(sh) {
  return podFilesOf(sh).filter(file => STRING(file.blobName || file.storageBlobName || file.path || file.storagePath)).length;
}
function snapshotOf(doc) {
  const state = stateOf(doc), map = new Map(), entries = [], unreferenced = [];
  for (const collection of COLLECTIONS) {
    for (const [index, sh] of (Array.isArray(state[collection]) ? state[collection] : []).entries()) {
      if (!sh || typeof sh !== 'object') continue;
      const ref = referenceOf(sh);
      if (!ref) { unreferenced.push({ collection, index }); continue; }
      const data = {
        collection, reference: ref, status: STATUS(sh.status), processStatus: STATUS(sh.processStatus),
        updatedAt: STRING(sh.updatedAt), syncUpdatedAt: STRING(sh._syncUpdatedAt),
        podFileCount: podFilesOf(sh).length, durableFileCount: durableFileCount(sh)
      };
      entries.push(data);
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref).push(data);
    }
  }
  return { entries, map, unreferenced };
}
function statusConflict(entries) {
  const seen = new Set(entries.flatMap(row => [row.status, row.processStatus]).filter(Boolean));
  return entries.length > 1 && seen.size > 1;
}
function hasSameCollectionDuplicate(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.collection)) return true;
    seen.add(row.collection);
  }
  return false;
}
function aggregate(s) {
  return {
    entries: s.entries.length, uniqueReferences: s.map.size,
    unreferenced: s.unreferenced.length,
    duplicatedAcrossCollections: [...s.map.values()].filter(rows => new Set(rows.map(row => row.collection)).size > 1).length,
    ambiguousDuplicateReferences: [...s.map.values()].filter(hasSameCollectionDuplicate).length,
    conflictingStatuses: [...s.map.values()].filter(statusConflict).length,
    sameEntryStatusDisagreement: s.entries.filter(row => row.status && row.processStatus && row.status !== row.processStatus).length,
    podStatusEntries: s.entries.filter(row => POD_STATUS.has(row.status) || POD_STATUS.has(row.processStatus)).length,
    entriesWithPodMetadata: s.entries.filter(row => row.podFileCount > 0).length,
    entriesWithDurablePointers: s.entries.filter(row => row.durableFileCount > 0).length
  };
}
export function compareTeamStateSnapshots(beforeDoc, afterDoc, options = {}) {
  const before = snapshotOf(beforeDoc), after = snapshotOf(afterDoc);
  const flags = {
    statusesChanged: 0, podToPickedUp: 0, pickedUpToPod: 0,
    pickedUpToPodWithoutTimestampChange: 0, podMetadataRemoved: 0,
    podMetadataAdded: 0, becameCrossCollectionConflict: 0,
    referencesMissingAfter: 0, referencesNewAfter: 0,
    ambiguousDuplicateReferences: 0, missingCollectionCopiesAfter: 0
  };
  const changes = [];
  for (const [reference, prevRows] of before.map) {
    const nextRows = after.map.get(reference);
    if (!nextRows) { flags.referencesMissingAfter++; changes.push({ reference, kind: 'reference-missing-after' }); continue; }
    // Never collapse two rows of one reference in the same collection into a Map.
    // Without a stable per-row identity, pairing them would fabricate forensic evidence.
    if (hasSameCollectionDuplicate(prevRows) || hasSameCollectionDuplicate(nextRows)) {
      flags.ambiguousDuplicateReferences++;
      changes.push({ reference, kind: 'ambiguous-duplicate-reference' });
      continue;
    }
    const beforeByCollection = new Map(prevRows.map(x => [x.collection, x]));
    const afterByCollection = new Map(nextRows.map(x => [x.collection, x]));
    if (!statusConflict(prevRows) && statusConflict(nextRows)) flags.becameCrossCollectionConflict++;
    for (const [collection, prev] of beforeByCollection) {
      const next = afterByCollection.get(collection);
      if (!next) { flags.missingCollectionCopiesAfter++; changes.push({ reference, collection, kind: 'missing-collection-copy' }); continue; }
      const a = prev.status || prev.processStatus, b = next.status || next.processStatus;
      if (prev.status !== next.status || prev.processStatus !== next.processStatus) {
        flags.statusesChanged++;
        const beforePod = POD_STATUS.has(prev.status) || POD_STATUS.has(prev.processStatus);
        const afterPod = POD_STATUS.has(next.status) || POD_STATUS.has(next.processStatus);
        const beforePicked = PICKED_UP.has(prev.status) || PICKED_UP.has(prev.processStatus);
        const afterPicked = PICKED_UP.has(next.status) || PICKED_UP.has(next.processStatus);
        const downgrade = beforePod && afterPicked && !afterPod;
        const resurrected = beforePicked && afterPod && !beforePod;
        if (downgrade) flags.podToPickedUp++;
        if (resurrected) flags.pickedUpToPod++;
        if (resurrected && prev.updatedAt === next.updatedAt && prev.syncUpdatedAt === next.syncUpdatedAt)
          flags.pickedUpToPodWithoutTimestampChange++;
        changes.push({ reference, collection, kind: downgrade ? 'pod-downgraded' : resurrected ? 'pod-status-reappeared' : 'status-changed' });
      }
      if (prev.podFileCount > next.podFileCount) { flags.podMetadataRemoved++; changes.push({ reference, collection, kind: 'pod-metadata-decreased' }); }
      if (prev.podFileCount < next.podFileCount) { flags.podMetadataAdded++; changes.push({ reference, collection, kind: 'pod-metadata-increased' }); }
    }
  }
  for (const reference of after.map.keys()) if (!before.map.has(reference)) flags.referencesNewAfter++;
  const report = {
    version: 'RC1599', readOnly: true,
    note: 'POD file metadata is NOT proof of valid PDFs or signatures; verify originals separately.',
    before: aggregate(before), after: aggregate(after), changes: flags,
    structuralReviewRequired: Boolean(flags.ambiguousDuplicateReferences || before.unreferenced.length ||
      after.unreferenced.length || flags.referencesMissingAfter || flags.missingCollectionCopiesAfter)
  };
  if (options.includeReferences === true) {
    report.sensitiveReferences = changes;
    report.warning = 'Contains customer shipment references; do not upload to public CI logs, GitHub issues, or PRs.';
  }
  return report;
}
function printUsage() {
  process.stderr.write('Usage: node scripts/rc1599-pod-state-forensics.mjs --before <state-backup.json> --after <state-backup.json> [--show-refs]\n');
  process.stderr.write('Offline, read-only. References are withheld unless --show-refs is explicitly supplied.\n');
}
export function runCli(args) {
  if (args.includes('--help')) { printUsage(); return 0; }
  const beforeFlag = args.indexOf('--before'), afterFlag = args.indexOf('--after');
  if (beforeFlag < 0 || afterFlag < 0 || !args[beforeFlag + 1] || !args[afterFlag + 1]) { printUsage(); return 2; }
  try {
    const load = path => {
      const bytes = fs.readFileSync(path);
      return { document: JSON.parse(bytes.toString('utf8')), sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    };
    const before = load(args[beforeFlag + 1]), after = load(args[afterFlag + 1]);
    const report = compareTeamStateSnapshots(before.document, after.document, { includeReferences: args.includes('--show-refs') });
    report.sourceSha256 = { before: before.sha256, after: after.sha256 };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return 0;
  } catch (error) {
    process.stderr.write('RC1599 unable to read valid JSON snapshots: ' + String(error.code || error.name || 'ERROR') + '\n');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = runCli(process.argv.slice(2));
