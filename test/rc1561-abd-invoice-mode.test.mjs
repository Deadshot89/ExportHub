import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

test('RC1561: Modus und gewählte Dateien liegen außerhalb des Panels und überleben ein Neuzeichnen',()=>{
  assert.match(src,/var currentMode='manual',pendingFiles=\[\],pendingUploads=new WeakMap\(\);/);
  assert.match(src,/currentMode=mode;/,'All four ABD modes must survive the view re-render');
  assert.match(src,/setMode\(currentMode,true\);/,'Re-render must restore the tab without repeating shipment prefill');
  assert.doesNotMatch(src,/if\(currentMode==='invoice'&&pendingFiles\.length\)/,'ABD no longer owns invoice uploads');
});

test('RC1942: invoice upload and analysis UI moved from ABD to Documents',()=>{
 const docs=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
 const mount=src.slice(src.indexOf('function mount(){'),src.indexOf('function disconnectHostObserver(){'));
 assert.doesNotMatch(mount,/data-rc1294-mode="invoice"/);
 assert.doesNotMatch(mount,/id="rc1294InvoicePanel"/);
 assert.match(mount,/data-rc1294-mode="manual"/);
 assert.match(mount,/data-rc1294-mode="shipment"/);
 assert.match(mount,/data-rc1294-mode="saved"/);
 assert.match(docs,/data-rc1940-files accept="[^"]*\.pdf[^"]*\.xlsx[^"]*\.csv/);
 assert.match(docs,/scanner\.analyzeFile\(file\)/);
 assert.match(src,/analyzeFile:analyzeFile/);
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


test('RC1786: invoice file chooser never waits for an optional language asset',()=>{
 assert.match(src,/function ensureFeatureI18n\(\)\{/);
 assert.match(src,/return pack\[key\]\|\|key/);
 assert.match(src,/chooseFiles:'Dateien auswählen'/);
 assert.match(src,/ensureFeatureI18n\(\);\s*ensureStyle\(\)/);
 assert.doesNotMatch(src,/if\(!ensureFeatureI18n\(\)\)return false/);
 assert.match(src,/s\.addEventListener\('error',function\(\)\{try\{s\.remove\(\)\}catch\(_\)\{\}\},\{once:true\}\)/);
});


test('RC1786: late i18n load preserves mounted Proforma editor and selected files',()=>{
 const start=src.indexOf('function refreshLabelsAfterI18n(){');
 const end=src.indexOf('function ensureFeatureI18n(){',start);
 assert.ok(start>=0&&end>start,'Refresh callback required');
 const callback=src.slice(start,end);
 assert.match(callback,/\.querySelector\('\[data-rc1294-invoice-panel\]'\)/);
 assert.match(callback,/\.textContent=xtr\('invoiceMode'\)/);
 assert.doesNotMatch(callback,/\.remove\(\)|\.innerHTML=/,'Refreshing translations must not destroy the editor or native file input');
});

test('RC1787: Rechnungsupload verwendet nur die aktive ExportHUB-Sitzung mit korrekter Umgebung',()=>{
 const begin=src.indexOf('function authToken(){'),end=src.indexOf('function headers(){',begin);
 assert.ok(begin>=0&&end>begin,'Auth-Token und Umgebungsprüfung fehlen');
 const run=(runtime,stored,hostname='www.exporthub360.de')=>{
  const w={
   ExportHUBClean:{runtime},
   location:{hostname},
   sessionStorage:{getItem(key){return stored[key]||null}}
  };
  const scope={w,q:value=>String(value==null?'':value).trim()};
  vm.runInNewContext(src.slice(begin,end)+'\nthis.pickToken=authToken;',scope);
  return scope.pickToken()
 };
 const normal={exporthub_rc301_tab_session:JSON.stringify({token:'CANONICAL-TOKEN',user:{id:'u1'},environment:'production'})};
 assert.equal(run({authToken:'RUNTIME-TOKEN'},normal),'RUNTIME-TOKEN');
 assert.equal(run({token:'SECONDARY-RUNTIME-TOKEN'},normal),'SECONDARY-RUNTIME-TOKEN');
 assert.equal(run({},normal),'CANONICAL-TOKEN');
 assert.equal(run({},normal,'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'),'');
 assert.equal(run({},{unrelated:JSON.stringify({token:'FOREIGN-TOKEN'})}),'');
 assert.equal(run({},{exporthub_rc301_tab_session:JSON.stringify({token:'TOKEN-WITHOUT-USER',environment:'production'})}),'');
 const testSession={exporthub_rc301_tab_session:JSON.stringify({token:'TEST-TOKEN',user:{id:'u2'},environment:'testservice'})};
 assert.equal(run({},testSession,'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'),'TEST-TOKEN');
});
