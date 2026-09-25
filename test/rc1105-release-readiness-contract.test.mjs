import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

test('RC1105: History-Releasevertrag deckt automatische Mail-, Druck-, Avis-, Abhol- und POD-Aktionen ab',()=>{
  for(const marker of ['mail-sent-open|',"type:'print'","type:'avis'","type:'pickup'","type:'pod'","shipmentHistory.action.abdRequestCreated","shipmentHistory.action.registrationStarted"]){
    assert.ok(history.includes(marker),marker+' fehlt');
  }
});
