import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

test('RC1057: readJson liefert die tatsächlich gelesene Blob-Größe ohne zusätzlichen Storage-Request',()=>{
  assert.match(source,/const\s+rawBuffer\s*=\s*Buffer\.concat\(chunks\)/);
  assert.match(source,/bytes\s*:\s*rawBuffer\.length/);
  assert.match(source,/statusCode===404[^\n]*bytes\s*:\s*0/);
});

test('RC1057: State-Health meldet sichere Byte-Zähler für Team-State und Auth-Blob',()=>{
  assert.match(source,/teamStateBytes\s*:\s*Number\(teamCheck\.bytes\|\|0\)/);
  assert.match(source,/authBlobBytes\s*:\s*Number\(authCheck\.bytes\|\|0\)/);
});
