import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1018-sop-system-images.js');
await import('../assets/sop/rc1502-sop-screenshot-manifest.js').catch(()=>{});

const catalog=globalThis.ExportHubIsoSopCatalog;
const manifest=globalThis.ExportHubSopScreenshotManifest;

function text(value){return String(value==null?'':value).trim();}
function stepsOf(doc){
  const current=text(doc?.currentVersion||doc?.version);
  const version=Array.isArray(doc?.versions)?doc.versions.find(v=>text(v?.version)===current):null;
  if(version?.content&&Array.isArray(version.content.steps))return version.content.steps;
  return Array.isArray(doc?.sections?.steps)?doc.sections.steps:[];
}
function repoPath(src){return path.join(process.cwd(),String(src||'').replace(/^\//,''));}

test('RC1502 Screenshot-Manifest besitzt ABD- und SOP-Editor-Pilot mit realen PNG-Dateien',()=>{
  assert.ok(manifest,'ExportHubSopScreenshotManifest fehlt');
  assert.ok(Array.isArray(manifest.entries),'Manifest entries fehlt');
  assert.ok(manifest.entries.length>=2,'Mindestens zwei Pilot-Screenshots erforderlich');
  const numbers=new Set(manifest.entries.map(entry=>text(entry?.sopNumber)));
  assert.ok(numbers.has('SOP-EH-060'),'ABD-Pilot fehlt');
  assert.ok(numbers.has('SOP-EH-100'),'SOP-Editor-Pilot fehlt');

  for(const entry of manifest.entries){
    assert.match(text(entry.file),/^\/assets\/sop\/screenshots\/[a-z0-9-]+\.png$/i,`${entry.sopNumber}: ungültiger Screenshotpfad`);
    assert.doesNotMatch(text(entry.file),/^data:/i,`${entry.sopNumber}: Data-URI ist nicht erlaubt`);
    assert.ok(fs.existsSync(repoPath(entry.file)),`${entry.sopNumber}: PNG fehlt: ${entry.file}`);
    assert.ok(text(entry.caption),`${entry.sopNumber}: Caption fehlt`);
    assert.ok(text(entry.view),`${entry.sopNumber}: View fehlt`);
    assert.equal(typeof entry.targetKey,'string',`${entry.sopNumber}: targetKey muss explizit angegeben werden`);
  }
});

test('jede Manifest-Zuordnung verweist auf eine vorhandene SOP und reale stepId',()=>{
  assert.ok(manifest,'ExportHubSopScreenshotManifest fehlt');
  for(const entry of manifest.entries){
    const doc=catalog.get(entry.sopNumber);
    assert.ok(doc,`${entry.sopNumber}: SOP existiert nicht`);
    const ids=new Set(stepsOf(doc).map(step=>text(step?.id)).filter(Boolean));
    assert.ok(ids.has(text(entry.stepId)),`${entry.sopNumber}: Step ${entry.stepId} existiert nicht`);
  }
});

test('Pilotbilder sind echte unterschiedliche Binärbilder und keine wiederverwendete Attrappe',()=>{
  assert.ok(manifest,'ExportHubSopScreenshotManifest fehlt');
  const required=manifest.entries.filter(entry=>entry.required!==false);
  const hashes=required.map(entry=>crypto.createHash('sha256').update(fs.readFileSync(repoPath(entry.file))).digest('hex'));
  assert.equal(new Set(hashes).size,hashes.length,'Mindestens zwei erforderliche Pilotbilder sind binär identisch');
});

test('RC1502 Capture-Pipeline ist Playwright-basiert und verweigert Nicht-Demo-Quellen',()=>{
  assert.ok(fs.existsSync('browser/rc1502-sop-screenshots.mjs'),'RC1502 Browser-Capture fehlt');
  const source=fs.readFileSync('browser/rc1502-sop-screenshots.mjs','utf8');
  assert.match(source,/playwright|chromium/i);
  assert.match(source,/demo\.html/i);
  assert.match(source,/assertDemoEnvironment/,'explizite Demo-Umgebungsprüfung fehlt');
  assert.match(source,/data-exporthub-environment|demo/i,'Demo-Laufzeitmerkmal fehlt');
  assert.doesNotMatch(source,/data:image\/svg\+xml/i);
});

test('Manifest-API liefert Pilotbilder deterministisch nach SOP und Step',()=>{
  assert.ok(manifest,'ExportHubSopScreenshotManifest fehlt');
  assert.equal(typeof manifest.forStep,'function','forStep API fehlt');
  const abd=manifest.forStep('SOP-EH-060','step-1');
  assert.ok(Array.isArray(abd)&&abd.length>=1);
  assert.match(abd[0].file,/rc1018-abd\.png$/);
  assert.deepEqual(abd,manifest.forStep('SOP-EH-060','step-1'));
});
