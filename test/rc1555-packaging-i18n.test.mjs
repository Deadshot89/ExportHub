import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

test('RC1555 packaging masterdata keys exist and are non-empty in all six central locale files',()=>{
  const packs=Object.fromEntries(locales.map(lang=>[lang,JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'))]));
  for(const lang of locales)for(const key of required){assert.ok(Object.prototype.hasOwnProperty.call(packs[lang],key),`${lang}: missing ${key}`);assert.ok(String(packs[lang][key]||'').trim(),`${lang}: empty ${key}`);}
});

test('RC1555 packaging management does not ship a private language table',()=>{
  const source=fs.readFileSync('assets/rc1555-packaging-management.js','utf8');
  assert.match(source,/ExportHUBI18n\.t/,'central t() API must be used');
  assert.doesNotMatch(source,/\b(?:de|en|pl|es|fr|it)\s*:\s*\{[^}]*title\s*:/s,'private six-language object must not be reintroduced');
});
