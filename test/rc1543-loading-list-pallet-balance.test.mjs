import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/document-print-name.js','utf8');
const loadingListSearchSource=fs.readFileSync('assets/rc1283-loading-list-search.js','utf8');
const buildSource=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function memoryStorage(){
  const values=new Map();
  return{
    getItem(key){return values.has(String(key))?values.get(String(key)):null;},
    setItem(key,value){values.set(String(key),String(value));},
    removeItem(key){values.delete(String(key));}
  };
}

function runtime({state,accounts={},storage=memoryStorage(),withLedger=true}){
  const requested=[];
  const context={
    console,
    sessionStorage:storage,
    __EXPORTHUB_GET_STATE__:()=>state
  };
  if(withLedger){
    context.ExportHUBPalletLedger={
      balanceFor(key){requested.push(String(key));return accounts[String(key)]||null;},
      accounts(){return Object.values(accounts);}
    };
  }
  vm.runInNewContext(source,context,{filename:'assets/document-print-name.js'});
  return{api:context.ExportHUBDocumentPrintNames,requested,storage};
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

test('RC1543: Palettenkontostand wird vor dem Kontextwechsel als kurzlebiger Drucksnapshot uebergeben',()=>{
  const storage=memoryStorage();
  const shipment={id:'SHIP-C4',customerId:'C4',customerName:'Kunde D',palletOut:3};
  const parent=runtime({
    state:{customers:[{id:'C4',name:'Kunde D'}]},
    accounts:{'customer:c4':{key:'customer:c4',type:'customer',name:'Kunde D',balance:7}},
    storage
  });
  const prepared=parent.api.preparePalletBalanceSnapshot(shipment);
  assert.equal(prepared.balance,7);
  assert.match(storage.getItem('exporthub:rc1543:pallet-print-snapshot:v1')||'',/"balance":7/);

  const isolatedPrintContext=runtime({state:{},storage,withLedger:false});
  const restored=isolatedPrintContext.api.palletBalanceForShipment(shipment);
  assert.equal(restored.balance,7);
  assert.equal(isolatedPrintContext.api.palletBalanceText(restored),'Zu Gunsten Essentra: 7 Europaletten / In favour of Essentra: 7 EUR pallets');
});

test('RC1543: konkrete Ladelistenauswahl sichert den Kontostand im Hauptkontext vor Druck und Download',()=>{
  assert.match(loadingListSearchSource,/function\s+preparePalletPrintSnapshot\(sh\)/,'Ladelisten-Suche braucht einen expliziten Übergabepunkt');
  assert.match(loadingListSearchSource,/rc1285CaptureSelection[\s\S]*preparePalletPrintSnapshot\(row\.shipment\)/,'Auswahl muss den Snapshot direkt mit der konkreten Sendung erzeugen');
  assert.match(loadingListSearchSource,/function\s+act\(kind,panel,select\)[\s\S]*preparePalletPrintSnapshot\(row\.shipment\)/,'Aktion muss den Snapshot unmittelbar vor Öffnen, Druck oder Download auffrischen');
});

test('RC1543: Drei-Umgebungen-Build lädt den Print-Helper vor der Ladelistensuche',()=>{
  const helperTag='document-print-name.js?v=1543';
  const searchTag='rc1283-loading-list-search.js?v=1305';
  assert.match(buildSource,/exporthub-document-print-name/,'Drei-Umgebungen-Build muss den gemeinsamen Print-Helper als Runtime einbinden');
  assert.match(buildSource,/document-print-name\.js\?v=1543/,'RC1543 braucht einen eigenen Cache-Key für den Print-Helper');
  const helperAt=buildSource.indexOf(helperTag);
  const searchAt=buildSource.indexOf(searchTag);
  assert.ok(helperAt>=0&&searchAt>=0&&helperAt<searchAt,'Print-Helper muss vor der Ladelistensuche geladen werden');
});

test('RC1543: Palettenkontostand wird auch vor der Abholung unabhängig vom Pickup-Summary ersetzt',()=>{
  assert.doesNotMatch(source,/if\(!summary\)return html/,'Palettenkontostand darf nicht vom Pickup-Summary abhängen');
  assert.match(source,/querySelectorAll\('\.rc390-load,\.rc352-load'\)/,'alle Ladelisten müssen den Kontostand erhalten');
  assert.match(source,/roots\.forEach\(function\(root\)/,'Kontostand muss je Ladeliste ersetzt werden');
});