import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader=fs.readFileSync('infra/production-loader.html','utf8');

test('RC1506: aktiver Release-Stand bleibt immer ungecached frisch',()=>{
  assert.match(loader,/get\(API\+'\?action=active&channel=production&_='\+Date\.now\(\)\)/);
  assert.match(loader,/cache:'no-store'/);
});

test('RC1506: freigegebenes Produktions-HTML wird versions- und SHA-gebunden wiederverwendet',()=>{
  assert.match(loader,/var HTML_CACHE='exporthub-production-html-v1'/);
  assert.match(loader,/function releaseCacheKey\(meta\)/);
  assert.match(loader,/encodeURIComponent\(String\(meta\.version\|\|''\)\)/);
  assert.match(loader,/encodeURIComponent\(String\(meta\.sha\|\|''\)\)/);
  assert.match(loader,/caches\.open\(HTML_CACHE\)/);
  assert.match(loader,/cache\.match\(key\)/);
  assert.match(loader,/cache\.put\(key,response\.clone\(\)\)/);
  assert.match(loader,/function getReleaseHtml\(meta\)/);
  assert.match(loader,/getReleaseHtml\(m\)/);
});

test('RC1506: Cache ist optional und der bisherige Netzwerkpfad bleibt Fallback',()=>{
  assert.match(loader,/if\(!\('caches' in window\)\)return get\(API\+'\?action=html&channel=production&_='\+Date\.now\(\),'text\/html'\)/);
  assert.match(loader,/fetch\(API\+'\?action=html&channel=production&_='\+Date\.now\(\),\{credentials:'same-origin',cache:'no-store',headers:\{Accept:'text\/html'\}\}\)/);
  assert.equal((loader.match(/action=html&channel=production/g)||[]).length,2,'HTML-Netzwerkpfade muessen auf Cache-Fallback und Cache-Miss begrenzt bleiben');
});
