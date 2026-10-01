import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminder=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

test('RC1374: beide AVIS-Backends sind syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','api/customer-avis/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/avis-reminder-mail/index.js'],{stdio:'pipe'});
});

test('RC1374: AVIS-Ausstellung wird serverseitig durch die Kundenpräferenz geschützt',()=>{
  assert.match(api,/function customerAvisAllowed\(state,sh\)/);
  assert.match(api,/action==='issue'&&!customerAvisAllowed\(state,target\)/);
  assert.match(api,/AVIS_CUSTOMER_DISABLED/);
  const guard=api.indexOf("if(action==='issue'&&!customerAvisAllowed(state,target))");
  const issue=api.indexOf("access.issue(req,'avis'");
  assert.ok(guard>=0&&issue>guard,'Kundenpräferenz muss vor Token-Ausstellung geprüft werden');
  assert.match(api,/const fields=\['customerName','customerId','customerNumber'/);
});

test('RC1374: bereits ausgegebene Links und Sessions werden bei Kunden-Nein serverseitig gesperrt',()=>{
  const guards=api.match(/if\(!customerAvisAllowed\(state,sh\)\)throw error\('AVIS_CUSTOMER_DISABLED'/g)||[];
  assert.ok(guards.length>=2,'Authorize und bestehende AVIS-Session müssen beide geschützt sein');
  const authorize=api.indexOf("action==='authorize'");
  const firstGuard=api.indexOf("if(!customerAvisAllowed(state,sh))",authorize);
  const sessionResolve=api.indexOf("access.resolveSession(session,'avis')");
  const sessionGuard=api.indexOf("if(!customerAvisAllowed(state,sh))",sessionResolve);
  assert.ok(firstGuard>authorize,'Authorize-Pfad ohne Kundenpräferenz-Sperre');
  assert.ok(sessionGuard>sessionResolve,'Session-Pfad ohne Kundenpräferenz-Sperre');
});

test('RC1374: Reminder-Mail besitzt denselben serverseitigen Schutz',()=>{
  assert.match(reminder,/function customerAvisAllowed\(team,sh\)/);
  assert.match(reminder,/if\(!customerAvisAllowed\(current\.team,shipment\)\)throw auth\.error\('AVIS_CUSTOMER_DISABLED'/);
});
