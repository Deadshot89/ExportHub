#!/usr/bin/env node
// RC1611 P0 (#899): Offline audit-log manifest, read-only and reference-redacted.
// Inputs are trusted local copies of the ORIGINAL Github Actions log, never Azure.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PREFIX = 'PRODUCTION POD integrity audit ';
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const refOf = value => String(value ?? '').trim().toUpperCase();

export function summarizePodAuditLog(content, options = {}) {
  if (typeof content !== 'string') throw new TypeError('Audit log must be text');
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const pos = line.indexOf(PREFIX + '{');
    if (pos < 0) continue;
    let batch;
    try { batch = JSON.parse(line.slice(pos + PREFIX.length)); }
    catch (_) { throw new Error('Malformed RC1144 audit batch JSON'); }
    rows.push(batch);
  }
  if (!rows.length) throw new Error('No RC1144 PRODUCTION audit batches found');
  const seenBatches = new Set(), seenReferences = new Set(), seenBackupNames = new Set();
  const reviews = [], totals = { checked: 0, downloadable: 0, recovered: 0, downgradedEssentra: 0, downgradedOther: 0, removedPodEntries: 0 };
  const codes = {};
  let expectedCursor = 0, totalShipments = null, verifiedBackups = 0, finalReached = false;
  for (const [index, row] of rows.entries()) {
    if (!row || row.ok !== true || row.httpStatus !== 200 || row.batch !== index + 1 ||
        seenBatches.has(row.batch)) throw new Error('Invalid or repeated audit batch sequence');
    seenBatches.add(row.batch);
    if (!nonnegative(row.totalShipments) || !nonnegative(row.cursor) ||
        row.cursor !== expectedCursor || !nonnegative(row.checked)) throw new Error('Incomplete audit coverage or invalid cursor');
    if (totalShipments === null) totalShipments = row.totalShipments;
    if (row.totalShipments !== totalShipments) throw new Error('Team-State size changed across audit batches');
    for (const key of Object.keys(totals)) {
      if (!nonnegative(row[key])) throw new Error('Missing or invalid audit counter: ' + key);
      totals[key] += row[key];
    }
    // Every batch must reconcile independently; otherwise compensating errors in
    // different batches can disguise a partial or double-counted status mutation.
    if (row.checked !== row.downloadable + row.recovered + row.downgradedEssentra + row.downgradedOther)
      throw new Error('Audit counters differ within a batch');
    if (!row.backup || row.backup.verified !== true || !String(row.backup.name || '').includes('team-state-before-RC1440-pod-integrity-'))
      throw new Error('Missing verified pre-mutation audit backup');
    if (seenBackupNames.has(row.backup.name)) throw new Error('Repeated pre-mutation backup across audit batches');
    seenBackupNames.add(row.backup.name);
    verifiedBackups++;
    if (!Array.isArray(row.broken) || row.broken.length !== row.downgradedEssentra + row.downgradedOther)
      throw new Error('Downgrade counters differ from affected-case evidence');
    if (!Array.isArray(row.recordCleanupErrors) || row.recordCleanupErrors.length)
      throw new Error('Unresolved pickup record cleanup errors in audit log');
    for (const item of row.broken) {
      const ref = refOf(item?.reference);
      if (!ref || seenReferences.has(ref)) throw new Error('Missing or repeated affected shipment reference');
      if (typeof item.essentra !== 'boolean' || !item.code) throw new Error('Invalid affected shipment classification');
      seenReferences.add(ref);
      codes[item.code] = (codes[item.code] || 0) + 1;
      reviews.push({
        reference: ref, essentra: item.essentra, reason: String(item.code),
        batch: row.batch, backupBlob: row.backup.name,
        reviewStatus: 'ORIGINAL_REQUIRED'
      });
    }
    if (row.broken.filter(x => x.essentra).length !== row.downgradedEssentra)
      throw new Error('Essentra downgrade classification inconsistent');
    if (row.nextCursor === null) {
      if (index !== rows.length - 1 || row.cursor >= totalShipments) throw new Error('Premature or repeated audit end');
      finalReached = true;
      expectedCursor = totalShipments;
    } else {
      if (!nonnegative(row.nextCursor) || row.nextCursor <= row.cursor || row.nextCursor > totalShipments)
        throw new Error('Invalid or non-monotonic audit cursor');
      expectedCursor = row.nextCursor;
    }
  }
  if (!finalReached || expectedCursor !== totalShipments || totals.checked !== totals.downloadable + totals.recovered +
      totals.downgradedEssentra + totals.downgradedOther)
    throw new Error('Audit is not complete or case totals do not reconcile');
  const report = {
    version: 'RC1611', source: 'RC1144 production log', readOnly: true,
    note: 'POD_NOT_DOWNLOADABLE is not proof of a lost original signature. No automatic status changes.',
    batches: rows.length, totalShipments, verifiedBackups,
    distinctAffectedReferences: seenReferences.size,
    ...totals, codes, originalReviewOutstanding: reviews.length
  };
  if (options.includeReferences === true) {
    report.sensitiveReviewManifest = reviews;
    report.warning = 'CONFIDENTIAL: never upload these references or backup blob paths to public CI, GitHub issues, or chat.';
  }
  return report;
}

export function runCli(args) {
  const filenameIndex = args.indexOf('--input');
  if (args.includes('--help') || filenameIndex === -1 || !args[filenameIndex + 1]) {
    process.stderr.write('Usage: node scripts/rc1611-pod-audit-ledger.mjs --input /secure/rc1144.log [--show-refs]\n');
    return args.includes('--help') ? 0 : 2;
  }
  try {
    const content = fs.readFileSync(args[filenameIndex + 1], 'utf8');
    const includeReferences = args.includes('--show-refs');
    if (includeReferences) process.stderr.write('CONFIDENTIAL: output contains real shipment references and backup blob names.\n');
    const report = summarizePodAuditLog(content, { includeReferences });
    report.sourceSha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return 0;
  } catch (error) {
    process.stderr.write('RC1611 audit rejected: ' + String(error && error.message || 'INVALID_LOG').slice(0,180) + '\n');
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = runCli(process.argv.slice(2));
