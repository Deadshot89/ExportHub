import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflows=[
  '.github/workflows/rc1005-e3-apply.yml',
  '.github/workflows/rc1008-system-sops.yml',
  '.github/workflows/rc1011-core-open-issues.yml',
  '.github/workflows/rc1017-development-verify.yml'
];

test('RC1496: historische Apply-/Development-Workflows sind read-only',()=>{
  for(const file of workflows){
    const source=fs.readFileSync(file,'utf8');
    assert.match(source,/permissions:\s*[\s\S]*?contents:\s*read\b/,`${file} muss contents: read verwenden.`);
    assert.doesNotMatch(source,/contents:\s*write\b/,`${file} darf keine Repository-Schreibrechte besitzen.`);
    assert.doesNotMatch(source,/\bgit\s+push\b/i,`${file} darf keine Commits in Remote-Branches pushen.`);
  }
});
