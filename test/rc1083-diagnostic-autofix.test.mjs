import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const diagnostics=fs.readFileSync('assets/rc1013-diagnostics.js','utf8');
const api=fs.readFileSync('api/diagnostic-autofix/index.js','utf8');
const functionConfig=JSON.parse(fs.readFileSync('api/diagnostic-autofix/function.json','utf8'));
const workflow=fs.readFileSync('.github/workflows/diagnostic-autofix.yml','utf8');
const preflight=fs.readFileSync('.github/workflows/rc1083-autofix-preflight.yml','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const policy=fs.readFileSync('api/shared/user-policy.js','utf8');
const historyDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));

test('RC1082: History ist ein eigenes Rechte- und Navigationsmodul',()=>{
  assert.match(policy,/'archive','history','settings'/);
  assert.match(build,/function patchHistoryNavigation\(html,file\)/);
  assert.match(build,/view:'history',label:'Historie',right:'history'/);
  assert.match(build,/history:'Historie'/);
});

test('RC1085: Fehlerdiagnose bietet Filter und zeigt die bewusst deaktivierte automatische Behebung klar an',()=>{
  assert.match(diagnostics,/Fehlerdiagnose & automatische Behebung/);
  assert.match(diagnostics,/Mit ChatGPT beheben/);
  assert.match(diagnostics,/Automatische Fehlerbehebung deaktiviert/);
  assert.match(diagnostics,/Es werden keine externen KI-Aufträge gestartet/);
  assert.match(diagnostics,/data-rc1083-level/);
  assert.match(diagnostics,/data-rc1083-status/);
  assert.match(diagnostics,/data-rc1083-area/);
  assert.match(diagnostics,/\/api\/diagnostic-autofix/);
  assert.match(diagnostics,/setInterval\(function\(\)\{if\(!win\.document\.hidden&&\(diagnosticsVisible\(win\)\|\|win\.document\.getElementById\('rc1013-diagnostics-enhanced'\)\)\)refresh\(win\)/);
  assert.match(diagnostics,/resolvedAt/);
  assert.match(diagnostics,/ChatGPT arbeitet/);
});

test('RC1083: Diagnose-Autofix ist als Azure HTTP Function registriert',()=>{
  const trigger=functionConfig.bindings.find(binding=>binding&&binding.type==='httpTrigger');
  const output=functionConfig.bindings.find(binding=>binding&&binding.type==='http');
  assert.ok(trigger,'HTTP-Trigger fehlt');
  assert.equal(trigger.authLevel,'anonymous');
  assert.equal(trigger.route,'diagnostic-autofix');
  assert.deepEqual(trigger.methods,['post','options']);
  assert.ok(output,'HTTP-Output-Binding fehlt');
});

test('RC1083: Browser erhält niemals OpenAI- oder GitHub-Secrets',()=>{
  assert.doesNotMatch(diagnostics,/OPENAI_API_KEY|EXPORTHUB_GITHUB_AUTOFIX_TOKEN|EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
  assert.match(api,/EXPORTHUB_GITHUB_AUTOFIX_TOKEN/);
  assert.match(api,/EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
});

test('RC1083: Autofix-Anforderung ist Global-Admin-geschützt und Diagnoseanhang wird bereinigt',()=>{
  assert.match(api,/async function validateGlobalAdmin/);
  assert.match(api,/GLOBAL_ADMIN_REQUIRED/);
  assert.doesNotMatch(api,/user\.isAdmin===true/);
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

test('RC1085: finaler Build überschreibt die historische Diagnose-Runtime mit kostenneutralem RC1085-Stand',()=>{
  assert.match(build,/assets\\\/rc1013-diagnostics\\\.js\\\?v=1013/);
  assert.match(build,/assets\/rc1013-diagnostics\.js\?v=1085/);
  assert.match(build,/'assets\/rc1013-diagnostics\.js','assets\/rc1061-document-migration-admin\.js'/);
  assert.match(build,/diagnosticsAutofix:\{version:'RC1085'/);
  assert.match(build,/enabledByDefault:false/);
  assert.match(build,/noExternalAiRequestsWhenDisabled:true/);
});


test('RC1083: erneut auftretende Fehler werden nach früherer Behebung wieder geöffnet',()=>{
  const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
  assert.match(stateApi,/status:'reopened'/);
  assert.match(stateApi,/Fehler ist nach der letzten Behebung erneut aufgetreten/);
  assert.match(stateApi,/merged\.resolvedAt=null/);
});


test('RC1083: Autofix-Auftrag und Ergebnis erscheinen in der zentralen History',()=>{
  const history=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
  assert.match(api,/DIAGNOSTIC_AUTOFIX_REQUESTED/);
  assert.match(api,/DIAGNOSTIC_AUTOFIX_FIXED/);
  assert.match(api,/DIAGNOSTIC_AUTOFIX_FAILED/);
  assert.match(history,/DIAGNOSTIC_AUTOFIX_REQUESTED:'history\.audit\.DIAGNOSTIC_AUTOFIX_REQUESTED'/);
  assert.match(history,/DIAGNOSTIC_AUTOFIX_FIXED:'history\.audit\.DIAGNOSTIC_AUTOFIX_FIXED'/);
});

test('RC1083: GitHub OIDC statt dauerhaftem Callback-Secret schützt den Rückkanal',()=>{
  assert.match(api,/async function githubOidcAuthorized/);
  assert.match(api,/token\.actions\.githubusercontent\.com/);
  assert.match(api,/OIDC_AUDIENCE = 'exporthub-diagnostic-autofix'/);
  assert.match(api,/claims\.repository!==REPO/);
  assert.match(api,/claims\.workflow_ref!==expectedWorkflow/);
  assert.match(api,/action==='preflight'/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/X-ExportHUB-GitHub-OIDC/);
  assert.doesNotMatch(workflow,/secrets\.EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
  assert.match(preflight,/id-token: write/);
  assert.match(preflight,/X-ExportHUB-GitHub-OIDC/);
  assert.match(preflight,/githubDispatchConfigured/);
  assert.doesNotMatch(preflight,/EXPORTHUB_AUTOFIX_CALLBACK_SECRET/);
});

test('RC1083: Preflight darf zusätzlich Push-OIDC verwenden, echter Autofix bleibt workflow_dispatch',()=>{
  assert.match(api,/callbackAuthorized\(req,PREFLIGHT_WORKFLOW,\['push','workflow_dispatch'\]\)/);
  assert.match(api,/callbackAuthorized\(req,WORKFLOW\)/);
  assert.match(api,/events\.includes\(claims\.event_name\)/);
});


test('RC1085: Autofix benötigt eine ausdrückliche serverseitige Aktivierung und ist standardmäßig aus',()=>{
  assert.match(api,/function autofixEnabled\(\)/);
  assert.match(api,/EXPORTHUB_AUTOFIX_ENABLED/);
  assert.match(api,/AUTOFIX_DISABLED/);
  assert.match(api,/noExternalAiRequests:!enabled/);
  assert.match(api,/configured:Boolean\(enabled&&serverConfigured&&preflightOk\)/);
});

test('RC1085: GitHub-OIDC-Dispatch benötigt kein altes dauerhaftes Callback-Secret mehr',()=>{
  const start=api.indexOf('async function dispatch(');
  const end=api.indexOf('function promptFor(',start);
  const block=api.slice(start,end);
  assert.match(block,/EXPORTHUB_GITHUB_AUTOFIX_TOKEN/);
  assert.doesNotMatch(block,/EXPORTHUB_AUTOFIX_CALLBACK_SECRET|AUTOFIX_CALLBACK_NOT_CONFIGURED/);
});

test('RC1085: deaktivierter Autofix führt im Vorflug keinen OpenAI-Aufruf aus',()=>{
  assert.match(preflight,/AUTOFIX_DISABLED=1/);
  assert.match(preflight,/kein OpenAI-Aufruf ausgeführt/);
  assert.match(preflight,/autofixEnabled/);
  assert.match(preflight,/RC1085 sicher: Autofix ist bewusst deaktiviert/);
});
