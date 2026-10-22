import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('migration-recovery.html','utf8');
const names=['sessionMissing','noDocuments','runningStatus','stoppedWithRemaining',
 'progressDetail','failedDocument','stalled','completedNew','alreadyComplete',
 'errorState','stopRequested'];
const langs=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(langs.map(lang=>[lang,JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'))]));

test('RC1594: every dynamic migration state has six validated translations',()=>{
 for(const name of names){
  const key='migrationRecovery.'+name;
  assert.ok(source.includes("tr('"+key+"'"),'migration code must use translation '+key);
  const german=packs.de[key];
  assert.ok(german,'missing source '+key);
  const placeholders=[...german.matchAll(/\{\{([\w.-]+)\}\}/g)].map(match=>match[1]).sort();
  for(const lang of langs){
   const translated=packs[lang][key];
   assert.ok(typeof translated==='string'&&translated.trim(),lang+' '+key);
   assert.deepEqual([...translated.matchAll(/\{\{([\w.-]+)\}\}/g)].map(match=>match[1]).sort(),placeholders,lang+' variable mismatch '+key);
   if(lang!=='de')assert.notEqual(translated,german,lang+' '+key+' is not translated');
  }
 }
});

test('RC1594: fallback works without i18n network and runtime interpolates safe values',()=>{
 const start=source.indexOf('function tr('),end=source.indexOf('function session()',start);
 assert.ok(start>=0&&end>start,'translation fallback helper not found');
 const sandbox={window:{}};vm.runInNewContext(source.slice(start,end)+'globalThis.fn=tr;',sandbox);
 const fallback=sandbox.fn('migrationRecovery.progressDetail',packs.de['migrationRecovery.progressDetail'],{batch:3,done:12,migrated:6,remaining:9});
 assert.equal(fallback,'Paket 3 abgeschlossen · 12 erledigt · 6 in diesem Lauf neu migriert · 9 verbleiben.');
 sandbox.window.ExportHUBI18n={t(key,vars){return packs.en[key].replace(/\{\{([\w.-]+)\}\}/g,(_,name)=>String(vars[name]))}};
 const translated=sandbox.fn('migrationRecovery.progressDetail',packs.de['migrationRecovery.progressDetail'],{batch:3,done:12,migrated:6,remaining:9});
 assert.match(translated,/Batch 3 complete/);
 assert.match(translated,/9 remaining/);
 assert.ok(!translated.includes('{{'));
});
