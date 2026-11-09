import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {classifyPodArchiveStorage}=require('../api/shared/pod-archive-storage-mode.js');
const source=readFileSync('api/shared/pickup-store.js','utf8');
const endpoint=readFileSync('api/pod-backup/index.js','utf8');
const reconcile=readFileSync('api/pod-backup-reconcile/index.js','utf8');

const primary='DefaultEndpointsProtocol=https;AccountName=mainstore;AccountKey=originalSecret;EndpointSuffix=core.windows.net';
const alternate='DefaultEndpointsProtocol=https;AccountName=backupstore;AccountKey=secondSecret;EndpointSuffix=core.windows.net';

test('RC1950: default second container must not claim separate-account independence',()=>{
  assert.equal(classifyPodArchiveStorage(primary,''),'same-account');
  assert.equal(classifyPodArchiveStorage(primary,primary),'same-account');
  assert.equal(classifyPodArchiveStorage('',alternate),'unconfigured');
});

test('RC1950: different secret and container do not prove a different Azure account',()=>{
  const rotated=primary.replace('originalSecret','rotatedSecret');
  assert.equal(classifyPodArchiveStorage(primary,rotated),'same-account');
  const endpointBased='BlobEndpoint=https://mainstore.blob.core.windows.net/;SharedAccessSignature=secret';
  assert.equal(classifyPodArchiveStorage(primary,endpointBased),'same-account');
});

test('RC1950: only distinct identifiable Azure accounts prove separate-account mode',()=>{
  assert.equal(classifyPodArchiveStorage(primary,alternate),'separate-account');
  assert.equal(classifyPodArchiveStorage(
    'BlobEndpoint=https://mainstore.blob.core.windows.net/;SharedAccessSignature=a',
    'BlobEndpoint=https://backupstore.blob.core.windows.net/;SharedAccessSignature=b'
  ),'separate-account');
});

test('RC1950: opaque or inconsistent connection strings remain unverified',()=>{
  assert.equal(classifyPodArchiveStorage(primary,'UseDevelopmentStorage=true'),'unverified');
  assert.equal(classifyPodArchiveStorage(primary,'BlobEndpoint=https://storage.example.com;SharedAccessSignature=abc'),'unverified');
  assert.equal(classifyPodArchiveStorage(primary,'AccountName=backupstore;BlobEndpoint=https://proxy.example.com/;AccountKey=secret'),'unverified');
  assert.equal(classifyPodArchiveStorage(primary,'AccountName=backupstore;BlobEndpoint=https://mainstore.blob.core.windows.net/;AccountKey=secret'),'unverified');
});

test('RC1950: endpoint responses report redacted storage mode, not credentials',()=>{
  assert.match(source,/function podArchiveStorageMode\(\)\{return classifyPodArchiveStorage\(connectionString\(\),process\.env\.EXPORTHUB_POD_BACKUP_CONNECTION_STRING\)\}/);
  assert.match(endpoint,/archiveStorageMode:\s*store\.podArchiveStorageMode\(\)/);
  assert.equal((reconcile.match(/archiveStorageMode:\s*store\.podArchiveStorageMode\(\)/g)||[]).length,2);
  assert.doesNotMatch(endpoint,/archiveConnectionString:/);
  assert.doesNotMatch(reconcile,/archiveConnectionString:/);
});
