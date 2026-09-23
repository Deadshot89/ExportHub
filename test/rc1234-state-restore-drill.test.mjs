import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {verifyStateRestore,shipmentReferences}=require('../api/shared/state-restore-drill.js');
const API='api/state-maintenance/index.js';
const WF='.github/workflows/rc1137-state-compaction.yml';

test('RC1234: bytegenauer Restore bestätigt Hash, Revision und Sendungszuordnung',()=>{
 const doc={schemaVersion:3,revision:17,users:[{id:'U1'}],state:{shipments:[
  {id:'S1',reference:'ABC123',rows:[{count:1}]},
  {id:'S2',ref:'ZX9K2P',rows:[{count:2}]}
 ]}};
 const source=Buffer.from(JSON.stringify(doc),'utf8'),restored=Buffer.from(source);
 const result=verifyStateRestore(source,restored);
 assert.equal(result.verified,true);
 assert.equal(result.bytes,source.length);
 assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.equal(result.revision,17);
 assert.equal(result.shipmentReferenceCount,2);
 assert.equal(result.shipmentReferencesVerified,true);
 assert.deepEqual(shipmentReferences(doc),['ABC123','ZX9K2P']);
});

test('RC1234: beschädigte Restore-Datei schlägt fail-closed fehl',()=>{
 const source=Buffer.from(JSON.stringify({revision:1,state:{shipments:[{ref:'ABC123'}]},users:[]}),'utf8');
 const damaged=Buffer.from(source);damaged[damaged.length-2]^=1;
 assert.throws(()=>verifyStateRestore(source,damaged),e=>e&&e.code==='RESTORE_HASH_MISMATCH');
});

test('RC1234: Backup wird nach Upload vollständig zurückgelesen',()=>{
 const source=fs.readFileSync(API,'utf8');
 assert.match(source,/const readBack=await readBuffer\(blob\)/);
 assert.match(source,/readBack\.buffer\.length!==bytes/);
 assert.match(source,/readBackHash!==hash/);
 assert.match(source,/readBackVerified:true/);
});

test('RC1234: Restore-Drill ist strikt auf TESTSERVICE begrenzt und nutzt isolierten Zielblob',()=>{
 const source=fs.readFileSync(API,'utf8');
 assert.match(source,/action==='restore-drill'&&environment!=='testservice'/);
 assert.match(source,/testservice\/recovery-drills\/team-state-restore-drill-latest\.json/);
 assert.match(source,/verifyStateRestore\(source\.buffer,restored\.buffer\)/);
 assert.match(source,/shipmentReferencesVerified/);
 assert.doesNotMatch(source,/production\/recovery-drills/);
});

test('RC1234: Deploy-Nachlauf verlangt erfolgreichen TESTSERVICE-Restore vor PRODUCTION-Wartung',()=>{
 const source=fs.readFileSync(WF,'utf8');
 const testservice=source.slice(source.indexOf('jobs:'),source.indexOf('  production:'));
 const production=source.slice(source.indexOf('  production:'));
 assert.match(testservice,/call_maintenance restore-drill/);
 assert.match(testservice,/backupReadBackVerified/);
 assert.match(testservice,/shipmentReferencesVerified/);
 assert.doesNotMatch(production,/call_maintenance restore-drill/);
 assert.match(production,/needs:\s*\n\s*- testservice/);
});

test('RC1234: geänderte Runtime-Dateien bleiben syntaktisch gültig',()=>{
 for(const file of ['api/shared/state-restore-drill.js',API]){
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
 }
});
