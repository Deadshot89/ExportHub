import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/customer-avis/index.js','utf8');

test('RC1102: sicherer Avis-Snapshot wird vor einem Team-State-Read ausgewertet',()=>{
  const start=source.indexOf("if(req.method==='POST'&&(action==='issue'||action==='disable'))");
  const end=source.indexOf("if(req.method==='POST'&&action==='authorize')",start);
  assert.ok(start>=0&&end>start,'Issue-/Disable-Zweig fehlt');
  const block=source.slice(start,end);
  const snapshot=block.indexOf('payload.shipmentSnapshot');
  const teamRead=block.indexOf('readTeam(blob)');
  assert.ok(snapshot>=0,'Snapshot-Fast-Path fehlt');
  assert.ok(teamRead>=0,'Team-State-Fallback fehlt');
  assert.ok(snapshot<teamRead,'Der sichere Snapshot muss vor dem großen Team-State-Fallback geprüft werden.');
});
