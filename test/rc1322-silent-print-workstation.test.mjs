import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const setup=fs.readFileSync('assets/tools/ExportHUB-DirectPrint-Setup.ps1','utf8');
const quick=fs.readFileSync('assets/rc1315-loading-list-quick-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1322: Direktdruck nutzt ausschließlich offizielle Edge-Policies für Silent Printing und Windows-Standarddrucker',()=>{
  assert.match(setup,/HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge/);
  assert.match(setup,/SilentPrintingEnabled/);
  assert.match(setup,/PrintPreviewUseSystemDefaultPrinter/);
  assert.match(setup,/PropertyType DWord -Value 1/);
  assert.match(setup,/edgeVersion\.Major -lt 144/);
  assert.match(setup,/Get-CimInstance Win32_Printer/);
  assert.match(setup,/\.Default -eq \$true/);
  assert.doesNotMatch(setup,/HttpListener|TcpListener|WebSocket|netsh\s+http/i);
});

test('RC1322: Setup ist reversibel und verweigert unsichere/unklare Arbeitsplatzkonfiguration',()=>{
  assert.match(setup,/Assert-Administrator/);
  assert.match(setup,/Microsoft Edge wurde nicht gefunden/);
  assert.match(setup,/Windows hat keinen Standarddrucker/);
  assert.match(setup,/\[switch\]\$Disable/);
  assert.match(setup,/Remove-ItemProperty[^\n]+SilentPrintingEnabled/);
  assert.match(setup,/Remove-ItemProperty[^\n]+PrintPreviewUseSystemDefaultPrinter/);
});

test('RC1322: Ladelisten-Schnelldruck bietet die geprüfte Arbeitsplatz-Einrichtung direkt an',()=>{
  assert.match(quick,/ExportHUB-DirectPrint-Setup\.ps1/);
  assert.match(quick,/data-rc1322-direct-print-setup/);
  assert.match(quick,/\.download='ExportHUB-DirectPrint-Setup\.ps1'/);
  assert.match(quick,/version:'RC1322'/);
  assert.match(build,/rc1315-loading-list-quick-print\.js\?v=1322/);
});

test('RC1322: Direktdruck-Setup wird mit den statischen Assets in Produktion und TESTSERVICE ausgeliefert',()=>{
  assert.match(workflow,/cp -R assets "\$dir\/assets"/);
  assert.match(build,/loadingListQuickPrint:'RC1322[^']*Edge silent-print workstation setup/);
});
