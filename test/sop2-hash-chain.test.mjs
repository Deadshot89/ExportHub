import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {appendEvent, verifyChain} = require('../api/shared/hash-chain.js');
const AT = '2026-11-13T10:00:00.000Z';
function add(chain, n, data = {step:n}) {
  const event = appendEvent(chain, {actor:'SOP-Bearbeiter', action:'edit-'+n, at:AT, data});
  return [...chain, event];
}
function sample() {let chain = []; for (let n=1;n<=5;n++) chain=add(chain,n); return chain;}

test('5 SOP-Ereignisse sind verkettet, mit GENESIS und ohne Eingabemutation', () => {
  const chain = sample();
  assert.deepEqual(verifyChain(chain), {ok:true, brokenAt:0});
  assert.equal(chain[0].prevHash,'GENESIS');
  assert.equal(chain[4].prevHash,chain[3].hash);
  assert.match(chain[4].hash,/^[a-f0-9]{64}$/);
  const snapshot=structuredClone(chain);
  const sixth=appendEvent(chain,{actor:'Zweite Person',action:'review',at:AT});
  assert.equal(sixth.seq,6);
  assert.deepEqual(chain,snapshot);
});

test('geänderter Akteur am dritten Ereignis wird erkannt', () => {
  const chain=sample(); chain[2].actor='Manipuliert';
  assert.deepEqual(verifyChain(chain),{ok:false,brokenAt:3});
});

test('entferntes oder vertauschtes Ereignis wird erkannt', () => {
  const missing=sample(); missing.splice(1,1);
  assert.deepEqual(verifyChain(missing),{ok:false,brokenAt:2});
  const swapped=sample(); [swapped[1],swapped[2]]=[swapped[2],swapped[1]];
  assert.deepEqual(verifyChain(swapped),{ok:false,brokenAt:2});
});

test('Veränderungen an Daten und Hash werden erkannt', () => {
  const altered=sample(); altered[3].data.step=999;
  assert.deepEqual(verifyChain(altered),{ok:false,brokenAt:4});
  const tampered=sample();tampered[1].hash='0'.repeat(64);
  assert.deepEqual(verifyChain(tampered),{ok:false,brokenAt:2});
});

test('Hash hängt nicht von der Reihenfolge der JSON-Schlüssel ab', () => {
  const first=appendEvent([],{actor:'A',action:'save',at:AT,data:{z:{k:3,a:4},a:[{y:2,x:1}]}});
  const second=appendEvent([],{actor:'A',action:'save',at:AT,data:{a:[{x:1,y:2}],z:{a:4,k:3}}});
  assert.equal(first.hash,second.hash);
  assert.equal(verifyChain([first]).ok,true);
});

test('leere Kette ist gültig',()=>{
  assert.deepEqual(verifyChain([]),{ok:true,brokenAt:0});
});

test('kaputter Verlauf sperrt das Anhängen',()=>{
  const chain=sample();chain[0].action='falsified';
  assert.throws(()=>appendEvent(chain,{actor:'A',action:'save',at:AT}),error=>error.code==='SOP_CHAIN_INVALID');
});

test('ungültige und normalisierte Zeitangaben werden abgewiesen',()=>{
  for (const at of ['2026-02-30T10:00:00.000Z','2026-11-13T10:00:00Z','nonsense'])
    assert.throws(()=>appendEvent([],{actor:'A',action:'save',at}),/SOP_CHAIN_INVALID_TIMESTAMP/);
});

test('Zyklische, nicht serialisierbare und gefährliche Daten werden abgewiesen',()=>{
  const loop={}; loop.self=loop;
  const unsafe=JSON.parse('{"__proto__":{"admin":true}}');
  for(const data of [loop,{bad:undefined},{bad:()=>{}},new Date(),unsafe,[,1]])
    assert.throws(()=>appendEvent([],{actor:'A',action:'save',at:AT,data}));
});

test('Metadata- und Formatänderungen werden auch ohne Hashänderung erkannt',()=>{
  const chain=sample();chain[2].seq=99;
  assert.deepEqual(verifyChain(chain),{ok:false,brokenAt:3});
  const extra=sample();extra[0].hiddenField='not-signed';
  assert.deepEqual(verifyChain(extra),{ok:false,brokenAt:1});
  assert.deepEqual(verifyChain(null),{ok:false,brokenAt:0});
});
