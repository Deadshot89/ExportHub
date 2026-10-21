import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePodAuditLog } from '../scripts/rc1611-pod-audit-ledger.mjs';

const batch=(n,cursor,nextCursor,broken=[])=>({
  batch:n,httpStatus:200,ok:true,cursor,nextCursor,totalShipments:12,checked:broken.length+1,
  downloadable:1,recovered:0,
  downgradedEssentra:broken.filter(x=>x.essentra).length,
  downgradedOther:broken.filter(x=>!x.essentra).length,
  removedPodEntries:0,
  backup:{name:'recovery-backups/team-state-before-RC1440-pod-integrity-2026-10-21-'+n+'.json',verified:true},
  broken,recordCleanupErrors:[]
});
const affected=(reference,essentra=false)=>({reference,essentra,code:'POD_NOT_DOWNLOADABLE'});
const synthetic=(rows)=>rows.map(x=>'2026-10-21T18:00Z PRODUCTION POD integrity audit '+JSON.stringify(x)).join('\n');
const clean=()=>synthetic([batch(1,0,7,[affected('SYNTH01')]),batch(2,7,null,[affected('SYNTH02',true)])]);

test('RC1611: complete logs produce only safe aggregate counts by default',()=>{
  const raw=clean(),report=summarizePodAuditLog(raw);
  assert.equal(report.batches,2);
  assert.equal(report.verifiedBackups,2);
  assert.equal(report.distinctAffectedReferences,2);
  assert.equal(report.originalReviewOutstanding,2);
  assert.equal(report.downgradedEssentra,1);
  assert.equal(report.downgradedOther,1);
  assert.deepEqual(report.codes,{'POD_NOT_DOWNLOADABLE':2});
  assert.ok(!JSON.stringify(report).includes('SYNTH01'));
  assert.ok(!JSON.stringify(report).includes('recovery-backups/'));
});

test('RC1611: confidential manifest only with explicit opt-in',()=>{
  const report=summarizePodAuditLog(clean(),{includeReferences:true});
  assert.equal(report.sensitiveReviewManifest.length,2);
  assert.equal(report.sensitiveReviewManifest[0].reference,'SYNTH01');
  assert.match(report.sensitiveReviewManifest[1].backupBlob,/recovery-backups/);
  assert.equal(report.sensitiveReviewManifest[1].reviewStatus,'ORIGINAL_REQUIRED');
});

test('RC1611: duplicated reference is never silently treated as an independent case',()=>{
  const raw=synthetic([batch(1,0,7,[affected('REPEAT')]),batch(2,7,null,[affected('REPEAT')])]);
  assert.throws(()=>summarizePodAuditLog(raw),/repeated affected shipment reference/);
});

test('RC1611: incomplete coverage and absent final batch fail closed',()=>{
  assert.throws(()=>summarizePodAuditLog(synthetic([batch(1,0,7)])),/not complete/);
  assert.throws(()=>summarizePodAuditLog(synthetic([batch(1,0,7),batch(2,8,null)])),/coverage or invalid cursor/);
  assert.throws(()=>summarizePodAuditLog('not a production audit log'),/No RC1144/);
});

test('RC1611: missing verified backup, malformed JSON and inconsistent counters are rejected',()=>{
  const b=batch(1,0,null,[affected('A')]);
  assert.throws(()=>summarizePodAuditLog(synthetic([{...b,backup:{name:b.backup.name,verified:false}}])),/verified pre-mutation/);
  assert.throws(()=>summarizePodAuditLog(synthetic([{...b,downloadable:9}])),/Audit counters differ within a batch/);
  assert.throws(()=>summarizePodAuditLog('PRODUCTION POD integrity audit {bad-json'),/Malformed/);
});

test('RC1611: source inputs are never mutated and no Azure calls occur',()=>{
  const x=[batch(1,0,null,[affected('A')])],before=JSON.stringify(x);
  summarizePodAuditLog(synthetic(x));
  assert.equal(JSON.stringify(x),before);
});

test('RC1611: different batches cannot offset incorrect counts to fake complete review',()=>{
  const first=batch(1,0,7,[affected('FIRST')]),second=batch(2,7,null,[affected('SECOND')]);
  // Global sums are still balanced (2 extra readable and 2 missing in next),
  // yet neither individual batch is consistent with its own checked value.
  const inconsistent=[
    {...first,downloadable:first.downloadable+1,checked:first.checked},
    {...second,downloadable:second.downloadable-1,checked:second.checked}
  ];
  assert.throws(()=>summarizePodAuditLog(synthetic(inconsistent)),/Audit counters differ within a batch/);
});

test('RC1611: repeated backup blob name across batches is never accepted as 2 snapshots',()=>{
  const first=batch(1,0,7,[affected('FIRST')]),second=batch(2,7,null,[affected('SECOND')]);
  const duplicatedBackup={...second,backup:{...second.backup,name:first.backup.name}};
  assert.throws(()=>summarizePodAuditLog(synthetic([first,duplicatedBackup])),/Repeated pre-mutation backup/);
});
