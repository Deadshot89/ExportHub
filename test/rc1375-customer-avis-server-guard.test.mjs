import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const api=fs.readFileSync('api/customer-avis/index.js','utf8');
const reminder=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

test('RC1375: beide AVIS-Backends bleiben syntaktisch gueltig',()=>{
  execFileSync(process.execPath,['--check','api/customer-avis/index.js'],{stdio:'pipe'});
  execFileSync(process.execPath,['--check','api/avis-reminder-mail/index.js'],{stdio:'pipe'});
});

test('RC1375: AVIS-Ausstellung wird serverseitig durch Kundenpraeferenz geschuetzt',()=>{
  assert.match(api,/function customerAvisAllowed\(state,sh\)/);
  assert.match(api,/AVIS_CUSTOMER_DISABLED/);
  const disable=api.indexOf("if(action==='disable')");
  const guard=api.indexOf("if(!customerAvisAllowed(state,target))");
  const issue=api.indexOf("access.issue(req,'avis'",guard);
  assert.ok(disable>=0&&guard>disable,'Deaktivieren muss weiterhin erlaubt bleiben');
  assert.ok(issue>guard,'Kundensperre muss vor Token-Ausstellung greifen');
  assert.match(api,/const fields=\['customerName','customerId','customerNumber'/);
});

test('RC1375: bereits ausgegebene Links und Sessions werden bei Kunden-Nein gesperrt',()=>{
  const authorize=api.indexOf("action==='authorize'");
  const authorizeGuard=api.indexOf("if(!customerAvisAllowed(state,sh))",authorize);
  const sessionResolve=api.indexOf("access.resolveSession(session,'avis')");
  const sessionGuard=api.indexOf("if(!customerAvisAllowed(state,sh))",sessionResolve);
  assert.ok(authorize>=0&&authorizeGuard>authorize,'Authorize-Pfad ohne Kundenpraeferenz-Sperre');
  assert.ok(sessionResolve>=0&&sessionGuard>sessionResolve,'Session-Pfad ohne Kundenpraeferenz-Sperre');
});

test('RC1375: explizites Kunden-Ja kann Legacy-Nein ueberschreiben',()=>{
  const block=api.slice(api.indexOf('function customerAvisAllowed(state,sh)'),api.indexOf('function safeDraftText'));
  const explicit=block.indexOf('if(Object.prototype.hasOwnProperty.call(c,key))');
  const legacy=block.indexOf("ids.includes('3019100629')");
  assert.ok(explicit>=0&&legacy>explicit,'Explizite Kundenpraeferenz muss vor Legacy-Ausnahmen ausgewertet werden');
});

test('RC1375: Reminder-Mail wird vor URL und Graph-Versand blockiert',()=>{
  assert.match(reminder,/function customerAvisAllowed\(team,sh\)/);
  const customerCheck=reminder.indexOf("if(!customerAvisAllowed(current.team,shipment))");
  const urlCheck=reminder.indexOf("const url=safeAvisUrl");
  const sendCheck=reminder.indexOf("graphMail.sendTextMail");
  assert.ok(customerCheck>=0&&urlCheck>customerCheck,'Kundensperre muss vor AVIS-URL-Verarbeitung greifen');
  assert.ok(sendCheck>customerCheck,'Kundensperre muss vor Graph-Versand greifen');
});
