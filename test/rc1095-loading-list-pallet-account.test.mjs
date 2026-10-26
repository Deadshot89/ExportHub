import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readLiveContract} from './helpers/rc1505-release-contract.mjs';

const read=p=>fs.readFileSync(p,'utf8');

before(()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
});

test('RC1603: Ladeliste zeigt keinen Palettenkonto-Block mehr oberhalb des Kopfes',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/function rc1095LoadPalletCount\(sh,rs\)/,file+': Palettenzähler für den Dokumentcache fehlt');
    assert.match(html,/document-print-name\.js/,file+': Palettenkonto-Datenquelle fehlt');
    assert.doesNotMatch(html,/function rc1095LoadPalletHtml\(/,file+': alter Kopf-Renderer darf nicht existieren');
    assert.doesNotMatch(html,/rc1095-pallet-account/,file+': alte Palettenkonto-Box wird noch erzeugt');
    assert.doesNotMatch(html,/Europaletten-Kontostand \/ EUR pallet balance/,file+': alte lange Kopfzeile vorhanden');
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

test('RC1603: Release-Builder und Production-Liveprüfung verbieten den alten Kopf-Hinweis',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  const live=readLiveContract();
  assert.match(build,/patchLoadingListPalletAccount/);
  assert.doesNotMatch(build,/block=block\.replace\(head,.*rc1095LoadPalletHtml/);
  assert.match(live,/RC1603/);
  assert.match(live,/rc1095LoadPalletCount/);
  assert.match(live,/rc1095-pallet-account/);
  assert.match(build,/loadingListPalletAccount:\{version:'RC1095'/);
  assert.match(live,/RC1543 Palettenkonto-Kontostand/);
  assert.match(live,/palletBalanceCacheKey/);
});
