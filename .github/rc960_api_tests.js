import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('api/shared/pickup-store.js','utf8');
const start=source.indexOf('function positiveColliCount(value){');
const end=source.indexOf('function signatureUrl',start);
assert.ok(start>=0&&end>start,'expectedCollis helper block not found');
const helperSource=source.slice(start,end);
const sandbox={};
vm.createContext(sandbox);
vm.runInContext(helperSource+'\nthis.expectedCollis=expectedCollis;',sandbox);
const expected=sandbox.expectedCollis;

assert.equal(expected({colliCount:2,rows:[{count:2},{count:3}]}),5,'legacy colliCount must not override complete row sum');
assert.equal(expected({expectedColliCount:7,rows:[{count:2},{count:3}]}),7,'trusted explicit aggregate must have highest precedence');
assert.equal(expected({colliCount:4}),4,'legacy colliCount must remain a last-resort fallback');
assert.equal(expected({enteredColliCount:9,shipment:{packages:[{qty:2},{qty:3}]}}),5,'nested physical row source must beat entered legacy value');
assert.equal(expected({rows:[{count:1.2},{count:2.1}]}),5,'physical partial values must round upward per row');
assert.equal(expected({totalColli:4.4}),4,'aggregate totals must use aggregate rounding');
console.log('RC960 pickup server behavior regression passed');
