import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const https = require('https');
const modulePath = require.resolve('../api/shared/graph-drive.js');
const pdf = Buffer.from('%PDF-test');
const expectedName = 'POD_TEST.pdf';

function graph() {
  process.env.EXPORTHUB_GRAPH_TENANT_ID = 'rc1683-test-tenant';
  process.env.EXPORTHUB_GRAPH_CLIENT_ID = 'rc1683-test-client';
  process.env.EXPORTHUB_GRAPH_CLIENT_SECRET = 'rc1683-test-secret';
  process.env.EXPORTHUB_POD_DRIVE_USER = 'test@example.invalid';
  process.env.EXPORTHUB_POD_FOLDER = '003 Export/ExportHub/Abliefernachweise';
  process.env.EXPORTHUB_POD_DRIVE_ID = 'rc1683-drive';
  process.env.EXPORTHUB_POD_FOLDER_ID = 'rc1683-folder';
  delete require.cache[modulePath];
  return require(modulePath);
}

async function fakeGraph(receipt, work) {
  const original = https.request;
  const calls = [];
  https.request = (options, callback) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = error => queueMicrotask(() => req.emit('error', error));
    req.end = () => {
      const call = { method: options.method, path: options.path, hostname: options.hostname };
      calls.push(call);
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = {};
        callback(response);
        const body = calls.length === 1 ? { access_token: 'rc1683-mock', expires_in: 3600 } : receipt;
        response.emit('data', Buffer.from(JSON.stringify(body)));
        response.emit('end');
      });
    };
    return req;
  };
  try { await work(calls); }
  finally { https.request = original; }
}

test('RC1683: exact Graph receipt with ID, name and byte size is accepted', async () => {
  const drive = graph();
  await fakeGraph({ id: 'item-123', name: expectedName, size: pdf.length }, async calls => {
    const result = await drive.uploadPdf(pdf, expectedName);
    assert.equal(result.id, 'item-123');
    assert.equal(result.name, expectedName);
    assert.equal(result.size, pdf.length);
    assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
  });
});

for (const scenario of [
  { label: 'missing file ID', receipt: { name: expectedName, size: pdf.length } },
  { label: 'missing stored file size', receipt: { id: 'item-123', name: expectedName } },
  { label: 'truncated stored PDF', receipt: { id: 'item-123', name: expectedName, size: pdf.length - 1 } },
  { label: 'wrong file name', receipt: { id: 'item-123', name: 'OTHER.pdf', size: pdf.length } }
]) {
  test('RC1683: ' + scenario.label + ' never marks a Graph upload successful or repeats PUT', async () => {
    const drive = graph();
    await fakeGraph(scenario.receipt, async calls => {
      await assert.rejects(
        drive.uploadPdf(pdf, expectedName),
        error => error && error.code === 'GRAPH_UPLOAD_RECEIPT_INVALID'
      );
      assert.equal(calls.filter(call => call.method === 'PUT').length, 1);
    });
  });
}
