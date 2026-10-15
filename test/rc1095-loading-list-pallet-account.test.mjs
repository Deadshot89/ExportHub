import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readLiveContract} from './helpers/rc1505-release-contract.mjs';

const read=p=>fs.readFileSync(p,'utf8');

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

test('RC1543: Ladeliste zeigt den aktuellen Europaletten-Kontostand statt Palettenkonto-Ausgang',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/function rc1095LoadPalletCount\(sh,rs\)/,file+': Palettenzähler fehlt');
    assert.match(html,/function rc1095LoadPalletHtml\(sh,rs\)/,file+': Palettenkonto-Renderer fehlt');
    assert.match(html,/rc1095-pallet-account/,file+': sichtbarer Palettenkonto-Hinweis fehlt');
    assert.match(html,/>Palettenkonto</,file+': Palettenkonto-Bezeichnung fehlt');
    assert.match(html,/Europaletten-Kontostand \/ EUR pallet balance/,file+': bilingualer Kontostand fehlt');
    assert.match(html,/data-rc1543-pallet-balance/,file+': RC1543 Kontostandmarker fehlt');
    assert.match(html,/palletBalanceForShipment/,file+': Palettenkonto-Datenquelle fehlt');
    assert.doesNotMatch(html,/Ausgang: '\+count\+' Europalette/,file+': alter Sendungs-Ausgang wird noch als Kontostand ausgegeben');
    assert.match(html,/euro\.\*pal\|eur\.\*pal/i,file+': nur Europaletten dürfen gezählt werden');
  }
});

test('RC1543: aktueller Palettenkontostand invalidiert den Ladelisten-Dokumentcache',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function documentCacheKey');
  const end=start<0?-1:html.indexOf('function ',start+'function documentCacheKey'.length);
  assert.ok(start>=0&&end>start,'documentCacheKey fehlt');
  const block=html.slice(start,end);
  assert.match(block,/String\(rc1095LoadPalletCount\(sh,rows\(sh\)\)\)/);
  assert.match(block,/palletBalanceCacheKey\(sh\)/,'Kontostand muss den Dokumentcache invalidieren');
});

test('RC1543: Release-Builder und Production-Liveprüfung prüfen den Kontostand statt Ausgang',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  const live=readLiveContract();
  assert.match(build,/patchLoadingListPalletAccount/);
  assert.match(build,/loadingListPalletAccount:\{version:'RC1095'/);
  assert.match(live,/RC1543 Palettenkonto-Kontostand/);
  assert.match(live,/function rc1095LoadPalletHtml/);
  assert.match(live,/rc1095-pallet-account/);
  assert.match(live,/Palettenkonto/);
  assert.match(live,/Europaletten-Kontostand \/ EUR pallet balance/);
  assert.match(live,/data-rc1543-pallet-balance/);
  assert.match(live,/palletBalanceCacheKey/);
});
