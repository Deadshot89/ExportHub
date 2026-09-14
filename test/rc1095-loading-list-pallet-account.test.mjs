import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

test('RC1095: Ladeliste kennzeichnet Europaletten als Palettenkonto-Ausgang',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/function rc1095LoadPalletCount\(sh,rs\)/,file+': Palettenzähler fehlt');
    assert.match(html,/function rc1095LoadPalletHtml\(sh,rs\)/,file+': Palettenkonto-Renderer fehlt');
    assert.match(html,/rc1095-pallet-account/,file+': sichtbarer Palettenkonto-Hinweis fehlt');
    assert.match(html,/>Palettenkonto</,file+': Palettenkonto-Bezeichnung fehlt');
    assert.match(html,/Ausgang: '\+count\+' Europalette/,file+': erwarteter Europaletten-Ausgang fehlt');
    assert.match(html,/euro\.\*pal\|eur\.\*pal/i,file+': nur Europaletten dürfen gezählt werden');
  }
});

test('RC1095: Palettenkonto-Zahl invalidiert den Ladelisten-Dokumentcache',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function documentCacheKey');
  const end=start<0?-1:html.indexOf('function ',start+'function documentCacheKey'.length);
  assert.ok(start>=0&&end>start,'documentCacheKey fehlt');
  const block=html.slice(start,end);
  assert.match(block,/String\(rc1095LoadPalletCount\(sh,rows\(sh\)\)\)/);
});

test('RC1095: Release-Builder und Live-Deploy prüfen den Ladelisten-Palettenhinweis',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(build,/patchLoadingListPalletAccount/);
  assert.match(build,/loadingListPalletAccount:\{version:'RC1095'/);
  assert.match(flow,/Live RC1095 Palettenkonto auf Ladeliste prüfen/);
  assert.match(flow,/Palettenkonto auf Ladeliste live in Produktion und TESTSERVICE bestätigt/);
});
