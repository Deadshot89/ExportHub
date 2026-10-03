import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const graphSource=fs.readFileSync('api/shared/graph-mail.js','utf8');
const readinessSource=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');
const reminderSource=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const mutationSource=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const graph=require('../api/shared/graph-mail.js');

test('RC1290: Mail.Send-Application-Permission ist zentral und exakt beschrieben',()=>{
  const p=graph.permissionRequirement();
  assert.equal(p.resource,'Microsoft Graph');
  assert.equal(p.type,'Application');
  assert.equal(p.name,'Mail.Send');
  assert.equal(p.id,'b633e1c5-b582-4048-a93e-9f11b44c7e96');
  assert.equal(p.adminConsentRequired,true);
  assert.match(graphSource,/MAIL_SEND_PERMISSION=Object\.freeze/);
});

test('RC1290: Readiness liefert Remediation nur beim echten Permission-Blocker',()=>{
  assert.match(readinessSource,/graphMail\.permissionRequirement\(\)/);
  assert.match(readinessSource,/requiredPermission:authProbe\.audienceOk===true&&authProbe\.mailSendGranted!==true\?permission:undefined/);
  assert.match(readinessSource,/GRAPH_MAIL_PERMISSION_MISSING/);
  assert.match(readinessSource,/version:'RC1290'/);
});

test('RC1290: Release akzeptiert bekannten Blocker nur mit exakt erwarteter Graph-Rolle',()=>{
  assert.match(workflow,/requirement\.resource==='Microsoft Graph'/);
  assert.match(workflow,/requirement\.type==='Application'/);
  assert.match(workflow,/requirement\.name==='Mail\.Send'/);
  assert.match(workflow,/requirement\.id==='b633e1c5-b582-4048-a93e-9f11b44c7e96'/);
  assert.match(workflow,/requirement\.adminConsentRequired===true/);
  assert.match(workflow,/Admin Consent erforderlich/);
});

test('RC1290: Remediation bleibt frei von Token- und Secret-Ausgabe',()=>{
  const readinessBlock=readinessSource.slice(readinessSource.indexOf('const environment=environmentOf'),readinessSource.indexOf('}catch(e)'));
  assert.doesNotMatch(readinessBlock,/clientSecret\s*:/);
  assert.doesNotMatch(readinessBlock,/access_token/);
  const permission=graph.permissionRequirement();
  assert.deepEqual(Object.keys(permission).sort(),['adminConsentRequired','id','name','resource','type'].sort());
});

test('RC1290: Graph- und Readiness-Code bleiben syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/shared/graph-mail.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/avis-upload-mail-readiness/index.js'],{stdio:'pipe'});
});

test('RC1427: Graph-sendMail trennt Auth-, Zugriffs- und Senderfehler ohne Secrets',()=>{
  assert.match(graphSource,/GRAPH_SEND_UNAUTHORIZED/);
  assert.match(graphSource,/GRAPH_SEND_FORBIDDEN/);
  assert.match(graphSource,/GRAPH_SENDER_NOT_FOUND/);
  assert.match(graphSource,/upstreamStatus=upstreamStatus/);
  assert.match(graphSource,/out\.sender=text\(sender\)/);
  const block=graphSource.slice(graphSource.indexOf('function sendFailure'),graphSource.indexOf('function transient'));
  assert.doesNotMatch(block,/access_token|clientSecret|Authorization:/i);
});

test('RC1428 P1: Originaler Graph-Fehlercode bleibt bis zur RC1255-Diagnose erhalten',()=>{
  assert.match(graphSource,/out\.upstreamCode=text\(e&&e\.code\)/);
  assert.match(reminderSource,/upstreamCode:text\(e&&e\.upstreamCode\)/);
  assert.match(mutationSource,/upstreamCode:String\(mailDiagnostic&&mailDiagnostic\.upstreamCode\|\|''\)/);
  const block=graphSource.slice(graphSource.indexOf('function sendFailure'),graphSource.indexOf('function transient'));
  assert.doesNotMatch(block,/access_token|clientSecret|Authorization:/i);
});
