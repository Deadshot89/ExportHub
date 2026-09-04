// RC998 GREEN verification trigger after patched source commit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];

function owner(text,start,end){
  const a=text.indexOf(start);
  assert.notEqual(a,-1,`${start} fehlt`);
  const b=text.indexOf(end,a+start.length);
  assert.notEqual(b,-1,`${end} fehlt`);
  return text.slice(a,b);
}

for(const file of FILES){
  test(`${file}: RC998 Build- und Release-Metadaten sind synchron`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/var BUILD=Object\.freeze\(\{version:'RC998',cache:'998',loginReturn:'[^']*v=998[^']*'\}\);/);
    const release=owner(html,'var RELEASE=Object.freeze({','changes:Object.freeze([');
    assert.match(release,/version:'RC998'/);
    assert.match(release,/date:'04\.09\.2026'/);
  });

  test(`${file}: Testservice-Start ist begrenzt und behält genau einen Retry`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'async function loadStateAfterLogin(){','async function finishAuthenticatedLogin(){');
    assert.match(block,/loadState\(\{timeoutMs:6000,maxAttempts:1\}\)/);
    assert.match(block,/loadState\(\{timeoutMs:9000,maxAttempts:1\}\)/);
    assert.match(block,/native\.setTimeout\(resolve,450\)/);
    assert.doesNotMatch(block,/timeoutMs:14000/);
    assert.doesNotMatch(block,/timeoutMs:24000/);
    const testserviceReads=[...block.matchAll(/loadState\(\{timeoutMs:(?:6000|9000),maxAttempts:1\}\)/g)];
    assert.equal(testserviceReads.length,2,'Testservice muss bei genau zwei kontrollierten Reads bleiben');
  });

  test(`${file}: Sendung erstellen wird nicht aus altem DOM-Cache wiederhergestellt`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const block=owner(html,'function fastCacheable(view){','function fastShipmentKey(){');
    assert.doesNotMatch(block,/view==='shipment'/);
    assert.match(block,/view==='shipmentoverview'/);
    assert.match(block,/view==='cmr'/);
  });
}
