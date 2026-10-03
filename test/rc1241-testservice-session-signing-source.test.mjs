import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const authSource=fs.readFileSync('api/shared/auth-store.js','utf8');
const stateSource=fs.readFileSync('api/exporthub-state/index.js','utf8');
const runtimeSource=fs.readFileSync('api/exporthub-state/runtime.js','utf8');
const functionConfig=JSON.parse(fs.readFileSync('api/exporthub-state/function.json','utf8'));

test('RC1241: zentrale Auth-Signatur nutzt AzureWebJobsStorage als Storage-Fallback',()=>{
  assert.match(authSource,/function connectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
});

test('RC1241: exporthub-state Runtime leitet das Signatur-Secret aus derselben Fallback-Kette ab',()=>{
  assert.equal(functionConfig.scriptFile,'runtime.js');
  assert.match(runtimeSource,/function sessionSigningConnectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
  assert.match(runtimeSource,/const source=configured\|\|sessionSigningConnectionString\(\);/);
  assert.match(runtimeSource,/if\(!configured&&source\)process\.env\.EXPORTHUB_AUTH_SIGNING_SECRET=source;/);
  assert.match(runtimeSource,/module\.exports = require\('\.\/index'\);/);
});

test('RC1241: breitere Storage-Aliase fuer den State-Zugriff bleiben unveraendert',()=>{
  assert.match(stateSource,/function connectionString\(\)\{ return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.EXPORTHUB_STORAGE_CONNECTION \|\| process\.env\.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING \|\| '';/);
  assert.match(stateSource,/const \{ isAdmin, isPrivilegedUser \} = require\('\.\.\/shared\/user-policy'\)/);
});

test('RC1241: Runtime und bestehender State-Handler bleiben syntaktisch gueltig',()=>{
  execFileSync(process.execPath,['--check','api/exporthub-state/runtime.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/exporthub-state/index.js'],{stdio:'pipe'});
});
