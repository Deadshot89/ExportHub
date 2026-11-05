import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const legacy=read('assets/rc1014-task-ui.css');
const v2=read('assets/taskplanner-v2.css');
const runtime=read('assets/taskplanner-v2-ui.js');
const modernSection=v2.split('/* Premium V2-Aufgabenkarten')[1];

test('Aufgabenkarten: aktiven V2-Renderer samt Priorität, Status und Detailaktion gestalten',()=>{
  assert.ok(modernSection,'V2-Kartenregeln müssen Bestandteil der aktiven V2-CSS-Datei sein');
  assert.match(runtime,/class="tpv2-task-card"/);
  assert.match(runtime,/data-priority=/);
  assert.match(runtime,/data-status=/);
  assert.match(runtime,/data-action="open"/);
  for(const cls of ['tpv2-task-list','tpv2-overdue-grid','tpv2-unplanned-grid']){
    assert.match(modernSection,new RegExp('\\.'+cls));
  }
  assert.match(modernSection,/data-priority="P0"/);
  assert.match(modernSection,/data-priority="P1"/);
  assert.match(modernSection,/data-status="done"/);
  assert.match(modernSection,/\.tpv2-task-meta/);
  assert.match(modernSection,/\.tpv2-button\[data-action="open"\]/);
});
test('Aufgaben: Warnungen und Pflichtbestätigung für ABD-Ausnahmen bleiben erkennbar',()=>{
  assert.match(v2,/\.tpv2-planner \.tpv2-task-card\.is-abd-exception/);
  assert.match(v2,/\.tpv2-approve-abd/);
  assert.match(modernSection,/\.is-abd-exception::before/);
  assert.match(modernSection,/\.is-overdue\{/);
  assert.match(legacy,/\.rc1014-priority\[data-rc1014-priority="P0"\]/);
  assert.match(legacy,/\.rc1014-due\[data-rc1014-due="overdue"\]/);
});
test('Aufgaben: Fokus, mobil und bewegungsreduziert; Papier bleibt unverändert',()=>{
  assert.match(modernSection,/:focus-within/);
  assert.match(modernSection,/@media\(max-width:760px\)/);
  assert.match(modernSection,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(modernSection,/@media screen/);
  assert.doesNotMatch(modernSection,/@media print/);
  assert.doesNotMatch(modernSection,/\.tpv2-day\b/);
  assert.match(legacy,/@media\(max-width:640px\)/);
  assert.match(legacy,/@media\(prefers-reduced-motion:reduce\)/);
});
