import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../api/shared/pod-archive.js', import.meta.url), 'utf8');
const pickupPod = fs.readFileSync(new URL('../api/pickup-pod/index.js', import.meta.url), 'utf8');
const start = source.indexOf('async function createPodPdf(');
const end = source.indexOf('async function readAutomaticPodBuffer(', start);
const block = source.slice(start, end);

test('RC1553 P0: downloaded POD is the signed loading-list layout, not an independent Abliefernachweis template', () => {
  assert.ok(start >= 0 && end > start, 'POD PDF renderer missing');
  assert.match(source, /const POD_PDF_LAYOUT_VERSION\s*=\s*['"]RC1594-SIGNED-LOADING-LIST-V3['"]/);
  assert.match(block, /draw\('LADELISTE'/, 'official POD must keep the loading-list title');
  assert.doesNotMatch(block, /LADELISTE\s*\/\s*ABLIEFERNACHWEIS/, 'POD must not present a separate document type');
});

test('RC1553 P0: pickup fields remain separate and the driver signature is compact', () => {
  for (const label of ['Fahrer','Kennzeichen','Verlader','Spedition','Fahrerunterschrift']) {
    assert.ok(block.includes("card('" + label), 'missing separate POD field: ' + label);
  }
  assert.match(block, /SIGNATURE_CARD_HEIGHT\s*=\s*58/);
  assert.match(block, /SIGNATURE_MAX_HEIGHT\s*=\s*34/);
  assert.match(block, /Math\.min\(maxW\/dims\.width,SIGNATURE_MAX_HEIGHT\/dims\.height\)/);
});

test('RC1553 P0: POD contains a clean delivery-note area and does not silently drop delivery notes', () => {
  assert.match(source, /function deliveryNoteNames\(record\)/, 'delivery-note normalization helper missing');
  assert.match(block, /const deliveryNotes\s*=\s*deliveryNoteNames\(record\)/);
  assert.match(block, /deliveryNotes\.forEach\(/, 'all normalized delivery notes must be rendered');
  assert.doesNotMatch(block, /deliveryNotes\.slice\(/, 'delivery-note list must not be silently truncated');
});

test('RC1553 P0: pallet area has exactly one pallet-account value, not outgoing/incoming duplicates', () => {
  assert.match(source, /function palletBalanceText\(record\)/, 'POD pallet-balance helper missing');
  assert.match(block, /PALETTENKONTO \/ EUR PALLETS/);
  assert.match(block, /Aktueller Stand \/ Balance/);
  assert.match(block, /Eingang \/ Return/);
  assert.match(block, /palletReturnText\(record\)/);
  assert.doesNotMatch(block, /card\('Europaletten-Kontostand'/);
  assert.doesNotMatch(block, /Ausgang:\s*'\+palletOut\+'\s*\/\s*Eingang:/);
});

test('RC1553 P0: public automatic-POD download must pass through the version-aware archive downloader', () => {
  assert.match(pickupPod, /podArchive\s*=\s*require\(['"]\.\.\/shared\/pod-archive['"]\)/);
  assert.match(pickupPod, /podArchive\.getPodDownload\(accessKey,resolved\.environment,fileId\)/);
});

test('RC1553 P0: backup retry must not re-archive an outdated automatic POD layout', () => {
  const retryStart = source.indexOf('async function retryArchiveBackup(');
  const retryEnd = source.indexOf('async function retryDriveBackup(', retryStart);
  const retryBlock = source.slice(retryStart, retryEnd);
  assert.match(retryBlock, /!isCurrentAutomaticPod\(currentFile\)/);
  assert.match(retryBlock, /ensureAutomaticPod\(accessKey, environment, \{ force: true, copyToDrive: true \}\)/);
});
