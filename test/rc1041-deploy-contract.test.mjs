import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1041 Deployvertrag prüft Gate41 v1041 in allen drei Umgebungen',()=>{
  assert.match(workflow,/for file in index\.html TESTVERSION\.html demo\.html; do[\s\S]*rc1013-gate41-ui\.js\?v=1041/);
  assert.doesNotMatch(workflow,/rc1013-gate41-ui\.js\?v=1013/);
});

test('RC1041 Liveprüfung erwartet die nationale Gate41-Erfolgsmeldung',()=>{
  const hits=workflow.match(/Gate41-Preis Deutschland berechnet/g)||[];
  assert.equal(hits.length,2);
});
