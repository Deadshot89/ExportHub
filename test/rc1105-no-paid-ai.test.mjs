import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const file of ['test/rc1105-history-lifecycle-e2e.test.mjs','test/rc1105-mail-history-release-contract.test.mjs','test/rc1105-qr-backward-compatibility-contract.test.mjs']){
  test('RC1105 kostenneutral: '+file,()=>{
    const source=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(source,/api\.openai\.com|openai\s*api|chatgpt\s*api/i);
  });
}
