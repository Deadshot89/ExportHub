import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const startup=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');
const page=fs.readFileSync('migration-recovery.html','utf8');
const builder=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

function storage(row){
  const data=new Map(Object.entries(row||{}));
  return {
    get length(){return data.size},
    getItem(k){return data.has(k)?data.get(k):null},
    setItem(k,v){data.set(k,String(v))},
    key(i){return Array.from(data.keys())[i]||null}
  };
}
function loadApi(session){
  const window={
    sessionStorage:storage({'exporthub_rc301_tab_session':JSON.stringify(session||{})}),
    location:{hostname:'wonderful-forest-0f315e310.7.azurestaticapps.net',pathname:'/'},
    setTimeout(){return 1},clearTimeout(){},fetch:async()=>({ok:true,json:async()=>({stateDiagnostics:{inlinePayloadCount:158}})})
  };
  vm.runInNewContext(startup,{window,console,JSON,Date,encodeURIComponent,AbortController:undefined},{filename:'rc1067-startup-recovery.js'});
  return window.ExportHUBRC1067StartupRecovery;
}

test('RC1067: Start-Recovery erkennt nur wiederhergestellte globale Admin-Sitzungen',()=>{
  const admin=loadApi({token:'TOKEN',user:{name:'Tobias',role:'Globaler Administrator',globalAdmin:true}});
  assert.equal(admin.admin(admin.session()),true);
  const normal=loadApi({token:'TOKEN',user:{name:'User',role:'Benutzer'}});
  assert.equal(normal.admin(normal.session()),false);
});

test('RC1067: Recovery prüft ausschließlich den kleinen Health-Pfad bevor der große Team-State geladen werden muss',()=>{
  assert.match(startup,/\/api\/exporthub-state\?mode=health/);
  assert.match(startup,/inlinePayloadCount/);
  assert.match(startup,/migration-recovery\.html/);
  assert.match(startup,/5000/);
  assert.doesNotMatch(startup,/fetch\(['"]\/api\/exporthub-state['"]/);
});

test('RC1067: Recovery-Seite migriert automatisch weiterhin nur in sicheren 5er-Paketen',()=>{
  assert.match(page,/var KEY='exporthub_rc301_tab_session',BATCH=5/);
  assert.match(page,/\/api\/exporthub-document-migrate/);
  assert.match(page,/limit:BATCH/);
  assert.match(page,/run\(\);/);
  assert.match(page,/Nach aktuellem Paket stoppen/);
  assert.match(page,/Migration macht keinen Fortschritt/);
  assert.match(page,/location\.replace\('\/\?_rc1067='/);
});

test('RC1067: Recovery-Seite lädt nicht die normale 130-MB-Team-State-Antwort',()=>{
  const direct=[...page.matchAll(/\/api\/exporthub-state([^'"<]*)/g)].map(m=>m[0]);
  assert.ok(direct.length>=1);
  assert.ok(direct.every(x=>x.includes('mode=health')),direct.join(', '));
});

test('RC1067: finaler RC1048-Build liefert Recovery nur für Produktion und TESTSERVICE',()=>{
  assert.match(builder,/RC1067_STARTUP_TAG/);
  assert.match(builder,/rc1067-startup-recovery\.js\?v=1067/);
  assert.match(builder,/migration-recovery\.html/);
  assert.match(builder,/if\(file!==['"]demo\.html['"]\)/);
  assert.match(builder,/startupRecovery:/);
});
