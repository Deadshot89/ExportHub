import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>fs.readFileSync(path,'utf8');
const proofPath='.github/rc1591/verify-registration-live.mjs';
const mainPath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const prodPath='.github/workflows/exporthub-production-release.yml';

test('RC1591: standalone read-only live proof is syntactically valid',()=>{
  execFileSync(process.execPath,['--check',proofPath],{stdio:'pipe'});
  const source=read(proofPath);
  for(const required of [
    "testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'",
    "production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'",
    'result.deployment?.verified',
    'result.deployment?.environment',
    'result.deployment?.buildId',
    'maxAgeMs=2*60*60*1000',
    'registrationConfirmedForMail',
    "q(row.type).toLowerCase()!=='registration-confirmed'",
    "type:'registration-confirmed'",
    'shipmentHistory.registration.confirmButton',
    "for(const language of ['de','en','pl','es','fr','it'])"
  ])assert.ok(source.includes(required),'RC1591 release proof missing '+required);
  assert.match(source,/fetch\(url,\{redirect:'follow',cache:'no-store'/);
  assert.doesNotMatch(source,/\bmethod:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
});

test('RC1591: testservice marker verification follows SHA identity and precedes live browser gate',()=>{
  const source=read(mainPath);
  const identity=source.indexOf('- name: RC1553 TESTSERVICE deployment identity prüfen');
  const proof=source.indexOf('- name: RC1591 Registrierungs-Automatik TESTSERVICE live nachweisen');
  const browser=source.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  assert.ok(identity>=0&&proof>identity&&browser>proof);
  assert.match(source.slice(proof,browser),/node \.github\/rc1591\/verify-registration-live\.mjs testservice/);
});

test('RC1591: production marker verification only happens after deploy and confirmed release SHA',()=>{
  const source=read(prodPath);
  const upload=source.indexOf('- name: Deploy ExportHUB production');
  const identity=source.indexOf('- name: RC1553 PRODUCTION deployment identity prüfen');
  const proof=source.indexOf('- name: RC1591 Registrierungs-Automatik PRODUCTION live nachweisen');
  const portal=source.indexOf('- name: RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen');
  assert.ok(upload>=0&&identity>upload&&proof>identity&&portal>proof);
  assert.match(source.slice(proof,portal),/node \.github\/rc1591\/verify-registration-live\.mjs production/);
  assert.match(source,/PRODUCTION FREIGEBEN/);
  assert.match(source,/Erfolgreiche Main Verification für Release-SHA verlangen/);
});
