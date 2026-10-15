import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/document-print-name.js','utf8');

function runtime({state,accounts}){
  const requested=[];
  const context={
    console,
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBPalletLedger:{
      balanceFor(key){requested.push(String(key));return accounts[String(key)]||null;},
      accounts(){return Object.values(accounts);}
    }
  };
  vm.runInNewContext(source,context,{filename:'assets/document-print-name.js'});
  return{api:context.ExportHUBDocumentPrintNames,requested};
}

test('RC1543: Ladeliste nutzt den aktuellen Palettenkontostand statt des Sendungs-Ausgangs',()=>{
  const h=runtime({
    state:{customers:[{id:'C1',name:'Kunde A'}]},
    accounts:{'customer:c1':{key:'customer:c1',type:'customer',name:'Kunde A',balance:7}}
  });
  assert.equal(typeof h.api.palletBalanceForShipment,'function');
  assert.equal(typeof h.api.palletBalanceText,'function');
  const account=h.api.palletBalanceForShipment({customerId:'C1',customerName:'Kunde A',palletOut:2,euroPallets:2});
  assert.equal(h.requested[0],'customer:c1');
  assert.equal(account.balance,7);
  const text=h.api.palletBalanceText(account);
  assert.equal(text,'Zu Gunsten Essentra: 7 Europaletten / In favour of Essentra: 7 EUR pallets');
  assert.doesNotMatch(text,/Ausgang:/i);
});

test('RC1543: negativer Kontostand nennt Kunde oder Spedition bilingual als Beguenstigten',()=>{
  const h=runtime({
    state:{customers:[{id:'C2',name:'Kunde B',carrier:'DHL Freight'}]},
    accounts:{'carrier:dhl freight':{key:'carrier:dhl freight',type:'carrier',name:'DHL Freight',balance:-4}}
  });
  const account=h.api.palletBalanceForShipment({customerId:'C2',customerName:'Kunde B',palletOut:9});
  assert.equal(h.requested[0],'carrier:dhl freight');
  assert.equal(h.api.palletBalanceText(account),'Zu Gunsten DHL Freight: 4 Europaletten / In favour of DHL Freight: 4 EUR pallets');
});

test('RC1543: ausgeglichenes Palettenkonto wird als Kontostand 0 und nicht als Bewegung gedruckt',()=>{
  const h=runtime({
    state:{customers:[{id:'C3',name:'Kunde C'}]},
    accounts:{'customer:c3':{key:'customer:c3',type:'customer',name:'Kunde C',balance:0}}
  });
  const account=h.api.palletBalanceForShipment({customerId:'C3',customerName:'Kunde C',palletOut:5});
  assert.equal(h.api.palletBalanceText(account),'Ausgeglichen: 0 Europaletten / Balanced: 0 EUR pallets');
});
