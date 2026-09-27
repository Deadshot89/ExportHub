import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1298 P1: redundante Login-Informationen sind ausgeblendet',()=>{
  assert.match(runtime,/#login \.clean-version-badge,#login \.eh-login-mode-head,#login \.eh-login-environment-note\{display:none!important\}/);
  assert.match(runtime,/#login \.login-card\{width:min\(540px,100%\)!important/);
  assert.match(runtime,/function hideRedundantLoginInfo\(\)/);
  assert.match(runtime,/querySelectorAll\('\.clean-version-badge,\.eh-login-mode-head,\.eh-login-environment-note'\)/);
  assert.match(runtime,/setImportant\(node\.style,'display','none'\)/);
});

test('RC1298 P1: nur die aktive Umgebung erhält die Hintergrundbeleuchtung',()=>{
  assert.match(runtime,/#login \.eh-login-environment button\{[\s\S]*background:#f8fafc!important[\s\S]*box-shadow:none!important/);
  assert.match(runtime,/button\.is-active,#login \.eh-login-environment button\.active,#login \.eh-login-environment button\[aria-pressed="true"\][\s\S]*0 0 26px rgba\(14,165,233,.48\)/);
  assert.match(runtime,/function applyEnvironmentSelectionStyles\(\)/);
  assert.match(runtime,/setImportant\(style,'box-shadow','none'\)/);
  assert.match(runtime,/#login \.eh-login-environment button\{[\s\S]*transition:none!important/,'Inaktive Umgebung darf im Live-Smoke keinen animierten Restschatten behalten');
  assert.match(runtime,/0 0 26px rgba\(14,165,233/);
});

test('RC1298 P1: Browser-Passwortmanager bleibt aktiv ohne hardcodierte deutsche Login-Texte',()=>{
  assert.match(runtime,/setAttribute\('autocomplete','username'\)/);
  assert.match(runtime,/setAttribute\('autocomplete','current-password'\)/);
  assert.match(runtime,/setAttribute\('autocomplete','on'\)/);
  assert.doesNotMatch(runtime,/Benutzername & Passwort speichern/);
  assert.doesNotMatch(runtime,/Beim nächsten Besuch automatisch einsetzen/);
});

test('RC1298 P1: Produktion hält den Browser-Tab dauerhaft auf ExportHUB360',()=>{
  assert.match(runtime,/function ensureBrowserBranding\(\)/);
  assert.match(runtime,/d\.title!=='ExportHUB360'/);
  assert.match(runtime,/d\.title='ExportHUB360'/);
  assert.match(runtime,/-testservice\\\./);
  assert.match(runtime,/TESTVERSION\\\.html/);
});

test('RC1298 P1: Login-Runtime wird cache-frisch gebaut und live geprüft',()=>{
  assert.ok(build.includes("assets\\/rc1074-login-clean\\.js\\?v=(?:1074|1112|1298)"),'Builder muss alte Login-Cache-Keys auf RC1301 anheben');
  assert.match(build,/assets\/rc1074-login-clean\.js\?v=1301/);
  assert.match(workflow,/assets\/rc1074-login-clean\.js\?v=1301/);
});

test('RC1298 P1: Login-Runtime bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1074-login-clean.js'],{stdio:'pipe'});
});


test('RC1300 P1: Login rendert weder bei jedem View-Wechsel noch vor dem Umgebungswechsel neu',()=>{
  assert.match(runtime,/requestAnimationFrame/);
  assert.match(runtime,/target===login/);
  assert.match(runtime,/target\.matches&&target\.matches\('\.eh-login-environment button'\)/);
  assert.doesNotMatch(runtime,/\['exporthub:ready','exporthub:language-changed','exporthub:rendered','exporthub:viewchange'\]/);
  const clickStart=runtime.indexOf('function stableEnvironmentClick');
  const clickEnd=runtime.indexOf('\nfunction installStableEnvironmentSwitch',clickStart);
  assert.ok(clickStart>=0&&clickEnd>clickStart,'stableEnvironmentClick fehlt');
  const clickBlock=runtime.slice(clickStart,clickEnd);
  assert.doesNotMatch(clickBlock,/markEnvironmentTarget\(next\)/,'Vor Navigation darf kein Zwischen-Render der Kacheln erfolgen');
  assert.match(clickBlock,/location\.assign\(url\)/);
});


test('RC1300 P1: Login und Fremdansichten starten keine ABD-Dashboard-Nacharbeit',()=>{
  assert.match(runtime,/function rc1109RelevantView\(\)/);
  assert.match(runtime,/if\(loginVisible\(\)\)return false/);
  assert.match(runtime,/view==='dashboard'\|\|view==='tasks'/);
  const start=runtime.indexOf('function rc1109Schedule(){');
  const end=runtime.indexOf('\nvar loginRefreshTimer=0;',start);
  assert.ok(start>=0&&end>start,'rc1109Schedule-Block fehlt');
  const block=runtime.slice(start,end);
  assert.match(block,/if\(!rc1109RelevantView\(\)\)return false/);
});
