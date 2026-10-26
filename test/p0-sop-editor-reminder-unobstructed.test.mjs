import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const script=fs.readFileSync('assets/taskplanner-v2-planner-ui.js','utf8');
const css=fs.readFileSync('assets/taskplanner-v2.css','utf8');

test('P0 release: SOP editor reminder is minimized and moved out of editor hit targets',()=>{
 assert.match(css,/body:has\(\[data-sop-editor\]\) \.tpv2-reminder-host\s*\{\s*top:96px;bottom:auto;/);
 assert.match(css,/body:has\(\[data-sop-editor\]\) \.tpv2-reminder-toast:not\(\[data-expanded="true"\]\) ul/);
 assert.match(css,/body:has\(\[data-sop-editor\]\) \.tpv2-reminder-toast:not\(\[data-expanded="true"\]\) > p\s*\{display:none\}/);
 assert.doesNotMatch(css,/body:has\(\[data-sop-editor\]\) \.tpv2-reminder-toast\s*\{display:none/);
});

test('P0 release: every reminder remains accessible by explicit expand and close actions',()=>{
 assert.match(script,/data-tpv2-reminder-expand aria-expanded="false"/);
 assert.match(script,/const expand=el\.closest\('\[data-tpv2-reminder-expand\]'\)/);
 assert.match(script,/section\.setAttribute\('data-expanded',String\(next\)\)/);
 assert.match(script,/expand\.setAttribute\('aria-expanded',String\(next\)\)/);
 assert.match(script,/if\(el\.closest\('\[data-tpv2-reminder-close\]'\)\)/);
 assert.match(script,/data-tpv2-reminder-done/);
 assert.match(script,/data-tpv2-reminder-open/);
});

test('P0 release: task reminder change preserves valid script and stops before production',()=>{
 const check=spawnSync(process.execPath,['--check','assets/taskplanner-v2-planner-ui.js'],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr||check.stdout);
});
