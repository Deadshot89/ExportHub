import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const exportUi=fs.readFileSync('assets/rc1499-abd-export.js','utf8');
const handoff=fs.readFileSync('assets/rc1499-exportexperte-handoff.js','utf8');

for(const [name,source] of [['Export',exportUi],['Handoff',handoff]]){
  test(`RC1499 performance: ${name} beobachtet niemals den gesamten Dokumentbaum`,()=>{
    assert.doesNotMatch(source,/\.observe\(\s*d\.documentElement\s*,\s*\{\s*childList\s*:\s*true\s*,\s*subtree\s*:\s*true\s*\}\s*\)/,
      `${name} darf keinen documentElement-subtree-Observer installieren`);
  });

  test(`RC1499 performance: ${name} bindet dynamische Analyseaktionen nur lokal`,()=>{
    assert.match(source,/rc1294AbdAnalysis|rc626Abd|data-rc1294-results/,
      `${name} braucht einen lokalen ABD-/Analyse-Host als Observer-Grenze`);
    assert.match(source,/disconnect\(\)/,
      `${name} muss einen veralteten lokalen Observer beim Hostwechsel trennen`);
  });
}
