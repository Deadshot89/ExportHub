import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const flow=fs.readFileSync('.github/workflows/rc1083-live-probe.yml','utf8');
const diagnostics=fs.readFileSync('assets/rc1013-diagnostics.js','utf8');

test('RC1364: Standalone-Diagnose-Liveprobe läuft erst nach erfolgreichem Drei-Umgebungen-Deploy',()=>{
  assert.match(flow,/workflow_run:/);
  assert.match(flow,/ExportHUB RC1112 Drei-Umgebungen Deploy/);
  assert.match(flow,/types:\s*\[completed\]/);
  assert.match(flow,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(flow,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(flow,/^\s{2}push:/m,'Liveprobe darf nicht vor dem Deployment direkt auf Push starten');
  assert.match(flow,/github\.event\.workflow_run\.head_sha \|\| github\.sha/);
});

test('RC1364: Diagnose-Liveprobe prüft aktuelle Runtime-Schlüssel statt veralteter deutscher UI-Texte',()=>{
  assert.match(flow,/assets\/rc1013-diagnostics\.js\?v=1364/);
  assert.match(flow,/diagnostics\.fixWithChatgpt/);
  assert.match(flow,/diagnostics\.title/);
  assert.match(flow,/__EXPORTHUB_RC1125_DIAGNOSTICS_VIEW_ISOLATION__/);
  assert.match(flow,/\/api\/diagnostic-autofix/);
  assert.match(flow,/AUTH_REQUIRED\|SESSION_INVALID/);
  assert.doesNotMatch(flow,/Mit ChatGPT beheben/);
  assert.doesNotMatch(flow,/Fehlerdiagnose & automatische Behebung/);
});

test('RC1364: geprüfte Diagnose-Runtime enthält die verlangten Live-Marker',()=>{
  assert.match(diagnostics,/diagnostics\.fixWithChatgpt/);
  assert.match(diagnostics,/diagnostics\.title/);
  assert.match(diagnostics,/__EXPORTHUB_RC1125_DIAGNOSTICS_VIEW_ISOLATION__/);
  assert.match(diagnostics,/\/api\/diagnostic-autofix/);
});
