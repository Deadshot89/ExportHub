import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const authSource=fs.readFileSync('api/shared/auth-store.js','utf8');
const stateEntrySource=fs.readFileSync('api/exporthub-state/index.js','utf8');
const stateLegacySource=fs.readFileSync('api/exporthub-state/index-legacy.js','utf8');

test('RC1241: zentrale Auth-Signatur nutzt AzureWebJobsStorage als Storage-Fallback',()=>{
  assert.match(authSource,/function connectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
});

test('RC1241: exporthub-state leitet das Signatur-Secret aus derselben Fallback-Kette ab',()=>{
  assert.match(stateEntrySource,/function sessionSigningConnectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
  assert.match(stateEntrySource,/const source=configured\|\|sessionSigningConnectionString\(\);/);
  assert.match(stateEntrySource,/if\(!configured&&source\)process\.env\.EXPORTHUB_AUTH_SIGNING_SECRET=source;/);
});

test('RC1241: breitere Storage-Aliase fuer den State-Zugriff bleiben erhalten',()=>{
  assert.match(stateLegacySource,/function connectionString\(\)\{ return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.EXPORTHUB_STORAGE_CONNECTION \|\| process\.env\.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING \|\| '';/);
});

test('RC1241: exporthub-state Einstieg und bestehender Handler bleiben syntaktisch gueltig',()=>{
  execFileSync(process.execPath,['--check','api/exporthub-state/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/exporthub-state/index-legacy.js'],{stdio:'pipe'});
});
