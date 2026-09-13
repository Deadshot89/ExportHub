import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostics=fs.readFileSync('assets/rc1013-diagnostics.js','utf8');
const api=fs.readFileSync('api/diagnostic-autofix/index.js','utf8');
const workflow=fs.readFileSync('.github/workflows/diagnostic-autofix.yml','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const policy=fs.readFileSync('api/shared/user-policy.js','utf8');

test('RC1082: History ist ein eigenes Rechte- und Navigationsmodul',()=>{
  assert.match(policy,/'archive','history','settings'/);
  assert.match(build,/function patchHistoryNavigation\(html,file\)/);
  assert.match(build,/view:'history',label:'History',right:'history'/);
  assert.match(build,/history:'History'/);
});

test('RC1083: Fehlerdiagnose bietet Filter und direkten ChatGPT-Autofix',()=>{
  assert.match(diagnostics,/Fehlerdiagnose & automatische Behebung/);
  assert.match(diagnostics,/Mit ChatGPT beheben/);
  assert.match(diagnostics,/data-rc1083-level/);
  assert.match(diagnostics,/data-rc1083-status/);
  assert.match(diagnostics,/data-rc1083-area/);
  assert.match(diagnostics,/\/api\/diagnostic-autofix/);
  assert.match(diagnostics,/setInterval\(function\(\)\{if\(diagnosticsVisible\(win\)/);
  assert.match(diagnostics,/resolvedAt/);
  assert.match(diagnostics,/ChatGPT arbeitet/);
});

test('RC1083: Browser erhält niemals OpenAI- oder GitHub-Secrets',()=>{
  assert.doesNotMatch(diagnostics,/OPENAI_API_KEY|EXPORTHUB_GITHUB_AUTOFIX_TOKEN|EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
  assert.match(api,/EXPORTHUB_GITHUB_AUTOFIX_TOKEN/);
  assert.match(api,/EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
});

test('RC1083: Autofix-Anforderung ist Global-Admin-geschützt und Diagnoseanhang wird bereinigt',()=>{
  assert.match(api,/async function validateGlobalAdmin/);
  assert.match(api,/GLOBAL_ADMIN_REQUIRED/);
  assert.match(api,/callbackAuthorized/);
  assert.match(api,/secretKey\(k\)/);
  assert.match(api,/\[geschützt\]/);
  assert.match(api,/action==='request'/);
  assert.match(api,/action==='claim'/);
  assert.match(api,/action==='workflow-status'/);
});

test('RC1083: erfolgreicher Workflow markiert Fehler erst nach Test und Live-Deploy als behoben',()=>{
  assert.match(workflow,/ChatGPT Codex analysiert und behebt den Fehler/);
  assert.match(workflow,/codex --ask-for-approval never exec/);
  assert.match(workflow,/diagnostic-attachment\.json/);
  assert.match(workflow,/npm test/);
  assert.match(workflow,/Autofix committen und nach main übernehmen/);
  assert.match(workflow,/Produktions-\/TESTSERVICE-Deploy abwarten/);
  assert.match(workflow,/status:"fixed"/);
  assert.match(api,/resolvedBy:'ChatGPT \/ Codex Autofix'/);
  assert.match(api,/resolvedAt:now\(\)/);
});

test('RC1083: Autofix schützt Workflow Secrets und große unkontrollierte Änderungen',()=>{
  assert.match(workflow,/Autofix darf seinen eigenen Workflow nicht verändern/);
  assert.match(workflow,/Secret-\/Credential-Dateien/);
  assert.match(workflow,/changed > 50/);
  assert.match(workflow,/deleted > 10/);
  assert.match(workflow,/--sandbox workspace-write/);
});

test('RC1083: finaler Build überschreibt die historische Diagnose-Runtime mit aktuellem RC1083-Stand',()=>{
  assert.match(build,/assets\\\/rc1013-diagnostics\\\.js\\\?v=1013/);
  assert.match(build,/assets\/rc1013-diagnostics\.js\?v=1083/);
  assert.match(build,/'assets\/rc1013-diagnostics\.js','assets\/rc1061-document-migration-admin\.js'/);
  assert.match(build,/diagnosticsAutofix:\{version:'RC1083'/);
});


test('RC1083: erneut auftretende Fehler werden nach früherer Behebung wieder geöffnet',()=>{
  const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
  assert.match(stateApi,/status:'reopened'/);
  assert.match(stateApi,/Fehler ist nach der letzten Behebung erneut aufgetreten/);
  assert.match(stateApi,/merged\.resolvedAt=null/);
});
