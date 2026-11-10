import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const refs = fs.readFileSync('api/reference-files/index.js', 'utf8');
const avis = fs.readFileSync('api/customer-avis/index.js', 'utf8');
const store = fs.readFileSync('api/shared/ref-doc-blob-store.js', 'utf8');
const docsMod = require('../api/shared/customer-avis-reference-docs.js');
const i18n = fs.readFileSync('assets/i18n/shipment-document-upload.js', 'utf8');
const ui = fs.readFileSync('assets/shipment-document-upload.js', 'utf8');

// ---- Speichermodul ----------------------------------------------------------------
test('Dokument-Azure-Kopie: Speicher nutzt eigenen Pfad je Umgebung und prüft per Rücklesen', async () => {
  assert.match(store, /'refdoc-v1\/' \+ environment\(env\)/);
  assert.match(store, /downloadToBuffer/);
  assert.match(store, /sha256/);
  assert.match(store, /ifNoneMatch: '\*'/);
  assert.match(store, /\^refdoc:\[0-9a-f\]\{32\}\$/);
  assert.match(store, /MAX_BYTES = 15 \* 1024 \* 1024/);
  const s = require('../api/shared/ref-doc-blob-store.js');
  assert.equal(s.prefix('ab12cd', 'production'), 'refdoc-v1/production/AB12CD/');
  assert.equal(s.prefix('AB12CD', 'testservice'), 'refdoc-v1/testservice/AB12CD/');
  assert.notEqual(s.prefix('AB12CD', 'production'), s.prefix('AB12CD', 'testservice'));
  assert.throws(() => s.prefix('zu-lang-und-falsch', 'production'), /Ungültige Sendungsreferenz/);
  await assert.rejects(() => s.read('AB12CD', 'production', '../../etc/passwd'), /Ungültige Dateikennung/);
});

// ---- Upload-Reihenfolge ---------------------------------------------------------------
function block() {
  const at = refs.indexOf("if(action==='upload-document'){");
  assert.ok(at > 0);
  return refs.slice(at, refs.indexOf("throw error('ACTION_INVALID'", at));
}
test('Dokument-Azure-Kopie: Upload speichert zuerst in Azure, SharePoint nur zusätzlich, Fehler nur wenn beides ausfällt', () => {
  const b = block();
  assert.ok(b.indexOf('refDocBlob.save') > 0 && b.indexOf('referenceFolder.upload') > b.indexOf('refDocBlob.save'), 'Azure vor SharePoint');
  assert.match(b, /azureSaved/);
  assert.match(b, /sharepointSaved/);
  assert.match(b, /if\(!azureSaved&&!sharepointSaved\)throw/, 'beides ausgefallen = Fehler');
  assert.match(b, /'azure-refdoc'/);
});

test('Dokument-Azure-Kopie: Liste und Download führen Azure-Dokumente mit SharePoint zusammen', () => {
  assert.match(refs, /require\('\.\.\/shared\/ref-doc-blob-store'\)/);
  assert.match(refs, /\/\^refdoc:\/\.test\(itemId\)/);
  assert.match(refs, /refDocBlob\.read\(ref,env,itemId\)/);
  assert.match(refs, /refDocBlob\.list\(ref,env\)/);
  assert.match(refs, /storage:'azure-refdoc'/);
  // RC1962 starts independent sources concurrently. The graphError branch keeps
  // Azure originals visible while failing closed if all source inventories are empty.
  assert.match(refs, /Promise\.allSettled\(\[/, 'unabhängige REF-Quellen parallel lesen');
  assert.match(refs, /if\(graphError\)\{\s*if\(!azure\.length&&!docs\.length\)throw graphError;/,
    'Graph-Ausfall ist nur ohne Azure-Dokumente ein Fehler');
});

// ---- Avis -----------------------------------------------------------------------------
test('Avis: Azure-Dokumente erscheinen vor gleichnamigen SharePoint-Dateien, ohne Doppelte', async () => {
  const name = 'Rechnung_AB12CD_20261107-101500_RE.pdf';
  const azure = [{ id: 'refdoc:' + 'a'.repeat(32), name, size: 5 }];
  const graph = [{ id: 'G1', name, size: 5 }, { id: 'G2', name: 'Lieferschein_AB12CD_20261107-101501_LS.pdf', size: 6 }];
  const out = await docsMod.load({ listFiles: async () => graph }, 'AB12CD', 'production', null, { list: async () => azure });
  assert.deepEqual(out.map(d => [d.category, d.refSource]), [['Rechnung', 'azure'], ['Lieferschein', 'graph']]);
  assert.equal(out[0].refItemId, 'refdoc:' + 'a'.repeat(32));
});

test('Avis: ist SharePoint ausgefallen, bleiben die Azure-Dokumente sichtbar; umgekehrt ebenso', async () => {
  const name = 'Packliste_AB12CD_20261107-101500_PL.pdf';
  const down = async () => { throw new Error('graph down'); };
  const a = await docsMod.load({ listFiles: down }, 'AB12CD', 'production', null, { list: async () => [{ id: 'refdoc:' + 'b'.repeat(32), name }] });
  assert.equal(a.length, 1);
  const b = await docsMod.load({ listFiles: async () => [{ id: 'G', name }] }, 'AB12CD', 'production', null, { list: down });
  assert.equal(b.length, 1);
  const none = await docsMod.load({ listFiles: down }, 'AB12CD', 'production', null, { list: down });
  assert.deepEqual(none, []);
});

test('Avis: Download liest Azure-Dokumente über den Speicher und prüft nur Dokumente aus der Liste', () => {
  assert.match(avis, /require\('\.\.\/shared\/ref-doc-blob-store'\)/);
  assert.match(avis, /doc\.refSource==='azure'/);
  assert.match(avis, /refDocBlob\.read\(sref\(sh\),sessionInfo\.environment,doc\.refItemId\)/);
  assert.match(avis, /refDocs\.load\(referenceFolder,sref\(sh\),sessionInfo\.environment,[\s\S]*?,refDocBlob\)/);
});

// ---- Oberfläche -----------------------------------------------------------------------
test('Oberfläche: Hinweis „in Azure gesichert, SharePoint-Kopie fehlt“ in sechs Sprachen', () => {
  assert.match(ui, /sharepointSaved===false/);
  assert.match(ui, /t\(info\.sharepointSaved===false\?'savedAzureOnly':'saved'/);
  for (const l of ['de', 'en', 'pl', 'es', 'fr', 'it']) {
    const part = i18n.slice(i18n.indexOf('\n ' + l + ':{'));
    assert.match(part.slice(0, 4000), /savedAzureOnly:'/, l);
  }
});
