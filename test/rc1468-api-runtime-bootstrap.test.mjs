'use strict';

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync('scripts/rc1462-pretest.mjs','utf8');

test('RC1468: komplette Node-Regression bootstrapt API-Runtime-Abhaengigkeiten',()=>{
  assert.match(source,/createRequire/,'pretest muss API-Abhaengigkeiten aus api\/package.json aufloesen koennen');
  for(const dependency of ['@azure/storage-blob','pdf-lib','pdf-parse','exceljs']){
    assert.ok(source.includes(`'${dependency}'`)||source.includes(`\"${dependency}\"`),`${dependency} muss vom Bootstrap geprueft werden`);
  }
  assert.match(source,/execFileSync\(/,'fehlende API-Abhaengigkeiten muessen reproduzierbar installiert werden');
  assert.match(source,/['\"]install['\"]/);
  assert.match(source,/['\"]--prefix['\"]\s*,\s*['\"]api['\"]/);
  assert.match(source,/['\"]--ignore-scripts['\"]/);
  assert.match(source,/['\"]--no-audit['\"]/);
  assert.match(source,/['\"]--no-fund['\"]/);
  assert.match(source,/['\"]--package-lock=false['\"]/);
});
