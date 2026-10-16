import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader=fs.readFileSync('infra/production-loader.html','utf8');

test('RC1509: nur eindeutig versionierte Releases mit SHA sind cachefähig',()=>{
  assert.match(
    loader,
    /function cacheableRelease\(meta\)\{return !!\(meta&&String\(meta\.version\|\|''\)\.trim\(\)&&String\(meta\.sha\|\|''\)\.trim\(\)\)\}/,
    'Loader benötigt eine explizite Version+SHA-Cachefreigabe'
  );
  assert.match(
    loader,
    /if\(!cacheableRelease\(meta\)\|\|!\('caches' in window\)\)return get\(API\+'\?action=html&channel=production&_='\+Date\.now\(\),'text\/html'\)/,
    'Legacy-/SHA-lose Releases und Browser ohne Cache API müssen denselben unveränderten Netzwerkpfad verwenden'
  );
});

test('RC1509: aktiver Release-Status bleibt no-store und SHA-gebundener Cachepfad bleibt erhalten',()=>{
  assert.match(loader,/get\(API\+'\?action=active&channel=production&_='\+Date\.now\(\)\)/);
  assert.match(loader,/cache:'no-store'/);
  assert.match(loader,/function releaseCacheKey\(meta\)/);
  assert.match(loader,/encodeURIComponent\(String\(meta\.version\|\|''\)\)/);
  assert.match(loader,/encodeURIComponent\(String\(meta\.sha\|\|''\)\)/);
  assert.match(loader,/cache\.match\(key\)/);
  assert.match(loader,/cache\.put\(key,response\.clone\(\)\)/);
});
