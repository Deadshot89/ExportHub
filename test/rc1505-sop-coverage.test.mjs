import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1502-sop-visuals.js');
await import('../assets/sop/rc1501-sop-tour-targets.js');
await import('../assets/sop/rc1505-sop-function-registry.js');
await import('../assets/sop/rc1505-sop-coverage.js').catch(()=>{});

const coverage=globalThis.ExportHubSopCoverage;

function releasedDocument(number='SOP-EH-060',options={}){
  const stepId=options.stepId||'step-1';
  const stableKey=options.stableKey===undefined?'shipment-abd-decision':options.stableKey;
  const step={
    id:stepId,order:1,title:'ABD Entscheidung',instruction:'Prüfe die ABD-Pflicht.',expectedAction:'click',
    target:{stableKey,selector:stableKey?`[data-tour-key="${stableKey}"]`:''},checks:[],
    tour:{enabled:options.tour!==false,highlight:true,blockWrongNavigation:true},
    training:{enabled:true,sideEffectPolicy:'sandbox'},
    exam:{relevant:options.exam!==false,required:true,weight:1,allowHint:false}
  };
  const visual=options.image===false?[]:[{type:'screenshot',stepId,src:'/assets/sop/screenshots/abd.png',required:true,annotations:[]}];
  const status=options.status||'Freigegeben';
  return {
    id:`DOC-${number}`,type:'process',number,title:`${number} Test`,currentVersion:'2.0',version:'2.0',status,
    approvedBy:status==='Freigegeben'?'QA':'',
    versions:[{version:'2.0',status,title:`${number} Test`,approvedBy:status==='Freigegeben'?'QA':'',content:{steps:[step]},visuals:visual}]
  };
}

function entry(overrides={}){
  return {
    id:'customs.abd.decision',view:'shipment',action:'decide-abd-required',sopNumber:'SOP-EH-060',stepId:'step-1',
    targetKey:'shipment-abd-decision',requiredImage:true,requiredTour:true,requiredExam:true,required:true,customerScoped:true,
    ...overrides
  };
}

function scopeWith(count=1,key='shipment-abd-decision'){
  return {querySelectorAll(selector){return selector===`[data-tour-key="${key}"]`?Array.from({length:count},(_,i)=>({id:`target-${i+1}`})):[];}};
}
function scan(options={}){
  return coverage.scan({scope:scopeWith(1),assetExists:()=>true,...options});
}
function scanOne(options={}){
  const registryEntry=options.registryEntry||entry();
  const documents=options.documents!==undefined?options.documents:[options.document===undefined?releasedDocument():options.document].filter(Boolean);
  return scan({entries:[registryEntry],documents,scope:options.scope||scopeWith(1),assetExists:options.assetExists||(()=>true),customerId:options.customerId}).items[0];
}

test('Coverage API folgt dem freigegebenen Rot-Gelb-Grün-Vertrag',()=>{
  assert.ok(coverage,'ExportHubSopCoverage fehlt');
  assert.equal(typeof coverage.scan,'function');
  assert.equal(typeof coverage.evaluateEntry,'function');
  assert.deepEqual(coverage.STATUS,{MISSING:'red',INCOMPLETE:'yellow',COMPLETE:'green'});
});

test('fehlende oder nicht freigegebene Pflicht-SOP ist rot',()=>{
  const missing=scanOne({documents:[]});
  assert.equal(missing.status,'red');
  assert.equal(missing.symbol,'🔴');
  assert.ok(missing.reasons.includes('SOP_MISSING'));

  const draft=scanOne({document:releasedDocument('SOP-EH-060',{status:'Entwurf'})});
  assert.equal(draft.status,'red');
  assert.ok(draft.reasons.includes('SOP_NOT_RELEASED'));
});

test('fehlender Pflichtschritt, Bild, Tour oder Exam macht eine freigegebene SOP gelb',()=>{
  const noStep=scanOne({registryEntry:entry({stepId:'missing-step'})});
  assert.equal(noStep.status,'yellow');
  assert.ok(noStep.reasons.includes('STEP_MISSING'));

  const noImage=scanOne({document:releasedDocument('SOP-EH-060',{image:false})});
  assert.equal(noImage.status,'yellow');
  assert.ok(noImage.reasons.includes('IMAGE_MISSING'));
  assert.equal(noImage.capabilities.image.present,false);

  const noTour=scanOne({document:releasedDocument('SOP-EH-060',{tour:false})});
  assert.equal(noTour.status,'yellow');
  assert.ok(noTour.reasons.includes('TOUR_MISSING'));
  assert.equal(noTour.capabilities.tour.present,false);

  const noExam=scanOne({document:releasedDocument('SOP-EH-060',{exam:false})});
  assert.equal(noExam.status,'yellow');
  assert.ok(noExam.reasons.includes('EXAM_MISSING'));
});

test('Bild-Metadaten mit fehlender Datei bleiben gelb',()=>{
  const row=scanOne({assetExists:()=>false});
  assert.equal(row.status,'yellow');
  assert.ok(row.reasons.includes('IMAGE_FILE_MISSING'));
  assert.equal(row.capabilities.image.present,false);
});

test('fehlender oder doppelter data-tour-key wird gelb und fail-closed',()=>{
  const missing=scanOne({scope:scopeWith(0)});
  assert.equal(missing.status,'yellow');
  assert.ok(missing.reasons.includes('TARGET_MISSING'));

  const duplicate=scanOne({scope:scopeWith(2)});
  assert.equal(duplicate.status,'yellow');
  assert.ok(duplicate.reasons.includes('TARGET_DUPLICATE'));
});

test('vollständige SOP ist grün und kann gleichzeitig blaue Tour- und lila Bild-Capability tragen',()=>{
  const row=scanOne();
  assert.equal(row.status,'green');
  assert.equal(row.symbol,'🟢');
  assert.deepEqual(row.reasons,[]);
  assert.deepEqual(row.capabilities.tour,{present:true,symbol:'🔵'});
  assert.deepEqual(row.capabilities.image,{present:true,symbol:'🟣'});
  assert.equal(row.capabilities.exam.present,true);
  assert.equal(row.version,'2.0');
});

test('Kunden-Overlay ist Kontextinformation und ersetzt keine Gesamtstatusfarbe',()=>{
  const overlay={
    id:'OV-C1-060',type:'customer',customerId:'C1',baseProcessSop:'SOP-EH-060',number:'SOP-C1-060',currentVersion:'1.0',version:'1.0',status:'Freigegeben',
    versions:[{version:'1.0',status:'Freigegeben',title:'Kundenhinweis ABD',content:{overlays:[{action:'enrich-step',stepId:'step-1',warnings:['Kundenhinweis']}]},visuals:[]}]
  };
  const row=scanOne({documents:[releasedDocument(),overlay],customerId:'C1'});
  assert.equal(row.status,'green');
  assert.equal(row.customerOverlay.present,true);
  assert.equal(row.customerOverlay.number,'SOP-C1-060');
});

test('explizit erforderliches Kunden-Overlay fehlt oder ist nicht freigegeben => gelb',()=>{
  const required=entry({customerOverlayRequired:true});
  const missing=scanOne({registryEntry:required,customerId:'C1'});
  assert.equal(missing.status,'yellow');
  assert.ok(missing.reasons.includes('CUSTOMER_OVERLAY_MISSING'));

  const draftOverlay={id:'OV-DRAFT',type:'customer',customerId:'C1',baseProcessSop:'SOP-EH-060',number:'SOP-C1-060',currentVersion:'1.0',status:'Entwurf',versions:[{version:'1.0',status:'Entwurf',content:{overlays:[]}}]};
  const draft=scanOne({registryEntry:required,documents:[releasedDocument(),draftOverlay],customerId:'C1'});
  assert.equal(draft.status,'yellow');
  assert.ok(draft.reasons.includes('CUSTOMER_OVERLAY_NOT_RELEASED'));
});

test('optionale Registry-Einträge ohne SOP zählen weder als fehlend noch in den Nenner',()=>{
  const result=scan({entries:[entry(),entry({id:'optional.tool',required:false,sopNumber:'',stepId:'',targetKey:'',requiredImage:false,requiredTour:false,requiredExam:false})],documents:[releasedDocument()]});
  assert.equal(result.items.length,1);
  assert.equal(result.counts.total,1);
  assert.equal(result.counts.green,1);
  assert.equal(result.percentage,100);
});

test('Quote und Counts basieren ausschließlich auf erforderlichen Registry-Einträgen',()=>{
  const result=scan({
    entries:[entry({id:'green'}),entry({id:'red',sopNumber:'SOP-EH-999',stepId:'step-1'}),entry({id:'yellow',action:'other',requiredImage:true})],
    documents:[releasedDocument()],
    assetExists:(src,row)=>row.id!=='yellow'
  });
  assert.equal(result.counts.total,3);
  assert.equal(result.counts.green,1);
  assert.equal(result.counts.red,1);
  assert.equal(result.counts.yellow,1);
  assert.equal(result.percentage,33);
});

test('Scanner behält Registry-Reihenfolge bei und mutiert Eingaben nicht',()=>{
  const entries=[entry({id:'b'}),entry({id:'a',action:'other-action'})];
  const before=JSON.stringify(entries);
  const result=scan({entries,documents:[releasedDocument()]});
  assert.deepEqual(result.items.map(row=>row.id),['b','a']);
  assert.equal(JSON.stringify(entries),before);
  assert.notEqual(result.items[0],entries[0]);
});
