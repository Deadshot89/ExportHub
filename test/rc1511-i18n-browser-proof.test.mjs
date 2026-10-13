import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

const specPath='e2e/specs/rc1511-six-language-i18n.spec.mjs';
const workflowPath='.github/workflows/rc1511-i18n-browser.yml';

test('RC1511: real browser gate exists for six languages on mobile-standard and laptop',()=>{
  assert.equal(fs.existsSync(specPath),true,'six-language Playwright spec is missing');
  assert.equal(fs.existsSync(workflowPath),true,'RC1511 PR browser workflow is missing');
  const spec=read(specPath);
  for(const lang of ['de','en','pl','es','fr','it'])assert.match(spec,new RegExp(`['\"]${lang}['\"]`),`missing language ${lang}`);
  assert.match(spec,/customer-avis\.html/);
  assert.match(spec,/avis\.title/);
  assert.match(spec,/assertNoHorizontalOverflow/);
  assert.match(spec,/assertRuntimeClean/);
  const workflow=read(workflowPath);
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/node \.github\/rc1112\/build-three-env\.mjs/);
  assert.match(workflow,/rc1511-six-language-i18n\.spec\.mjs/);
  assert.match(workflow,/--project=mobile-standard/);
  assert.match(workflow,/--project=laptop/);
});

test('RC1511: customer AVIS visible dates and numbers delegate to central locale formatters',()=>{
  const page=read('customer-avis.html');
  assert.match(page,/ExportHUBI18n[\s\S]*?formatDate/,'customer AVIS must use central date formatting');
  assert.match(page,/ExportHUBI18n[\s\S]*?formatNumber/,'customer AVIS must use central number formatting');
  const formatterBlock=page.slice(page.indexOf('function fmtDate('),page.indexOf('function setStatus('));
  assert.doesNotMatch(formatterBlock,/toLocaleDateString\(['\"]de-DE['\"]/,'visible AVIS date format must not be hard-coded German');
  assert.doesNotMatch(formatterBlock,/toLocaleString\(['\"]de-DE['\"]/,'visible AVIS number format must not be hard-coded German');
});
