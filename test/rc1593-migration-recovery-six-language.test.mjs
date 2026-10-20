import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('migration-recovery.html','utf8');
const langs=['de','en','pl','es','fr','it'];
const dictionaries=Object.fromEntries(langs.map(lang=>[lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))]));
const keys=['title','eyebrow','heading','intro','checking','found','completed','remaining','batches','retry','stop','back'];
const annotated=['eyebrow','heading','intro','found','completed','remaining','batches','retry','stop','back'];

test('RC1593: recovery page includes the production six-language translator without changing the migration API',()=>{
  assert.match(html,/<script id="exporthub-migration-recovery-i18n" defer src="\/assets\/rc1267-i18n\.js\?v=1267"><\/script>/);
  for(const name of annotated){
    assert.ok(html.includes('data-i18n="migrationRecovery.'+name+'"'),name+' must have an explicit translation key');
  }
  assert.doesNotMatch(html,/id="status"[^>]+data-i18n=/,'live status must never be reset by fixed text translation');
  assert.match(html,/window\.addEventListener\('exporthub:language-changed'/);
  assert.match(html,/document\.title=api\.t\('migrationRecovery\.title'\)/);
  assert.match(html,/fetch\('\/api\/exporthub-document-migrate'/);
  assert.match(html,/limit:BATCH/);
  assert.match(html,/BATCH=5/);
  assert.match(html,/if\(running\)return/);
  assert.match(html,/if\(stopRequested\)/);
  assert.match(html,/r\.failed\|\|0/);
  assert.match(html,/sessionStorage\.getItem/);
});

test('RC1593: recovery labels and source text exist in all six complete language packs',()=>{
  for(const name of keys){
    const key='migrationRecovery.'+name;
    const german=dictionaries.de[key];
    assert.ok(typeof german==='string'&&german.trim(),key+' source not found');
    for(const lang of langs){
      const value=dictionaries[lang][key];
      assert.ok(typeof value==='string'&&value.trim(),lang+' translation missing for '+key);
      if(lang!=='de')assert.notEqual(value,german,lang+' untranslated '+key);
    }
  }
  for(const name of ['eyebrow','heading','intro','checking','found','completed','remaining','batches','retry','stop','back']){
    assert.ok(html.includes(dictionaries.de['migrationRecovery.'+name]),'source mismatch: '+name);
  }
});

test('RC1593: recovery inline migration code remains valid and does not touch saved team state directly',()=>{
  const script=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script,'existing inline process must remain embedded');
  assert.doesNotThrow(()=>new vm.Script(script[1]),'safe migration runtime must parse');
  assert.doesNotMatch(script[1],/localStorage\.clear\s*\(/);
  assert.doesNotMatch(script[1],/sessionStorage\.clear\s*\(/);
});
