import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

test('RC1561: Modus und gewählte Dateien liegen außerhalb des Panels und überleben ein Neuzeichnen',()=>{
  assert.match(src,/var currentMode='manual',pendingFiles=\[\];/);
  assert.match(src,/currentMode=mode==='invoice'\?'invoice':'manual';/);
  assert.match(src,/if\(currentMode==='invoice'\)\{\s*setMode\('invoice'\);/);
});

test('RC1561: Ereignisse der Dateiauswahl laufen nicht in die ABD-Ansicht weiter',()=>{
  assert.match(src,/function keepFileEventLocal\(e\)\{[^}]*closest\('\[data-rc1294-files\]'\)[^}]*e\.stopPropagation\(\)/);
  assert.match(src,/p\.addEventListener\('input',keepFileEventLocal\)/);
  assert.match(src,/p\.addEventListener\('change',function\(e\)\{if\(keepFileEventLocal\(e\)\)return;/);
});

test('RC1561: Analyse nutzt die gemerkten Dateien, wenn das neu gezeichnete Feld leer ist',()=>{
  assert.match(src,/if\(!files\.length&&pendingFiles\.length\)files=pendingFiles\.slice\(\);/);
  const start=src.indexOf('async function start(){'),check=src.indexOf("tr('abd.analysis.fileRequired')",start),fallback=src.indexOf('pendingFiles.slice()',start);
  assert.ok(fallback>start&&fallback<check,'Fallback muss vor der Pflichtprüfung stehen');
});

test('RC1561: Browser-Regression läuft in einem eigenen Workflow',()=>{
  const wf=fs.readFileSync('.github/workflows/rc1561-abd-invoice-verify.yml','utf8');
  assert.match(wf,/assets\/rc1294-abd-self-service\.js/);
  assert.match(wf,/e2e\/specs\/rc1561-abd-invoice-mode\.spec\.mjs --project=laptop/);
});
