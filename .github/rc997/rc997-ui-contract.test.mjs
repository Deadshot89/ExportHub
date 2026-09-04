import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const count=(rx)=>(html.match(rx)||[]).length;

function sourceBuild(){
  const m=html.match(/var\s+BUILD\s*=\s*Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m?{version:Number(m[1]),cache:Number(m[2])}:{version:0,cache:0};
}

test('RC997 UI: RC995 bleibt die unveränderte Quellbasis',()=>{
  const build=sourceBuild();
  assert.equal(build.version,995,'TESTVERSION-Quelle muss RC995 bleiben; RC997 wird reproduzierbar gebaut');
  assert.equal(build.cache,995,'Quellcache muss zur RC995-Basis passen');
});

test('RC997 UI: kanonische RC990 Render- und Navigationsinfrastruktur bleibt eindeutig',()=>{
  assert.equal(count(/function\s+rc990ScheduleRender\s*\(/g),1,'rc990ScheduleRender ist nicht eindeutig');
  assert.equal(count(/function\s+rc990RememberView\s*\(/g),1,'rc990RememberView ist nicht eindeutig');
  assert.equal(count(/function\s+rc990BackView\s*\(/g),1,'rc990BackView ist nicht eindeutig');
  assert.equal(count(/function\s+rc990FailOperation\s*\(/g),1,'rc990FailOperation ist nicht eindeutig');
});

test('RC997 UI: Hauptnavigation besitzt mehrere echte Zielansichten',()=>{
  const views=[...html.matchAll(/data-index321-view=["']([^"']+)["']/g)].map(m=>m[1]);
  assert.ok(views.length>=6,`zu wenige Hauptnavigationseinträge: ${views.length}`);
  assert.ok(new Set(views).size>=6,`zu wenige unterschiedliche Zielansichten: ${new Set(views).size}`);
});

test('RC997 UI: Warncenter und Benachrichtigungscenter bleiben getrennt',()=>{
  assert.match(html,/Warncenter/i);
  assert.match(html,/Benachrichtigungscenter/i);
  assert.match(html,/rc885WarningDrawer/);
  assert.match(html,/index236NotificationCenter/);
});

test('RC997 UI: Smartphone-Menü und RC990 Back-Pfad bleiben vorhanden',()=>{
  assert.match(html,/ehMenuBtn/);
  assert.match(html,/function\s+rc990BackView\s*\(/);
  assert.match(html,/function\s+rc990ScheduleRender\s*\(/);
});
