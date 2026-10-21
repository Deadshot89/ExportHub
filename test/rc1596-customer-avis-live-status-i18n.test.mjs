import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('customer-avis.html','utf8');
const langs=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(langs.map(lang=>[lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))]));
const keys=['uploadSaved','uploadConfirmed','uploadScanning','uploadPdfOnly','uploadTooLarge','uploadInvalidMime','uploadSending','uploadAlreadySaved','uploadPending','slotRemaining','slotSelected','currentStatus','shipmentReference','licensePlate','reportedOn'];
const namespace='customerAvis.dynamic.';

function params(s){
  return [...s.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(m=>m[1]).sort();
}

test('RC1596: 15 dynamic customer Avis messages have complete and compatible translations in six languages',()=>{
  assert.deepEqual(Object.keys(packs.de).filter(k=>k.startsWith(namespace)).sort(),keys.map(k=>namespace+k).sort());
  for(const name of keys){
    const key=namespace+name,de=packs.de[key];
    assert.ok(typeof de==='string'&&de.trim(),key);
    assert.ok(source.includes("avTr('"+name+"'"),'call site absent: '+name);
    for(const lang of langs){
      const translated=packs[lang][key];
      assert.ok(typeof translated==='string'&&translated.trim(),lang+' missing '+name);
      assert.deepEqual(params(translated),params(de),lang+' placeholder mismatch '+name);
      if(lang!=='de')assert.notEqual(translated,de,lang+' still German '+name);
    }
  }
});

test('RC1596: dynamic helper substitutes values with and without connected translation runtime',()=>{
  const start=source.indexOf('function avTr('),end=source.indexOf('function esc(',start);
  assert.ok(start>=0&&end>start,'helper is isolated immediately after q');
  const sandbox={window:{}};
  vm.runInNewContext(source.slice(start,end)+'\nthis.translate=avTr;',sandbox);
  const fileName='<img src=x onerror=alert(1)>.pdf';
  assert.equal(sandbox.translate('uploadSaved',packs.de['customerAvis.dynamic.uploadSaved'],{name:fileName}),
    'Viren- und Fachprüfung bestanden · PDF gespeichert: '+fileName);
  sandbox.window.ExportHUBI18n={t(key,vars){return packs.en[key].replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,k)=>String(vars[k]))}};
  const english=sandbox.translate('uploadSaved',packs.de['customerAvis.dynamic.uploadSaved'],{name:fileName});
  assert.equal(english,'Virus and document check passed · PDF saved: '+fileName);
  assert.equal(sandbox.translate('slotRemaining',packs.de['customerAvis.dynamic.slotRemaining'],{remaining:2}),'2 of 3 slots still available');
  sandbox.window.ExportHUBI18n={t(key){return key}};
  assert.equal(sandbox.translate('slotSelected',packs.de['customerAvis.dynamic.slotSelected'],{from:'10:00',to:'12:00'}),'Zeitfenster 10:00–12:00 ausgewählt.');
});

test('RC1596: untrusted live slot values are still HTML-escaped and upload statuses remain safely rendered',()=>{
  assert.match(source,/esc\(avTr\('slotRemaining'/);
  assert.match(source,/function setStatus\(text,kind\)[^\n]*\.textContent=text/);
  assert.match(source,/function uploadStatusText\(text,kind\)[^\n]*esc\(text\)/);
  assert.match(source,/api\('',\{method:'POST',[^\n]*action:'upload-document'/);
  assert.match(source,/action:'document-upload-status'/);
  assert.match(source,/action:'availability'/);
  assert.match(source,/action:'appointment'/);
  const inline=source.slice(source.lastIndexOf('<script>')+8,source.lastIndexOf('</script>'));
  assert.doesNotThrow(()=>new vm.Script(inline),'customer Avis main script must parse after localization');
});
