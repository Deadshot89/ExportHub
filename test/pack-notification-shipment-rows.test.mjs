import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadBridge(){
  const root={addEventListener(){}};
  vm.runInContext(fs.readFileSync('assets/pack-notification-shipment.js','utf8'),vm.createContext({window:root,globalThis:root,console,Date}),{filename:'pack-notification-shipment.js'});
  return root.ExportHUBPackShipment;
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('identical packages become one shipment row with the full weight',()=>{
  const bridge=loadBridge();
  const prefill=bridge.shipmentPrefill({id:'pn-1',packageType:'Europalette',packageCount:3,totalWeight:900,packages:[1,2,3].map(n=>({packageNo:n,length:120,width:80,height:100}))});
  assert.deepEqual(plain(bridge.shipmentRows(prefill)),[{type:'Europalette',count:3,l:120,w:80,h:100,weight:900}]);
});

test('mixed packages keep their own packaging, dimensions and a weight share',()=>{
  const bridge=loadBridge();
  const prefill=bridge.shipmentPrefill({id:'pn-2',packageType:'Europalette',packageCount:3,totalWeight:100,packages:[
    {packageNo:1,length:120,width:80,height:150,packagingType:'Europalette'},
    {packageNo:2,length:120,width:80,height:150,packagingType:'Europalette'},
    {packageNo:3,length:60,width:40,height:40,packagingType:'Karton'}
  ]});
  const rows=plain(bridge.shipmentRows(prefill));
  assert.deepEqual(rows.map(r=>[r.type,r.count,r.l,r.w,r.h]),[['Europalette',2,120,80,150],['Karton',1,60,40,40]]);
  assert.equal(rows[0].weight,66.7);
  assert.equal(rows[1].weight,33.3,'last row takes the remainder so the total stays exact');
  assert.equal(Math.round(rows.reduce((s,r)=>s+r.weight,0)*10)/10,100);
});

test('different heights split into separate rows',()=>{
  const bridge=loadBridge();
  const prefill=bridge.shipmentPrefill({id:'pn-3',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[{packageNo:1,length:120,width:80,height:145},{packageNo:2,length:120,width:80,height:130}]});
  const rows=plain(bridge.shipmentRows(prefill));
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.h),[145,130]);
  assert.deepEqual(rows.map(r=>r.weight),[340,340]);
});

test('form prefill fills one row per group and adds missing rows through the shipment API',()=>{
  const source=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  assert.match(source,/applyRowsToMountedForm\(doc,shipmentRows\(prefill\)\)/);
  assert.match(source,/api\.addRow\(\)/);
  assert.match(source,/api\.updateRow\(index,'type'/);
  assert.match(source,/api\.updateRow\(index,'weight'/,'weight field is readonly, so the total must go through the shipment API');
});


test('RC1678: a rerender that clears only dimensions or weight cannot pass the Pack row guard',()=>{
  const original=fs.readFileSync('assets/pack-notification-shipment.js','utf8');
  const source=original.replace('  root.ExportHUBPackShipment=Object.freeze(','  root.__RC1678_ROWS_MATCH__=rowsMatch; root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(source,original,'expose the existing private production function only inside the test VM');
  const root={addEventListener(){}};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date}));
  const values={type:'Euro Palette',count:'2',l:'120',w:'80',h:'145',weight:'680'};
  const doc={querySelectorAll(selector){
    assert.equal(selector,'#rc573ColliCard .rc363-owned-row');
    return [{querySelector(selector){
      const field=selector.match(/field="([^"]+)"/)?.[1];
      return field==='type'?{value:values.type}:{value:values[field]};
    }}];
  }};
  const plan=[{type:'Europalette',count:2,l:120,w:80,h:145,weight:680}];
  assert.equal(root.__RC1678_ROWS_MATCH__(doc,plan),true,'complete pack rows match');
  for(const field of ['l','w','h','weight']){
    const prior=values[field];values[field]='';
    assert.equal(root.__RC1678_ROWS_MATCH__(doc,plan),false,'missing '+field+' must be repaired');
    values[field]=prior;
  }
  values.weight='670';
  assert.equal(root.__RC1678_ROWS_MATCH__(doc,plan),false,'changed weight must not pass as completed Pack prefill');
  values.weight='680,0';
  assert.equal(root.__RC1678_ROWS_MATCH__(doc,plan),true,'German numeric formatting preserves identical values');
});
