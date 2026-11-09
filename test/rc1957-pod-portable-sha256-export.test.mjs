import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { patchRc1716PodBatchHtml } from '../scripts/rc1716-pod-batch-completeness.mjs';

const html = fs.readFileSync('index.html', 'utf8');
const patched = patchRc1716PodBatchHtml(html, 'production');
const marker = '<script id="rc455-pod-backup-controller">';
const first = patched.indexOf(marker);
const last = patched.indexOf('</script>', first);
assert.ok(first >= 0 && last > first, 'single existing POD export controller');
const controller = patched.slice(first + marker.length, last);
const from = controller.indexOf('/* RC1957_SHA256_START */');
const to = controller.indexOf('/* RC1957_SHA256_END */');
assert.ok(from > 0 && to > from, 'portable hash stage installed inside canonical controller');
const stage = controller.slice(from, to);
const funStart = controller.indexOf('function uniqueArchiveEntries(entries){');
const funEnd = controller.indexOf('\nfunction zip(entries){', funStart);
assert.ok(funStart > 0 && funEnd > funStart, 'zip naming used for both hashing and packaging');
const uniqueArchiveEntries = new Function(
  'q',
  controller.slice(funStart, funEnd) + '\nreturn uniqueArchiveEntries'
)(value => String(value ?? '').trim());
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const runHash = new AsyncFunction('entries', 'fail', 'globalThis', 'uniqueArchiveEntries', 'TextEncoder',
  stage + '\nreturn { entries, fail };'
);

async function run(entries, crypto = webcrypto, existingFailures = []) {
  const fail = existingFailures.slice();
  const input = entries.map(entry => ({ name: entry.name, data: entry.data.slice() }));
  const result = await runHash(input, fail, { crypto }, uniqueArchiveEntries, TextEncoder);
  return result;
}
const bytes = text => new Uint8Array(Buffer.from(text, 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');

test('RC1957: portable ZIP contains SHA256SUMS for the actual signed and manual PDF bytes', async () => {
  const digital = bytes('%PDF-1.7\nSAVED SIGNED ORIGINAL');
  const manual = bytes('%PDF-1.7\nMANUAL SUPPLEMENT');
  const { entries, fail } = await run([
    { name: 'POD_ABC123_Ladeliste.pdf', data: digital },
    { name: 'POD_ABC123_Manual.pdf', data: manual }
  ]);
  assert.deepEqual(fail, []);
  const checks = entries.find(entry => entry.name === 'SHA256SUMS.txt');
  assert.ok(checks, 'checksum manifest must be in the same portable ZIP');
  assert.deepEqual(new TextDecoder().decode(checks.data).trim().split('\n'), [
    digest(digital) + '  POD_ABC123_Ladeliste.pdf',
    digest(manual) + '  POD_ABC123_Manual.pdf'
  ]);
  assert.deepEqual(entries[0].data, digital, 'signed original must not be rewritten');
  assert.deepEqual(entries[1].data, manual, 'manual PDF must not be rewritten');
});

test('RC1957: filename collisions are normalized before checksums are assigned', async () => {
  const first = bytes('%PDF-1.7\nONE');
  const second = bytes('%PDF-1.7\nTWO');
  const { entries, fail } = await run([
    { name: 'POD_ABC123.pdf', data: first },
    { name: 'pod_abc123.PDF', data: second }
  ]);
  assert.deepEqual(fail, []);
  const fileNames = entries.filter(entry => /\.pdf$/i.test(entry.name)).map(entry => entry.name);
  assert.equal(new Set(fileNames.map(n => n.toLowerCase())).size, 2);
  const sums = new TextDecoder().decode(entries.find(e => e.name === 'SHA256SUMS.txt').data);
  assert.ok(sums.includes(digest(first) + '  ' + fileNames[0]));
  assert.ok(sums.includes(digest(second) + '  ' + fileNames[1]));
  const afterZipNaming = uniqueArchiveEntries(entries);
  assert.deepEqual(afterZipNaming.filter(e => /\.pdf$/i.test(e.name)).map(e => e.name), fileNames);
});

test('RC1957: any already failed PDF download suppresses a misleading complete checksum manifest', async () => {
  const good = bytes('%PDF-1.7\\nSIGNED ORIGINAL');
  const { entries, fail } = await run(
    [{ name: 'POD_ABC123_Ladeliste.pdf', data: good }],
    webcrypto,
    ['POD_DOWNLOAD_FAILED']
  );
  assert.deepEqual(fail, ['POD_DOWNLOAD_FAILED']);
  assert.equal(entries.some(e => e.name === 'SHA256SUMS.txt'), false);
  assert.deepEqual(entries[0].data, good, 'the successful original stays byte-exact');
});

test('RC1957: unavailable WebCrypto and empty exports fail closed without inventing proof', async () => {
  const noCrypto = await run([{ name: 'POD_ABC123.pdf', data: bytes('%PDF-1.7\nONE') }], null);
  assert.ok(noCrypto.fail.includes('RC1957_SHA256_UNAVAILABLE'));
  assert.equal(noCrypto.entries.some(e => e.name === 'SHA256SUMS.txt'), false);
  const empty = await run([{ name: 'README.txt', data: bytes('some text') }]);
  assert.ok(empty.fail.includes('RC1957_NO_PDF'));
  assert.equal(empty.entries.some(e => e.name === 'SHA256SUMS.txt'), false);
});

test('RC1957: one corrupt empty PDF among valid originals cannot be reported complete', async () => {
  const valid = bytes('%PDF-1.7\nVALID ORIGINAL');
  const { entries, fail } = await run([
    { name: 'POD_ABC123_Ladeliste.pdf', data: valid },
    { name: 'POD_ABC123_Manual.pdf', data: new Uint8Array(0) }
  ]);
  assert.ok(fail.includes('RC1957_EMPTY_PDF'));
  assert.equal(entries.some(e => e.name === 'SHA256SUMS.txt'), false,
    'must not emit a misleading complete checksum manifest');
  assert.deepEqual(entries[0].data, valid, 'the valid signed original is untouched');
});

test('RC1957: no Graph access, upload or original POD mutation added to the export stage', () => {
  assert.doesNotMatch(stage, /fetch\(|XMLHttpRequest|upload|saveAzurePod|copyToDrive|sharePoint|graphDrive/i);
  assert.match(controller, /btn\.disabled=false;return fail\.length===0/);
  assert.match(controller, /function zip\(entries\)\{uniqueArchiveEntries\(entries\);/);
  assert.doesNotThrow(() => new Function(controller));
});
