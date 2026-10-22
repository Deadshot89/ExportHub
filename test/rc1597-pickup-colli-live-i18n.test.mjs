import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const languages=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(languages.map(lang=>[lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))]));
const page=fs.readFileSync('pickup.html','utf8');
const names=['loadedCollis','partialConfirmed','partialRange','fullConfirmed','fullRequired'];

function fields(text){return [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(x=>x[1]).sort()}

test('RC1597: pickup partial/full Colli status is localized across all six languages with stable numeric placeholders',()=>{
  assert.deepEqual(Object.keys(packs.de).filter(key=>key.startsWith('pickup.dynamic.')).sort(),names.map(name=>'pickup.dynamic.'+name).sort());
  for(const name of names){
    const key='pickup.dynamic.'+name,baseline=packs.de[key];
    assert.ok(page.includes("pickupTr('"+name+"'"),'missing live call for '+key);
    for(const language of languages){
      const candidate=packs[language][key];
      assert.ok(typeof candidate==='string'&&candidate.trim(),language+': missing '+key);
      assert.deepEqual(fields(candidate),fields(baseline),language+': interpolation mismatch '+key);
      if(language!=='de')assert.notEqual(candidate,baseline,language+': untranslated '+key);
    }
  }
});

test('RC1597: safe German fallback and English substitution retain exact Colli quantities',()=>{
  const start=page.indexOf('function pickupTr('),end=page.indexOf('function ',start+9);
  assert.ok(start>=0&&end>start);
  const sandbox={window:{}};
  vm.runInNewContext(page.slice(start,end)+'\nthis.t=pickupTr;',sandbox);
  const key='pickup.dynamic.partialConfirmed';
  assert.equal(sandbox.t('partialConfirmed',packs.de[key],{confirmed:2,remaining:3}),
    '✓ Teilabholung: 2 Colli bestätigt. Danach bleiben 3 Colli offen.');
  sandbox.window.ExportHUBI18n={t(key,vars){return packs.en[key].replace(/\{\{([\w.-]+)\}\}/g,(_,name)=>String(vars[name]))}};
  assert.equal(sandbox.t('partialConfirmed',packs.de[key],{confirmed:2,remaining:3}),
    '✓ Partial collection: 2 packages confirmed. 3 packages remain.');
  assert.equal(sandbox.t('fullRequired',packs.de['pickup.dynamic.fullRequired'],{count:5}),
    'For full collection, all 5 outstanding packages must be confirmed.');
});

test('RC1597: Colli gate is unchanged and partial pickup cannot skip driver unlock, customs or container validation',()=>{
  assert.match(page,/if\(n>0&&n<open\)\{colliOk=true/);
  assert.match(page,/if\(n===open\)\{colliOk=true/);
  assert.match(page,/if\(mode==='complete'&&containerRequired&&!seal\)/);
  assert.match(page,/if\(customsDocumentsRequired&&!customsConfirmed\)/);
  assert.match(page,/!checkColli\(mode\)/);
  assert.match(page,/pickup-confirm-v2/);
  assert.match(page,/function status\([^)]*\)[^\n]*textContent/);
  const inline=page.slice(page.lastIndexOf('<script>')+8,page.lastIndexOf('</script>'));
  assert.doesNotThrow(()=>new vm.Script(inline));
});
