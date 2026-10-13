import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const restoreScript=fs.readFileSync('scripts/rc1520-posttest-release-isolation.mjs','utf8');
const mainWorkflow=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
const productionWorkflow=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');

function between(text,start,end){
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  assert.ok(a>=0,`${start} fehlt`);
  assert.ok(b>a,`${end} fehlt oder steht vor ${start}`);
  return text.slice(a,b);
}

test('RC1520: npm test räumt in GitHub Actions mutation-heavy Regressionen vor nachfolgenden Browser-Gates auf',()=>{
  assert.equal(pkg.scripts.posttest,'node scripts/rc1520-posttest-release-isolation.mjs');
  assert.match(restoreScript,/GITHUB_ACTIONS/);
  assert.match(restoreScript,/CI/);
  assert.match(restoreScript,/git['"],\['reset','--hard','HEAD'\]/);
  assert.match(restoreScript,/git['"],\['clean','-fd'\]/);
  assert.match(restoreScript,/apply-public-language\.mjs/);
  assert.match(restoreScript,/fix-mail-wording\.mjs/);
  assert.match(restoreScript,/npmCommand,\['run','pretest'/);
  assert.match(restoreScript,/git['"],\['show','HEAD:e2e\/specs\/public-smoke\.spec\.mjs'\]/);
  assert.match(restoreScript,/public-smoke\.spec\.mjs wurde nach sauberer Release-Vorbereitung erneut mutiert/);
});

test('RC1520: Main-Verifikation nutzt npm test vor Build und Live-Browser-Gate',()=>{
  const section=between(mainWorkflow,'- name: RC1112 Freigabevertrag prüfen','- name: RC1112 Produktion TESTSERVICE und Demo gemeinsam bauen');
  assert.match(section,/npm test/);
  assert.match(mainWorkflow,/RC1124 TESTSERVICE Browser Gate/);
  assert.match(mainWorkflow,/e2e\/specs\/public-smoke\.spec\.mjs/);
});

test('RC1520: Production-Promotion nutzt denselben npm-posttest-Schutz vor Production-Build und Smoke',()=>{
  const section=between(productionWorkflow,'- name: RC1505 Release-Verträge und Regression auf freigegebenem SHA prüfen','- name: RC1112 Production-Kandidat aus freigegebenem SHA bauen');
  assert.match(section,/npm test/);
  assert.match(productionWorkflow,/RC1124 Produktion Read-only Browser Smoke/);
  assert.match(productionWorkflow,/e2e\/specs\/public-smoke\.spec\.mjs/);
});
