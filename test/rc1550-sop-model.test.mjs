import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1007-sop-model.js');
const model=globalThis.ExportHubIsoSopModel;

function released(number,extra={}){
  return {
    number,
    title:extra.title||number,
    version:extra.version||'1.0',
    currentVersion:extra.currentVersion||extra.version||'1.0',
    status:'Freigegeben',
    sections:{steps:[]},
    versions:[{version:extra.version||'1.0',status:'Freigegeben',title:extra.title||number,content:{steps:[]},visuals:[]}],
    auditTrail:[],
    ...extra
  };
}

test('RC1550: reconcileCatalog folgt exakt dem kanonischen Katalog statt SOP-EH-Muster',()=>{
  const bsh=released('SOP-CUST-BSH-001',{title:'Transportanmeldung BSH-Gruppe',type:'customer',category:'customer',group:'BSH-Gruppe',customerIds:['BSH','NEFF','GAGGENAU']});
  const legacy=released('SOP-EH-060',{title:'ABD alt'});
  const result=model.reconcileCatalog([legacy],[bsh]);
  assert.deepEqual(result.map(doc=>doc.number),['SOP-CUST-BSH-001']);
});

test('RC1550: passende gespeicherte Fassung bleibt erhalten, wenn sie neuer als die kanonische Fassung ist',()=>{
  const canonical=released('SOP-CUST-BSH-001',{version:'1.0',title:'BSH canonical'});
  const stored=released('SOP-CUST-BSH-001',{version:'1.1',currentVersion:'1.1',title:'BSH lokal',versions:[
    {version:'1.0',status:'Archiviert',title:'BSH canonical',content:{steps:[]},visuals:[]},
    {version:'1.1',status:'Freigegeben',title:'BSH lokal',content:{steps:[{id:'bsh-local',text:'Lokale Fassung'}]},visuals:[]}
  ],auditTrail:[{action:'Freigegeben',version:'1.1',actor:'Admin',at:'2026-10-16T10:00:00Z',reason:'Aktualisiert'}]});
  const [result]=model.reconcileCatalog([stored],[canonical]);
  assert.equal(result.currentVersion,'1.1');
  assert.equal(result.version,'1.1');
  assert.ok(result.versions.some(item=>item.version==='1.1'));
  assert.equal(result.auditTrail[0].version,'1.1');
});

test('RC1550: nur Kunden-Overlays mit weiterhin aktiver Basis-SOP überleben die Bereinigung',()=>{
  const canonical=released('SOP-PROC-PACK-001',{type:'process'});
  const validOverlay=released('SOP-CUST-C1-PACK',{type:'customer',baseSopNumber:'SOP-PROC-PACK-001',customerId:'C1'});
  const validLegacyAlias=released('SOP-CUST-C2-PACK',{type:'customer',baseProcessSop:'SOP-PROC-PACK-001',customerId:'C2'});
  const staleOverlay=released('SOP-CUST-C3-ABD',{type:'customer',baseSopNumber:'SOP-EH-060',customerId:'C3'});
  const result=model.reconcileCatalog([validOverlay,validLegacyAlias,staleOverlay],[canonical]);
  assert.deepEqual(result.map(doc=>doc.number),['SOP-PROC-PACK-001','SOP-CUST-C1-PACK','SOP-CUST-C2-PACK']);
});

test('RC1550: Suche berücksichtigt Kategorie, Gruppe, Provider, Carrier-IDs, Kunden-IDs und Keywords',()=>{
  const docs=[
    released('SOP-CUST-BSH-001',{title:'Transportanmeldung',category:'customer',group:'BSH-Gruppe',customerIds:['BSH','NEFF','GAGGENAU'],keywords:['Transport','Werknummer']}),
    released('SOP-CARRIER-DHL-001',{title:'Express Versand',category:'carrier',provider:'DHL Express',carrierIds:['DHL'],keywords:['Paket']})
  ];
  assert.deepEqual(model.filterDocuments(docs,{query:'Neff'}).map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.deepEqual(model.filterDocuments(docs,{query:'BSH-Gruppe'}).map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.deepEqual(model.filterDocuments(docs,{query:'DHL Express'}).map(doc=>doc.number),['SOP-CARRIER-DHL-001']);
  assert.deepEqual(model.filterDocuments(docs,{query:'DHL'}).map(doc=>doc.number),['SOP-CARRIER-DHL-001']);
});
