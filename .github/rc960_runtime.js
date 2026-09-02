import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync('pickup.html','utf8');
const start=source.indexOf('function pickupExpectedCollis(data){');
const end=source.indexOf('function resetColliCheck',start);
assert.ok(start>=0&&end>start,'pickupExpectedCollis function not found');
const fnSource=source.slice(start,end);

const sandbox={
  q(value){return String(value==null?'':value).trim()},
  valueDeep(data,names){
    for(const name of names){
      if(data&&Object.prototype.hasOwnProperty.call(data,name))return data[name];
    }
    return '';
  },
  pickupColliNumber(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?Math.max(0,Math.round(n)):0;
  }
};
vm.createContext(sandbox);
vm.runInContext(fnSource+'\nthis.pickupExpectedCollis=pickupExpectedCollis;',sandbox);
const expected=sandbox.pickupExpectedCollis;

assert.equal(expected({colliCount:2,rows:[{count:2},{count:3}]}),5,'row-level/legacy colliCount must not override full row total');
assert.equal(expected({expectedColliCount:7,rows:[{count:2},{count:3}]}),7,'trusted explicit aggregate must override row total');
assert.equal(expected({colliCount:4}),4,'legacy colliCount must remain available when no better source exists');
assert.equal(expected({colliCount:1,shipment:{rows:[{qty:2},{quantity:4}]}}),6,'nested row lists must be summed before legacy fallback');
console.log('RC960 pickup client runtime regression passed');
