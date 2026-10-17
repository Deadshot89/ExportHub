import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanText} from '../scripts/security-secret-scan.mjs';

test('RC1556 Security: Scanner erkennt hochkonfidente fest verdrahtete Secrets',()=>{
  const sample=[
    'OPENAI_API_KEY="sk-'+'a'.repeat(40)+'"',
    'x="github_pat_'+'A'.repeat(40)+'"',
    'AccountKey='+'A'.repeat(88),
    '-----BEGIN '+'PRIVATE KEY-----'
  ].join('\n');
  const findings=scanText('sample.env',sample);
  assert.ok(findings.length>=4,JSON.stringify(findings));
});

test('RC1556 Security: Scanner ignoriert Platzhalter und process.env',()=>{
  const safe=[
    'const key=process.env.OPENAI_API_KEY;',
    '"EXPORTHUB_INITIAL_ADMIN_PASSWORD":"<set-in-Azure-App-Settings>"',
    'clientSecret: process.env.EXPORTHUB_GRAPH_CLIENT_SECRET'
  ].join('\n');
  assert.deepEqual(scanText('safe.js',safe),[]);
});

test('RC1556 Security: gitignore blockiert typische lokale Secret-Dateien',()=>{
  const ignore=fs.readFileSync(new URL('../.gitignore',import.meta.url),'utf8');
  for(const pattern of ['.env','local.settings.json','*.pfx','*.p12','*.key','*.pem','.secrets/']){
    assert.match(ignore,new RegExp('^'+pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','m'),pattern+' fehlt');
  }
});

test('RC1556 Security: Security-Gate führt Secret-Scan aus',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(pkg.scripts['test:security']||'',/security-secret-scan\.mjs/);
});
