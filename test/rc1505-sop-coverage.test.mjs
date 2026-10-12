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
    id:stepId,
    order:1,
    title:'ABD Entscheidung',
    instruction:'Prüfe die ABD-Pflicht.',
    expectedAction:'click',
    target:{stableKey,selector:stableKey?`[data-tour-key="${stableKey}"]`:''},
    checks:[],
    tour:{enabled:options.tour!==false,highlight:true,blockWrongNavigation:true},
    training:{enabled:true,sideEffectPolicy:'sandbox'},
    exam:{relevant:options.exam!==false,required:true,weight:1,allowHint:false}
  };
  const visual=options.image===false?[]:[{type:'screenshot',stepId,src:'/assets/sop/screenshots/abd.png',required:true,annotations:[]}];
  const versionStatus=options.status||'Freigegeben';
  return {
    id:`DOC-${number}`,
    type:'process',
    number,
    title:`${number} Test`,
    currentVersion:'2.0',
    version:'2.0',
    status:versionStatus,
    approvedBy:versionStatus==='Freigegeben'?'QA':'',
    versions:[{
      version:'2.0',
      status:versionStatus,
      title:`${number} Test`,
      approvedBy:versionStatus==='Freigegeben'?'QA':'',
      content:{steps:[step]},
      visuals:visual
    }]
  };
}

function entry(overrides={}){
  return {
    id:'customs.abd.decision',
    view:'shipment',
    action:'decide-abd-required',
    sopNumber:'SOP-EH-060',
    stepId:'step-1',
    targetKey:'shipment-abd-decision',
    requiredImage:true,
    requiredTour:true,
    requiredExam:true,
    required:true,
    customerScoped:true,
    ...overrides
  };
}

function scopeWith(count=1,key='shipment-abd-decision'){
  return {
    querySelectorAll(selector){
      if(selector===`[data-tour-key="${key}"]`)return Array.from({length:count},(_,index)=>({id:`target-${index+1}`}));
      return [];
    }
  };
}

function scanOne({registryEntry=entry(),document=releasedDocument(),documents,scope=scopeWith(1),customerId='',overlays=[]}={}){
  const docs=documents||[document,...overlays].filter(Boolean);
  return coverage.scan({entries:[registryEntry],documents:docs,scope,customerId})[0];
}

test('Coverage API ist vorhanden und exportiert stabile Statuscodes',()=>{
  assert.ok(coverage,'ExportHubSopCoverage fehlt');
  assert.equal(typeof coverage.scan,'function');
  assert.equal(typeof coverage.evaluateEntry,'function');
  assert.deepEqual(coverage.STATUS,{
    MISSING:'MISSING',
    INCOMPLETE:'INCOMPLETE',
    COVERED:'COVERED',
    CUSTOMER_OVERLAY:'CUSTOMER_OVERLAY',
    NO_SOP_NEEDED:'NO_SOP_NEEDED'
  });
});

test('fehlende Pflicht-SOP ist rot statt stillschweigend vollständig',()=>{
  const row=scanOne({document:null,documents:[]});
  assert.equal(row.statusCode,'MISSING');
  assert.equal(row.symbol,'🔴');
  assert.ok(row.reasons.includes('SOP_MISSING'));
});

test('nicht freigegebene SOP bleibt rot',()=>{
  const row=scanOne({document:releasedDocument('SOP-EH-060',{status:'Entwurf'})});
  assert.equal(row.statusCode,'MISSING');
  assert.ok(row.reasons.includes('SOP_NOT_RELEASED'));
});

test('NO SOP NEEDED ist ausschließlich bei expliziter Coverage-Policy lila',()=>{
  const explicit=scanOne({registryEntry:entry({sopNumber:'',stepId:'',targetKey:'',requiredImage:false,requiredTour:false,requiredExam:false,coveragePolicy:'no-sop-needed'}),documents:[]});
  assert.equal(explicit.statusCode,'NO_SOP_NEEDED');
  assert.equal(explicit.symbol,'🟣');
  assert.deepEqual(explicit.reasons,['NO_SOP_NEEDED']);

  const accidental=scanOne({registryEntry:entry({sopNumber:'',stepId:'',targetKey:'',requiredImage:false,requiredTour:false,requiredExam:false}),documents:[]});
  assert.equal(accidental.statusCode,'MISSING');
  assert.ok(accidental.reasons.includes('SOP_NUMBER_REQUIRED'));
});

test('freigegebene SOP ohne Pflichtbild ist gelb und nennt IMAGE_MISSING',()=>{
  const row=scanOne({document:releasedDocument('SOP-EH-060',{image:false})});
  assert.equal(row.statusCode,'INCOMPLETE');
  assert.equal(row.symbol,'🟡');
  assert.ok(row.reasons.includes('IMAGE_MISSING'));
});

test('fehlende Tour oder Prüfungsmarkierung wird getrennt als unvollständig ausgewiesen',()=>{
  const tour=scanOne({document:releasedDocument('SOP-EH-060',{tour:false})});
  assert.equal(tour.statusCode,'INCOMPLETE');
  assert.ok(tour.reasons.includes('TOUR_MISSING'));

  const exam=scanOne({document:releasedDocument('SOP-EH-060',{exam:false})});
  assert.equal(exam.statusCode,'INCOMPLETE');
  assert.ok(exam.reasons.includes('EXAM_MISSING'));
});

test('fehlender oder mehrdeutiger stabiler UI-Target-Key ist gelb und fail-closed',()=>{
  const missing=scanOne({scope:scopeWith(0)});
  assert.equal(missing.statusCode,'INCOMPLETE');
  assert.ok(missing.reasons.includes('TARGET_MISSING'));

  const duplicate=scanOne({scope:scopeWith(2)});
  assert.equal(duplicate.statusCode,'INCOMPLETE');
  assert.ok(duplicate.reasons.includes('TARGET_DUPLICATE'));
});

test('vollständig freigegebene SOP mit Bild Tour Exam und eindeutigem Target ist grün',()=>{
  const row=scanOne();
  assert.equal(row.statusCode,'COVERED');
  assert.equal(row.symbol,'🟢');
  assert.deepEqual(row.reasons,[]);
  assert.equal(row.version,'2.0');
  assert.equal(row.sopNumber,'SOP-EH-060');
});

test('freigegebenes Kunden-Overlay wird bei sonst vollständiger Abdeckung blau',()=>{
  const overlay={
    id:'OV-C1-060',
    type:'customer',
    customerId:'C1',
    baseProcessSop:'SOP-EH-060',
    number:'SOP-C1-060',
    currentVersion:'1.0',
    version:'1.0',
    status:'Freigegeben',
    versions:[{
      version:'1.0',
      status:'Freigegeben',
      title:'Kundenhinweis ABD',
      content:{overlays:[{action:'enrich-step',stepId:'step-1',warnings:['Kundenhinweis prüfen']}]},
      visuals:[]
    }]
  };
  const base=releasedDocument();
  const row=scanOne({documents:[base,overlay],customerId:'C1'});
  assert.equal(row.statusCode,'CUSTOMER_OVERLAY');
  assert.equal(row.symbol,'🔵');
  assert.deepEqual(row.reasons,['CUSTOMER_OVERLAY_ACTIVE']);
  assert.equal(row.customerId,'C1');
  assert.equal(row.overlayNumber,'SOP-C1-060');
});

test('Scanner liefert Registry-Reihenfolge deterministisch und verändert Eingaben nicht',()=>{
  const entries=[entry({id:'b'}),entry({id:'a',action:'other-action'})];
  const before=JSON.stringify(entries);
  const rows=coverage.scan({entries,documents:[releasedDocument()],scope:scopeWith(1)});
  assert.deepEqual(rows.map(row=>row.id),['b','a']);
  assert.equal(JSON.stringify(entries),before);
  assert.notEqual(rows[0],entries[0]);
});
