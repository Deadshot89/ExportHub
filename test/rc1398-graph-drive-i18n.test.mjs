import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('api/shared/graph-drive.js','utf8');

test('RC1398: Graph-Zielfehler-Fallback bleibt sprachneutral und stabil',()=>{
  assert.match(source,/targetFailureCache\.message \|\| 'GRAPH_TARGET_FAILED'/);
  assert.doesNotMatch(source,/Das Microsoft-365-POD-Ziel ist vorübergehend nicht auflösbar/);
  execFileSync(process.execPath,['--check','api/shared/graph-drive.js'],{stdio:'pipe'});
});
