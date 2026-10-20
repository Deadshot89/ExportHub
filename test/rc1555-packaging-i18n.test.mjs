import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const locales=['de','en','pl','es','fr','it'];
const required=[
  'packaging.masterdata.nav','packaging.masterdata.breadcrumbManagement','packaging.masterdata.breadcrumbMasterdata',
  'packaging.masterdata.title','packaging.masterdata.intro','packaging.masterdata.add','packaging.masterdata.search','packaging.masterdata.filterAll',
  'packaging.masterdata.sortName','packaging.masterdata.sortStatus','packaging.masterdata.sortUpdated',
  'packaging.masterdata.name','packaging.masterdata.code','packaging.masterdata.description','packaging.masterdata.status',
  'packaging.masterdata.updatedAt','packaging.masterdata.updatedBy','packaging.masterdata.actions',
  'packaging.masterdata.duplicate','packaging.masterdata.activate','packaging.masterdata.deactivate',
  'packaging.masterdata.createTitle','packaging.masterdata.editTitle','packaging.masterdata.created','packaging.masterdata.updated',
  'packaging.masterdata.activated','packaging.masterdata.deactivated','packaging.masterdata.deleted','packaging.masterdata.archived',
  'packaging.masterdata.confirmDelete','packaging.masterdata.duplicateSuffix','packaging.masterdata.empty','packaging.masterdata.loading',
  'packaging.masterdata.failed','packaging.masterdata.adminOnly'
];
const requiredApi=[
  'api.packaging.methodNotAllowed','api.packaging.adminRequired','api.packaging.invalidAction','api.packaging.serverError',
  'api.packaging.timeInvalid','api.packaging.notFound','api.packaging.nameRequired','api.packaging.nameExists','api.packaging.codeExists'
];

test('RC1555 packaging masterdata feature packs exist with identical non-empty keys in all six languages',()=>{
  const packs={};
  for(const lang of locales){const path=`assets/i18n/rc1555-packaging-masterdata/${lang}.json`;assert.equal(fs.existsSync(path),true,`${lang}: feature pack missing`);packs[lang]=JSON.parse(fs.readFileSync(path,'utf8'));}
  for(const lang of locales){assert.deepEqual(Object.keys(packs[lang]).sort(),Object.keys(packs.de).sort(),`${lang}: feature-pack keys differ from de`);for(const key of required){assert.ok(Object.prototype.hasOwnProperty.call(packs[lang],key),`${lang}: missing ${key}`);assert.ok(String(packs[lang][key]||'').trim(),`${lang}: empty ${key}`);}}
});

test('RC1555 packaging management uses central language selection and only falls back to the central feature pack',()=>{
  const source=fs.readFileSync('assets/rc1555-packaging-management.js','utf8');
  assert.match(source,/ExportHUBI18n\.t/,'central t() API must be used first');
  assert.match(source,/ExportHUBI18n\.language/,'central language selection must drive the feature pack');
  assert.match(source,/\/assets\/i18n\/rc1555-packaging-masterdata\//,'central feature pack path missing');
  assert.doesNotMatch(source,/\b(?:de|en|pl|es|fr|it)\s*:\s*\{[^}]*title\s*:/s,'private six-language object must not be reintroduced');
});

test('RC1555 packaging admin API errors use the central six-language API i18n contract',()=>{
  const source=fs.readFileSync('api/packaging-admin/index.js','utf8');
  assert.match(source,/require\('\.\.\/shared\/i18n'\)/,'packaging admin API must use central API i18n');
  assert.match(source,/apiI18n\.t\(req,/,'packaging admin API must localize user-facing errors per request');
  const apiI18n=require('../api/shared/i18n.js');
  for(const lang of locales){
    for(const key of requiredApi){
      const translated=apiI18n.tLang(lang,key);
      assert.notEqual(translated,key,`${lang}: missing ${key}`);
      assert.ok(String(translated||'').trim(),`${lang}: empty ${key}`);
    }
  }
});
