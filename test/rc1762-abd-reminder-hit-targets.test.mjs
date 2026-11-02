import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/taskplanner-v2.css','utf8');
const actions=fs.readFileSync('assets/taskplanner-v2-planner-ui.js','utf8');

test('RC1762: task reminders remain visible but collapsed on ABD forms',()=>{
 assert.match(css,/@supports selector\(body:has\(#rc626Abd\)\)/);
 assert.match(css,/body:has\(#rc626Abd\) \.tpv2-reminder-host\s*\{\s*top:96px;bottom:auto;/);
 assert.match(css,/body:has\(#rc626Abd\) \.tpv2-reminder-toast:not\(\[data-expanded="true"\]\) ul/);
 assert.match(css,/body:has\(#rc626Abd\) \.tpv2-reminder-toast:not\(\[data-expanded="true"\]\) > p\{display:none\}/);
 assert.doesNotMatch(css,/body:has\(#rc626Abd\) \.tpv2-reminder-toast\s*\{display:none/);
});

test('RC1762: users can still expand and dismiss reminders',()=>{
 assert.match(css,/body:has\(#rc626Abd\) \.tpv2-reminder-expand\{display:inline-flex\}/);
 assert.match(actions,/data-tpv2-reminder-expand aria-expanded="false"/);
 assert.match(actions,/if\(el\.closest\('\[data-tpv2-reminder-close\]'\)\)/);
});
