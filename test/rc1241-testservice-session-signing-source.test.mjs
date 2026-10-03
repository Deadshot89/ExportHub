import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const authSource=fs.readFileSync('api/shared/auth-store.js','utf8');
const stateSource=fs.readFileSync('api/exporthub-state/index.js','utf8');

test('RC1241: zentrale Auth-Signatur nutzt AzureWebJobsStorage als Storage-Fallback',()=>{
  assert.match(authSource,/function connectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
});

test('RC1241: exporthub-state leitet das Signatur-Secret aus derselben Fallback-Kette ab',()=>{
  assert.match(stateSource,/function sessionSigningConnectionString\(\)\s*\{\s*return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.AzureWebJobsStorage \|\| '';\s*\}/);
  assert.match(stateSource,/const source=configured\|\|sessionSigningConnectionString\(\);/);
});

test('RC1241: breitere Storage-Aliase fuer den State-Zugriff bleiben erhalten',()=>{
  assert.match(stateSource,/function connectionString\(\)\{ return process\.env\.EXPORTHUB_STORAGE_CONNECTION_STRING \|\| process\.env\.EXPORTHUB_STORAGE_CONNECTION \|\| process\.env\.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING \|\| '';/);
});

test('RC1241: exporthub-state bleibt syntaktisch gueltig',()=>{
  execFileSync(process.execPath,['--check','api/exporthub-state/index.js'],{stdio:'pipe'});
});
