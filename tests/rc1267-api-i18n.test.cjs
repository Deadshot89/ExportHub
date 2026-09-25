const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const apiI18n=require('../api/shared/i18n');
const LANGS=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(LANGS.map(lang=>[lang,JSON.parse(fs.readFileSync('api/shared/i18n/'+lang+'.json','utf8'))]));

test('RC1267 API language packs have identical non-empty keys',()=>{
  const base=Object.keys(packs.de).sort();
  assert.ok(base.length>0);
  for(const lang of LANGS){
    assert.deepEqual(Object.keys(packs[lang]).sort(),base,lang+' key set');
    for(const key of base)assert.notEqual(String(packs[lang][key]??'').trim(),'',
      lang+' empty '+key);
  }
});

test('RC1267 API language packs do not leave English placeholders in non-English languages',()=>{
  const allowedSameAsEnglish={fr:new Set(['api.avis.document','api.reference.document'])};
  for(const lang of ['pl','es','fr','it']){
    for(const key of Object.keys(packs.en)){
      if(allowedSameAsEnglish[lang]&&allowedSameAsEnglish[lang].has(key))continue;
      assert.notEqual(packs[lang][key],packs.en[key],lang+' still equals English for '+key);
    }
  }
});

test('RC1267 API i18n resolves request language and interpolation',()=>{
  const req={headers:{'x-exporthub-language':'pl'}};
  assert.equal(apiI18n.language(req),'pl');
  assert.equal(apiI18n.t(req,'api.avis.limit',{count:10}),'Dla tej przesyłki zapisano już 10 dokumentów klienta.');
  assert.match(apiI18n.t({headers:{'accept-language':'fr-FR,fr;q=0.9'}},'api.release.noActive',{channel:'production'}),/production/);
  assert.equal(apiI18n.language({headers:{'x-exporthub-language':'xx'}}),'de');
});

test('RC1267 browser runtime sends active language with same-origin API requests',()=>{
  const runtime=fs.readFileSync('assets/rc1267-i18n.js','utf8');
  assert.match(runtime,/X-ExportHUB-Language/);
  assert.match(runtime,/\/\^\\\/api\\\//);
  assert.match(runtime,/installApiLanguageFetch/);
});

test('RC1267 customer AVIS keeps the required 14-day post-pickup window',()=>{
  const src=fs.readFileSync('api/customer-avis/index.js','utf8');
  assert.match(src,/addCalendarDays\(picked,14\)/);
  assert.match(src,/postPickupDays:14/);
  assert.doesNotMatch(src,/postPickupDays:3/);
  assert.match(src,/api\.avis\.expired14/);
});


test('RC1277 API localizes warehouse, container and shared document errors',()=>{
  assert.equal(apiI18n.t({headers:{'x-exporthub-language':'pl'}},'api.location.invalid'),'Nieprawidłowa lokalizacja magazynowa.');
  assert.match(apiI18n.t({headers:{'x-exporthub-language':'fr'}},'api.container.photoLabel.sealed'),/Conteneur scellé/);
  const pdf=fs.readFileSync('api/shared/customer-avis-pdf-security.js','utf8');
  const refs=fs.readFileSync('api/shared/reference-folder-upload.js','utf8');
  const pickup=fs.readFileSync('api/pickup-container-document/index.js','utf8');
  assert.match(pdf,/api\.pdf\.activeContent/);
  assert.match(refs,/api\.reference\.folderCheckFailed/);
  assert.match(refs,/api\.reference\.folderCreateFailed/);
  assert.match(refs,/api\.reference\.fileUploadFailed/);
  assert.match(pickup,/publicPhoto\(req,photo\)/);
  assert.match(pickup,/apiI18n\.t\(req,key\)/);
});

test('RC1277 strict UI audit includes API translations but ignores business master-data names',()=>{
  const audit=fs.readFileSync('scripts/i18n-audit.mjs','utf8');
  assert.match(audit,/apiDePath=path\.join\(ROOT,'api','shared','i18n','de\.json'\)/);
  assert.match(audit,/rc1014-fixed-pickup-seed\.js/);
  assert.match(audit,/siteLabel\\s\*:/);
});
