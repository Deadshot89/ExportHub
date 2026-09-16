import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

function block(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Block fehlt: ${start}`);
  return source.slice(a,b);
}

test('RC1135: Health diagnostiziert große Felder nur aggregiert',()=>{
  assert.match(source,/function\s+collectionFieldSizeDiagnostics\s*\(state\)/);
  const helper=block('function collectionFieldSizeDiagnostics(state)','async function latestValidTeamFallback');
  for(const marker of ["'shipments'","'savedShipments'","'abdRequests'",'bytes','items']){
    assert.ok(helper.includes(marker),marker+' fehlt');
  }
  assert.doesNotMatch(helper,/customerName|reference|shipmentRef|fileName|documentName|email/i,'Diagnose darf keine fachlichen Inhalte ausgeben');
});

test('RC1135: Health liefert die neue Feldgrößen-Diagnose aus',()=>{
  assert.match(source,/collectionFieldBytes:collectionFieldSizeDiagnostics\(teamCheck\.value&&teamCheck\.value\.state\)/);
});
