import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function write(path,value){fs.writeFileSync(path,value)}
function replaceOnce(source,before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before,after);
}

// 1) Base Ladelisten-Renderer: niemals mehr den Sendungs-Ausgang als Kontostand ausgeben.
{
  const path='.github/rc1048/build-three-env.mjs';
  let source=read(path);
  const lines=source.split('\n');
  const index=lines.findIndex(line=>line.includes('"function rc1095LoadPalletHtml(sh,rs)'));
  if(index<0)throw new Error('RC1543: rc1095LoadPalletHtml helper line missing');
  const indent=lines[index].match(/^\s*/)?.[0]||'';
  const hadComma=/,\s*$/.test(lines[index]);
  const fn="function rc1095LoadPalletHtml(sh,rs){var count=rc1095LoadPalletCount(sh,rs);if(!(count>0))return'';var api=window.ExportHUBDocumentPrintNames,account=null,text='Kontostand nicht erfasst / Balance not recorded';try{if(api&&typeof api.palletBalanceForShipment==='function'&&typeof api.palletBalanceText==='function'){account=api.palletBalanceForShipment(sh);text=api.palletBalanceText(account)}}catch(_){}return '<div class=rc1095-pallet-account data-rc1543-pallet-balance=1 style=display:grid;grid-template-columns:minmax(0,1fr);gap:3px;margin-bottom:10px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc><b>Palettenkonto</b><span>Europaletten-Kontostand / EUR pallet balance</span><strong>'+text+'</strong></div>'}";
  lines[index]=indent+JSON.stringify(fn)+(hadComma?',':'');
  source=lines.join('\n');
  source=replaceOnce(
    source,
    'cache=cache.replace(cacheAnchor,"String(totals(sh).ldm),String(rc1095LoadPalletCount(sh,rows(sh)))]");',
    'cache=cache.replace(cacheAnchor,"String(totals(sh).ldm),String(rc1095LoadPalletCount(sh,rows(sh))),String(window.ExportHUBDocumentPrintNames&&typeof window.ExportHUBDocumentPrintNames.palletBalanceCacheKey===\'function\'?window.ExportHUBDocumentPrintNames.palletBalanceCacheKey(sh):\'pallet-balance-not-recorded\')]");',
    'RC1543 pallet balance cache key'
  );
  source=replaceOnce(
    source,
    "if(!out.includes('rc1095-pallet-account')||!out.includes('String(rc1095LoadPalletCount(sh,rows(sh)))'))throw new Error(file+': RC1095 Palettenkonto-Druckpatch unvollständig');",
    "if(!out.includes('rc1095-pallet-account')||!out.includes('String(rc1095LoadPalletCount(sh,rows(sh)))')||!out.includes('palletBalanceCacheKey(sh)')||!out.includes('data-rc1543-pallet-balance'))throw new Error(file+': RC1543 Palettenkonto-Kontostand-Druckpatch unvollständig');",
    'RC1543 builder completeness guard'
  );
  write(path,source);
}

// 2) Historischer RC1095-Vertrag wird fachlich auf den aktuellen Kontostand angehoben.
{
  const path='test/rc1095-loading-list-pallet-account.test.mjs';
  write(path,`import test,{before} from 'node:test';
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
    assert.match(html,/function rc1095LoadPalletCount\\(sh,rs\\)/,file+': Palettenzähler fehlt');
    assert.match(html,/function rc1095LoadPalletHtml\\(sh,rs\\)/,file+': Palettenkonto-Renderer fehlt');
    assert.match(html,/rc1095-pallet-account/,file+': sichtbarer Palettenkonto-Hinweis fehlt');
    assert.match(html,/>Palettenkonto</,file+': Palettenkonto-Bezeichnung fehlt');
    assert.match(html,/Europaletten-Kontostand \\/ EUR pallet balance/,file+': bilingualer Kontostand fehlt');
    assert.match(html,/data-rc1543-pallet-balance/,file+': RC1543 Kontostandmarker fehlt');
    assert.match(html,/palletBalanceForShipment/,file+': Palettenkonto-Datenquelle fehlt');
    assert.doesNotMatch(html,/Ausgang: '\\+count\\+' Europalette/,file+': alter Sendungs-Ausgang wird noch als Kontostand ausgegeben');
    assert.match(html,/euro\\.\\*pal\\|eur\\.\\*pal/i,file+': nur Europaletten dürfen gezählt werden');
  }
});

test('RC1543: aktueller Palettenkontostand invalidiert den Ladelisten-Dokumentcache',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function documentCacheKey');
  const end=start<0?-1:html.indexOf('function ',start+'function documentCacheKey'.length);
  assert.ok(start>=0&&end>start,'documentCacheKey fehlt');
  const block=html.slice(start,end);
  assert.match(block,/String\\(rc1095LoadPalletCount\\(sh,rows\\(sh\\)\\)\\)/);
  assert.match(block,/palletBalanceCacheKey\\(sh\\)/,'Kontostand muss den Dokumentcache invalidieren');
});

test('RC1543: Release-Builder und Production-Liveprüfung prüfen den Kontostand statt Ausgang',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  const live=readLiveContract();
  assert.match(build,/patchLoadingListPalletAccount/);
  assert.match(build,/loadingListPalletAccount:\\{version:'RC1095'/);
  assert.match(live,/RC1543 Palettenkonto-Kontostand/);
  assert.match(live,/function rc1095LoadPalletHtml/);
  assert.match(live,/rc1095-pallet-account/);
  assert.match(live,/Palettenkonto/);
  assert.match(live,/Europaletten-Kontostand \\/ EUR pallet balance/);
  assert.match(live,/data-rc1543-pallet-balance/);
  assert.match(live,/palletBalanceCacheKey/);
});
`);
}

// 3) Echte Browserabnahme: deterministischer aktueller Saldo 7, Sendung selbst hat weiterhin 2 Paletten.
{
  const path='e2e/specs/print-documents.spec.mjs';
  let source=read(path);
  source=replaceOnce(
    source,
    "test('RC1275 P1: Europaletten erscheinen im echten Ladelisten-Druck als Palettenkonto-Ausgang',async({page,context},testInfo)=>{",
    "test('RC1543 P1: Europaletten erscheinen im echten Ladelisten-Druck als aktueller Palettenkonto-Kontostand',async({page,context},testInfo)=>{",
    'RC1543 browser test title'
  );
  const select="  await selectLoadingListShipment(page,'DEMO01',/DEMO01|Nord/i);\n  await expect(page.locator('#content')).toContainText(/DEMO01/,{timeout:10_000});";
  const selectWithBalance=select+"\n\n  await page.evaluate(()=>{\n    window.__RC1543_ORIGINAL_PALLET_LEDGER__=window.ExportHUBPalletLedger;\n    window.ExportHUBPalletLedger=Object.freeze({\n      balanceFor:key=>({key:String(key||''),type:'customer',name:'Nord',balance:7}),\n      accounts:()=>[]\n    });\n  });";
  source=replaceOnce(source,select,selectWithBalance,'RC1543 browser pallet ledger fixture');
  source=replaceOnce(
    source,
    "  expect(capture.text).toMatch(/Palettenkonto/i);\n  expect(capture.text).toMatch(/Ausgang:\\s*2\\s*Europaletten/i);\n  expect(capture.html).toMatch(/rc1095-pallet-account/i);\n  await assertRuntimeClean(guard,testInfo);",
    "  expect(capture.text).toMatch(/Palettenkonto/i);\n  expect(capture.text).toMatch(/Europaletten-Kontostand\\s*\\/\\s*EUR pallet balance/i);\n  expect(capture.text).toMatch(/Zu Gunsten Essentra:\\s*7\\s*Europaletten/i);\n  expect(capture.text).toMatch(/In favour of Essentra:\\s*7\\s*EUR pallets/i);\n  expect(capture.text).not.toMatch(/Ausgang:\\s*2\\s*Europaletten/i);\n  expect(capture.html).toMatch(/rc1095-pallet-account/i);\n  expect(capture.html).toMatch(/data-rc1543-pallet-balance/i);\n  await page.evaluate(()=>{\n    if(window.__RC1543_ORIGINAL_PALLET_LEDGER__)window.ExportHUBPalletLedger=window.__RC1543_ORIGINAL_PALLET_LEDGER__;\n    delete window.__RC1543_ORIGINAL_PALLET_LEDGER__;\n  });\n  await assertRuntimeClean(guard,testInfo);",
    'RC1543 browser pallet balance assertions'
  );
  write(path,source);
}

// 4) Node-Vertrag der Browserabnahme aktualisieren.
{
  const path='test/rc1190-print-browser-gate.test.mjs';
  let source=read(path);
  const start=source.indexOf("test('RC1275: Browserabnahme prüft Palettenkonto in echtem Ladelisten-Druck'");
  const end=start<0?-1:source.indexOf("\ntest('RC1340:",start);
  if(start<0||end<0)throw new Error('RC1543: RC1275 browser contract block missing');
  const replacement=`test('RC1543: Browserabnahme prüft aktuellen Palettenkonto-Kontostand in echtem Ladelisten-Druck',()=>{
  assert.match(spec,/RC1543 P1: Europaletten erscheinen im echten Ladelisten-Druck als aktueller Palettenkonto-Kontostand/);
  assert.match(spec,/DEMO01\\|Nord/);
  assert.match(spec,/Palettenkonto\\/i/);
  assert.match(spec,/Europaletten-Kontostand/);
  assert.match(spec,/Zu Gunsten Essentra/);
  assert.match(spec,/In favour of Essentra/);
  assert.match(spec,/not\\.toMatch\\(\\/Ausgang:/,'alter Ausgang muss im Browsertest ausdrücklich ausgeschlossen sein');
  assert.match(spec,/data-rc1543-pallet-balance\\/i/);
});

`;
  source=source.slice(0,start)+replacement+source.slice(end+1);
  write(path,source);
}

// 5) Production-Live-Vertrag prüft den neuen fachlichen Marker.
{
  const path='.github/rc1505/verify-production-live.mjs';
  let source=read(path);
  source=replaceOnce(source,'// RC1095 Palettenkonto bleibt Teil der Ladeliste.','// RC1543 Palettenkonto-Kontostand bleibt Teil der Ladeliste.','RC1543 live comment');
  source=replaceOnce(
    source,
    "markers(`RC1095 Palettenkonto ${label}`,body,['function rc1095LoadPalletHtml','rc1095-pallet-account','Palettenkonto','Ausgang:','rc1095LoadPalletCount(sh,rows(sh))']);",
    "markers(`RC1543 Palettenkonto-Kontostand ${label}`,body,['function rc1095LoadPalletHtml','rc1095-pallet-account','Palettenkonto','Europaletten-Kontostand / EUR pallet balance','data-rc1543-pallet-balance','palletBalanceCacheKey','rc1095LoadPalletCount(sh,rows(sh))']);",
    'RC1543 production-live markers'
  );
  write(path,source);
}

console.log('RC1543 loading-list pallet balance release contracts patched.');
