import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc1718PrintIframeHtml} from '../scripts/rc1718-qr-print-iframe-pages.mjs';

const original=fs.readFileSync('index.html','utf8');

test('RC1718: the real QR/REF output iframe receives print rules, not just the app page',()=>{
  assert.match(original,/function styleText\(\)\{if\(docStyleCache\)return docStyleCache/);
  assert.match(original,/frame\.contentWindow\.print\(\)/);
  assert.match(original,/var doc=resetDocumentWorkFrame\(frame,.*root=clonePages\(mode\|\|'all',doc,source\)/);
  const patched=patchRc1718PrintIframeHtml(original);
  assert.equal(patchRc1718PrintIframeHtml(patched),patched,'patch must be idempotent');
  assert.equal(patched.split('var RC1718_PRINT_IFRAME_CSS=').length-1,1);
  const start=patched.indexOf('var RC1718_PRINT_IFRAME_CSS=');
  const end=patched.indexOf('function documentWorkFrame(',start);
  assert.ok(start>0&&end>start,'actual styleText() injection missing');
  const code='var docStyleCache=null;\n'+patched.slice(start,end)+'\nstyleText();';
  const css=vm.runInNewContext(code,{
    document:{getElementById(id){assert.equal(id,'exporthub-rc352-document-style');return{textContent:'.original-document-style{color:black}'}}}
  });
  assert.match(css,/\.original-document-style\{color:black\}/,'do not replace approved document style');
  assert.match(css,/@page\{size:A4 portrait;margin:0\}/,'Chrome must not add header/footer or shrink printable area');
  assert.match(css,/#index352OutputRoot>\.index352-output-page:last-child\{break-after:auto!important;page-break-after:auto!important\}/);
  assert.match(css,/#index352OutputRoot>\.rc390-load \.rc390-bottom\{position:relative!important/,'footer must remain in content flow');
  assert.match(css,/#index352OutputRoot>\.rc390-page\.rc390-load\{display:flex!important;flex-direction:column!important;height:auto!important;min-height:296mm!important/,'footer-only overflow must not force one extra sheet');
  assert.doesNotMatch(css,/display:none!important[^}]*\.rc390-bottom/,'never hide the signatures');
});

test('RC1718: all three deployment environments receive the same fixed print path',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/import \{patchRc1718PrintIframeHtml\} from '\.\.\/\.\.\/scripts\/rc1718-qr-print-iframe-pages\.mjs'/);
  assert.match(build,/patchRc1718PrintIframeHtml\(patchRc1716PodBatchHtml\(/);
  assert.match(build,/for\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)/);
  assert.throws(()=>patchRc1718PrintIframeHtml('<html></html>'),/anchor missing/,'do not silently ship an unpatched print runtime');
});
