import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const API='api';

function read(file){return fs.readFileSync(file,'utf8')}
function functionNames(){
  return fs.readdirSync(API,{withFileTypes:true})
    .filter(entry=>entry.isDirectory()&&fs.existsSync(path.join(API,entry.name,'function.json')))
    .map(entry=>entry.name).sort();
}

const policy={
  internal:{
    'diagnostic-autofix':[/validateGlobalAdmin\(/,/callbackAuthorized\(/],
    'exporthub-document':[/validateSession\(/],
    'exporthub-document-migrate':[/validateSession\(/],
    'exporthub-release':[/validateSession\(/],
    'exporthub-state':[/validateSession\(/],
    'fixed-pickups':[/validateSession\(/],
    'loader-pins-admin':[/validateGlobalAdmin\(/],
    'pickup-init':[/validateSession\(/],
    'pickup-disable':[/validateSession\(/],
    'reference-files':[/validateSession\(/]
  },
  tokenProtected:{
    'pickup-confirm':[/pickup-confirm-v2/],
    'pickup-confirm-v2':[/public-access-store/,/access\.resolve\(/],
    'pickup-status':[/public-access-store/,/access\.resolve\(/],
    'pickup-pod':[/public-access-store/,/access\.resolve\(/],
    'pod-backup':[/public-access-store/,/\.resolve\(req,\s*['"]pickup['"]/]
  },
  mixed:{
    'customer-avis':[/public-access-store/,/validateSession\(/],
    'exporthub-auth':[/action\s*===\s*['"]login['"]/,/validateSession\(/],
    'location-booking':[/validateSession\(/,/validToken\(/,/loader\(/]
  },
  publicReadOnly:{
    'exporthub-auth-probe':[/runtimeReady/],
    'exporthub-health':[/service:\s*['"]exporthub['"]/],
    'pickup-health':[/service:\s*['"]pickup['"]/],
    'production-version-check':[/production-root/]
  }
};

test('RC1115: jede Azure HTTP-Funktion ist explizit sicherheitsklassifiziert',()=>{
  const actual=functionNames();
  const classified=Object.values(policy).flatMap(group=>Object.keys(group)).sort();
  assert.deepEqual(classified,actual,'Neue API-Funktionen müssen vor Merge einer Auth-Klasse zugeordnet werden.');
});

test('RC1115: interne APIs enthalten ihre serverseitigen Auth-Gates',()=>{
  for(const [name,markers] of Object.entries(policy.internal)){
    const source=read(path.join(API,name,'index.js'));
    for(const marker of markers)assert.match(source,marker,name+' benötigt Auth-Gate '+marker);
  }
});

test('RC1115: öffentliche Geschäfts-APIs verwenden nicht erratbare Zugriffstokens',()=>{
  for(const [name,markers] of Object.entries(policy.tokenProtected)){
    const source=read(path.join(API,name,'index.js'));
    for(const marker of markers)assert.match(source,marker,name+' benötigt Public-Access-Schutz '+marker);
  }
});

test('RC1115: gemischte APIs enthalten sowohl internen als auch externen Schutz',()=>{
  for(const [name,markers] of Object.entries(policy.mixed)){
    const source=read(path.join(API,name,'index.js'));
    for(const marker of markers)assert.match(source,marker,name+' benötigt Schutzmarker '+marker);
  }
});

test('RC1115: zentrale Session-Policy ist systemweit verdrahtet',()=>{
  const auth=read('api/shared/auth-store.js');
  assert.match(auth,/SESSION_MAX_HOURS/);
  assert.match(auth,/SESSION_IDLE_MINUTES/);
  assert.match(auth,/SESSION_TOUCH_MINUTES/);
  assert.match(auth,/function sessionIsActive\(/);
  assert.match(auth,/function touchSessionActivity\(/);
  assert.doesNotMatch(auth,/EXPORTHUB_SESSION_DAYS/);

  for(const file of [
    'api/shared/fast-auth-store.js',
    'api/exporthub-state/index.js',
    'api/diagnostic-autofix/index.js',
    'api/loader-pins-admin/index.js',
    'api/reference-files/index.js'
  ]){
    const source=read(file);
    assert.match(source,/sessionIsActive/,file+' muss zentrale Timeout-Policy nutzen');
    assert.match(source,/touchSessionActivity/,file+' muss Aktivität zentral nachführen');
  }
});

test('RC1115: Beispielkonfiguration dokumentiert sichere Sitzungsgrenzen',()=>{
  const cfg=JSON.parse(read('api/local.settings.example.json')).Values||{};
  assert.equal(cfg.EXPORTHUB_SESSION_MAX_HOURS,'12');
  assert.equal(cfg.EXPORTHUB_SESSION_IDLE_MINUTES,'30');
  assert.equal(cfg.EXPORTHUB_SESSION_TOUCH_MINUTES,'5');
  assert.equal(Object.prototype.hasOwnProperty.call(cfg,'EXPORTHUB_SESSION_DAYS'),false);
});
