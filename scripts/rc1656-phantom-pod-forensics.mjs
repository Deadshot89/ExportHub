#!/usr/bin/env node
// RC1656 / P0 #987: offline, read-only snapshot triage for anomalous POD states.
// A missing evidence field in Team-State never proves an original POD is invalid.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const COLLECTIONS = ['shipments', 'savedShipments'];
const UPPER = value => String(value ?? '').trim().toUpperCase();
const TEXT = value => String(value ?? '').trim();
const LOWER = value => TEXT(value).toLocaleLowerCase('de-DE');
const POD = new Set(['pod vorhanden', 'pod available']);
const PRE_PICKUP = new Set(['entwurf','erstellt','bereit zur abholung','wartet auf abd',
  'draft','created','ready for pickup','waiting for abd']);

function stateOf(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document))
    throw new TypeError('A Team-State JSON object is required');
  const state = Object.hasOwn(document, 'state') ? document.state : document;
  if (!state || typeof state !== 'object' || Array.isArray(state))
    throw new TypeError('Team-State must be an object');
  if (!COLLECTIONS.some(key => Array.isArray(state[key])))
    throw new TypeError('At least one shipment collection array is required');
  for (const key of COLLECTIONS)
    if (Object.hasOwn(state,key) && !Array.isArray(state[key]))
      throw new TypeError('Shipment collection must be an array');
  return state;
}
function referenceOf(sh) {
  for (const key of ['ref','reference','shipmentRef','referenceNumber','referenceNo',
    'refNo','refNr','sendungsnummer','exporthubRef','exportHubReference'])
    if (TEXT(sh[key])) return UPPER(sh[key]);
  return '';
}
function signedPickupClaim(sh) {
  const direct = value => TEXT(value);
  const histories = [
    ...(Array.isArray(sh.pickupHistory) ? sh.pickupHistory : []),
    ...(Array.isArray(sh.subShipments) ? sh.subShipments.flatMap(sub =>
      Array.isArray(sub?.pickupHistory) ? sub.pickupHistory : []) : [])
  ];
  if (histories.some(h => h && typeof h === 'object' && direct(h.confirmedAt) &&
    (direct(h.signatureBlobName) || h.signatureStored === true))) return true;
  const confirmed = direct(sh.pickupConfirmedAt || sh.qrPickupConfirmedAt || sh.confirmedAt);
  const signature = direct(sh.signatureBlobName || sh.driverSignature || sh.pickupDriverSignature ||
    sh.driverSignatureUrl || sh.pickupDriverSignatureUrl);
  return Boolean(confirmed && signature);
}
function manualPickupClaim(sh) {
  return Boolean(TEXT(sh.manualPickupConfirmedAt) && TEXT(sh.manualPickupConfirmedBy));
}
function durablePodPointers(sh) {
  const files = [
    ...(Array.isArray(sh.podFiles) ? sh.podFiles : []),
    ...(Array.isArray(sh.subShipments) ? sh.subShipments.flatMap(sub =>
      Array.isArray(sub?.podFiles) ? sub.podFiles : []) : [])
  ];
  return files.filter(f => f && typeof f === 'object' && LOWER(f.kind) !== 'scan-confirmation' &&
    TEXT(f.blobName || f.storageBlobName || f.path || f.storagePath)).length;
}
function rowOf(sh, collection) {
  if (!sh || typeof sh !== 'object' || Array.isArray(sh))
    throw new TypeError('Invalid shipment record');
  const statuses = [sh.status,sh.processStatus,sh.shipmentStatus].map(LOWER).filter(Boolean);
  return {
    reference:referenceOf(sh), id:TEXT(sh.id || sh.shipmentId),
    collection, pod:statuses.some(s => POD.has(s)), prePickup:statuses.some(s => PRE_PICKUP.has(s)),
    statusConflict:new Set(statuses).size > 1,
    statusLabels:statuses.map(s => POD.has(s) ? 'POD' : PRE_PICKUP.has(s) ? 'PRE_PICKUP' : 'OTHER'),
    signedClaim:signedPickupClaim(sh), manualClaim:manualPickupClaim(sh),
    pointers:durablePodPointers(sh), flagged:sh.podReviewRequired === true
  };
}
function empty() {
  return {
    totalEntries:0, uniqueReferences:0, missingReferences:0, podStatusEntries:0,
    podStatusWithoutSignedPickupClaim:0, podStatusWithSignedPickupClaim:0,
    podStatusWithManualOnlyClaim:0, podStatusWithDurablePointersButNoSignedPickupClaim:0,
    podStatusAlreadyFlaggedForReview:0, perRecordStatusConflicts:0,
    crossCollectionPodVsPrePickup:0, duplicateReferencesWithinCollection:0,
    recycledIdAcrossDifferentReferences:0
  };
}
export function inspectPhantomPodSnapshot(document, options = {}) {
  const state = stateOf(document), rows = [];
  for (const collection of COLLECTIONS)
    for (const sh of (state[collection] || [])) rows.push(rowOf(sh,collection));
  const summary = empty(), refs = new Map(), ids = new Map(), sensitive = [];
  summary.totalEntries = rows.length;
  for (const row of rows) {
    if (!row.reference) summary.missingReferences++;
    else {
      if (!refs.has(row.reference)) refs.set(row.reference,[]);
      refs.get(row.reference).push(row);
    }
    if (row.id && row.reference) {
      if (!ids.has(row.id)) ids.set(row.id,new Set());
      ids.get(row.id).add(row.reference);
    }
    if (row.statusConflict) summary.perRecordStatusConflicts++;
    if (row.pod) {
      summary.podStatusEntries++;
      if (row.signedClaim) summary.podStatusWithSignedPickupClaim++;
      else {
        summary.podStatusWithoutSignedPickupClaim++;
        if (row.manualClaim) summary.podStatusWithManualOnlyClaim++;
        if (row.pointers) summary.podStatusWithDurablePointersButNoSignedPickupClaim++;
        if (row.flagged) summary.podStatusAlreadyFlaggedForReview++;
        sensitive.push({reference:row.reference,collection:row.collection,
          finding:'POD_STATUS_WITHOUT_SIGNED_PICKUP_CLAIM',
          manualPickupClaim:row.manualClaim, durablePodPointers:row.pointers});
      }
    }
  }
  summary.uniqueReferences = refs.size;
  for (const [reference,records] of refs) {
    const perCollection = new Map();
    for (const row of records) {
      perCollection.set(row.collection,(perCollection.get(row.collection)||0)+1);
    }
    if ([...perCollection.values()].some(count=>count>1)) {
      summary.duplicateReferencesWithinCollection++;
      sensitive.push({reference,finding:'DUPLICATE_REFERENCE_WITHIN_COLLECTION'});
    }
    const pod = records.some(row=>row.pod);
    const pre = records.some(row=>row.prePickup);
    if (pod && pre && new Set(records.map(r=>r.collection)).size>1) {
      summary.crossCollectionPodVsPrePickup++;
      sensitive.push({reference,finding:'POD_VS_PREPICKUP_CROSS_COLLECTION'});
    }
  }
  for (const refSet of ids.values()) {
    if (refSet.size<2) continue;
    summary.recycledIdAcrossDifferentReferences++;
    sensitive.push({references:[...refSet].sort(),finding:'ID_REUSED_WITH_DIFFERENT_REFERENCES'});
  }
  const result = {
    version:'RC1656', readOnly:true,
    evidenceLimit:'Team-State fields, status and Blob pointers do NOT authenticate POD PDFs, driver signatures or server pickup records. Missing fields are review candidates, not proof of phantom POD or lost originals.',
    summary,
    reviewRequired:summary.podStatusWithoutSignedPickupClaim>0 ||
      summary.crossCollectionPodVsPrePickup>0 ||
      summary.duplicateReferencesWithinCollection>0 ||
      summary.recycledIdAcrossDifferentReferences>0 ||
      summary.missingReferences>0
  };
  if (options.includeReferences === true) {
    result.sensitiveFindings = sensitive;
    result.warning = 'Contains shipment references. Keep within protected administration environment; never paste into public GitHub Issues, logs or CI.';
  }
  return result;
}
export function runCli(args) {
  const idx=args.indexOf('--input');
  if (args.includes('--help')) {
    process.stderr.write('Usage: node scripts/rc1656-phantom-pod-forensics.mjs --input /secure/team-state.json [--show-refs]\n');
    return 0;
  }
  if (idx<0 || !args[idx+1]) {
    process.stderr.write('Missing --input Team-State JSON file\n');
    return 2;
  }
  try {
    const bytes=fs.readFileSync(args[idx+1]);
    const document=JSON.parse(bytes.toString('utf8'));
    const report=inspectPhantomPodSnapshot(document,{includeReferences:args.includes('--show-refs')});
    report.sourceSha256=crypto.createHash('sha256').update(bytes).digest('hex');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    return 0;
  } catch(err) {
    // Never echo source path, reference, or raw parser messages from customer data.
    process.stderr.write('RC1656: unable to read or validate the Team-State snapshot\n');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode=runCli(process.argv.slice(2));
