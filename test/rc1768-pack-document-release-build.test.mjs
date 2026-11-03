import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchRc1768PackDocumentCredentials} from '../scripts/rc1768-pack-document-credentials.mjs';

const OLD = "nextInit.credentials = 'same-origin';";
const FIXED = "nextInit.credentials = init && init.credentials === 'omit' ? 'omit' : 'same-origin';";
const environments=['index.html','TESTVERSION.html','demo.html'];

for (const file of environments) {
  test('RC1768: built '+file+' preserves cookie-free document fetch', () => {
    // Critical: RC1112 copies dist-rc1048 first. Root index/TESTVERSION
    // already had RC1702 but the deploy artifact still restored RC886.
    const base=fs.readFileSync('dist-rc1048/'+file,'utf8');
    assert.equal(base.split(OLD).length-1,1,'known RC1048 legacy wrapper must be exercised');
    const built=patchRc1768PackDocumentCredentials(base,file);
    assert.equal(built.split(FIXED).length-1,1);
    assert.equal(built.includes(OLD),false);
    assert.equal(built,base.replace(OLD,FIXED),'do not alter unrelated API requests or layout');
    assert.equal(patchRc1768PackDocumentCredentials(built,file),built,'idempotent build');
  });
}

test('RC1768: missing, duplicate or unrelated transport wrappers fail release closed',()=>{
  assert.throws(()=>patchRc1768PackDocumentCredentials('<html></html>','TESTVERSION.html'),/RC886 API wrapper missing/);
  const fixture='/* exporthub-rc886-testservice-api-hotfix */ '+OLD+' '+OLD;
  assert.throws(()=>patchRc1768PackDocumentCredentials(fixture,'TESTVERSION.html'),/exactly one/);
  const misplaced=OLD+' /* exporthub-rc886-testservice-api-hotfix */';
  assert.throws(()=>patchRc1768PackDocumentCredentials(misplaced,'TESTVERSION.html'),/outside RC886 wrapper/);
});

test('RC1768: active release builder patches the shipped HTML and validates it after fingerprinting',()=>{
  const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(source,/import \{patchRc1768PackDocumentCredentials\} from '\.\.\/\.\.\/scripts\/rc1768-pack-document-credentials\.mjs';/);
  assert.match(source,/html=patchRc1768PackDocumentCredentials\(html,file\);/);
  assert.ok(source.indexOf('fingerprintAssets({root:ROOT,out:OUT});')<source.indexOf('for (const file of [\'index.html\',\'TESTVERSION.html\',\'demo.html\']) {\n  const shipped='),'release guard must inspect final artifacts');
});
