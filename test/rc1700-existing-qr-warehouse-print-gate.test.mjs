import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const build=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
const canonical=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

function gate(name){
  const value=build.match(new RegExp('const '+name+'="([^"\\n]*)";'));
  assert.ok(value,'RC1700 release builder must retain '+name);
  return value[1];
}
const original=gate('oldGate');
const replacement=gate('newGate');
function execute(sh,warehouse,message=()=>{}){
  const run=new AsyncFunction('warehouse','sh','status','q','timed','message','console',replacement+';return true');
  return run(warehouse,sh,s=>s.status||'Bereit',v=>String(v??''),value=>Promise.resolve(value),message,{warn(){}});
}

test('RC1700: QR registration fallback applies exactly once and leaves core document validation intact',()=>{
  assert.equal(canonical.split(original).length-1,1);
  assert.match(build,/html=patchRc1700PreviouslyRegisteredQrPrintGate\(html,file\)/);
  assert.match(replacement,/pickupQrRegistered===true/);
  assert.match(replacement,/\^\[a-f0-9\]\{48\}\$/);
  assert.match(replacement,/if\(locationReady!==true\)throw new Error/);
  assert.match(canonical,/requireDocumentCore\(sh,'output'\)/);
});

test('RC1700: already-registered pickup QR can print without waiting for broken warehouse API',async()=>{
  let invoked=false;
  const never=new Promise(()=>{});
  const warehouse={register(){invoked=true;return never}};
  const sh={status:'Bereit zur Abholung',pickupQrRegistered:true,pickupToken:'a'.repeat(48)};
  const ok=await execute(sh,warehouse);
  assert.equal(ok,true);
  await Promise.resolve();
  assert.equal(invoked,true);
});

test('RC1700: new shipment without server-confirmed QR must still reject failed warehouse registration',async()=>{
  const warehouse={register:async()=>false};
  const sh={status:'Erstellt',pickupQrRegistered:false,pickupToken:'b'.repeat(48)};
  await assert.rejects(()=>execute(sh,warehouse),/QR-Location konnte nicht serverseitig registriert werden/);
});

test('RC1700: invalid token is not sufficient to bypass strict warehouse registration',async()=>{
  const warehouse={register:async()=>false};
  const sh={status:'Bereit',pickupQrRegistered:true,pickupToken:'broken-token'};
  await assert.rejects(()=>execute(sh,warehouse),/QR-Location konnte nicht serverseitig registriert werden/);
});

test('RC1700: previously registered QR still tries warehouse sync and surfaces a nonblocking warning',async()=>{
  let resolve;const request=new Promise(r=>{resolve=r});
  const notices=[];
  const sh={status:'Bereit',pickupQrRegistered:true,pickupToken:'c'.repeat(48)};
  await execute(sh,{register:()=>request},(message,kind)=>notices.push({message,kind}));
  resolve(false);
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(notices.length,1);
  assert.match(notices[0].message,/Lager-Location konnte nicht synchronisiert werden/);
});
