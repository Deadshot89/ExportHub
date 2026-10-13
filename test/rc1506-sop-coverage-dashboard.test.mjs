import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1500-sop-overlay.js');
await import('../assets/sop/rc1502-sop-visuals.js');
await import('../assets/sop/rc1501-sop-tour-targets.js');
await import('../assets/sop/rc1505-sop-function-registry.js');
await import('../assets/sop/rc1505-sop-coverage.js');
await import('../assets/sop/rc1506-sop-coverage-dashboard.js');

const dashboard=globalThis.ExportHubSopCoverageDashboard;

function releasedDocument(number='SOP-EH-060',options={}){
  const stepId=options.stepId||'step-1';
  const stableKey=options.stableKey===undefined?'shipment-abd-decision':options.stableKey;
  const step={
    id:stepId,order:1,title:options.title||'ABD Entscheidung',instruction:'Prüfe die ABD-Pflicht.',expectedAction:'click',
    target:{stableKey,selector:stableKey?`[data-tour-key="${stableKey}"]`:''},checks:[],
    tour:{enabled:options.tour!==false,highlight:true,blockWrongNavigation:true},
    training:{enabled:true,sideEffectPolicy:'sandbox'},
    exam:{relevant:options.exam!==false,required:true,weight:1,allowHint:false}
  };
  const visuals=options.image===false?[]:[{type:'screenshot',stepId,src:`/assets/sop/screenshots/${number}.png`,required:true,annotations:[]}];
  const status=options.status||'Freigegeben';
  return {
    id:`DOC-${number}`,type:'process',number,title:options.documentTitle||`${number} Test`,area:options.area||'Export / Zoll',currentVersion:'2.0',version:'2.0',status,
    approvedBy:status==='Freigegeben'?'QA':'',
    versions:[{version:'2.0',status,title:`${number} Test`,approvedBy:status==='Freigegeben'?'QA':'',content:{steps:[step]},visuals}]
  };
}

function entry(overrides={}){
  return {
    id:'customs.abd.decision',view:'shipment',action:'decide-abd-required',sopNumber:'SOP-EH-060',stepId:'step-1',
    targetKey:'shipment-abd-decision',area:'Export / Zoll',requiredImage:true,requiredTour:true,requiredExam:true,required:true,customerScoped:true,
    ...overrides
  };
}

function overlay(customerId='C1',number='SOP-C1-060'){
  return {
    id:`OV-${customerId}`,type:'customer',customerId,baseProcessSop:'SOP-EH-060',number,currentVersion:'1.0',version:'1.0',status:'Freigegeben',
    versions:[{version:'1.0',status:'Freigegeben',title:'Kundenhinweis ABD',approvedBy:'QA',content:{overlays:[{action:'enrich-step',stepId:'step-1',warnings:['Kundenhinweis']}]},visuals:[]}]
  };
}

function model(options={}){
  return dashboard.buildModel({
    entries:[entry()],documents:[releasedDocument()],assetExists:()=>true,
    customers:[{id:'C1',name:'Kunde Alpha'},{id:'C2',name:'Kunde Beta'}],
    ...options
  });
}

test('Dashboard API ist eine reine Admin-Schicht auf dem RC1505 Coverage-Scanner',()=>{
  assert.ok(dashboard,'ExportHubSopCoverageDashboard fehlt');
  assert.equal(typeof dashboard.buildModel,'function');
  assert.equal(typeof dashboard.filterItems,'function');
  assert.equal(typeof dashboard.render,'function');
  assert.equal(typeof dashboard.navigationFor,'function');
  assert.equal(typeof dashboard.navigate,'function');
  assert.equal(typeof dashboard.mount,'function');

  const result=model();
  assert.equal(result.coverage.percentage,100);
  assert.equal(result.items[0].status,'green');
  assert.equal(result.items[0].capabilities.tour.present,true);
  assert.equal(result.items[0].capabilities.image.present,true);
});

test('KPI-Zusammenfassung übernimmt Hauptstatus und Capabilities getrennt',()=>{
  const result=model({
    entries:[
      entry({id:'green'}),
      entry({id:'red',sopNumber:'SOP-EH-999',area:'Administration'}),
      entry({id:'yellow',sopNumber:'SOP-EH-061',area:'Versand'})
    ],
    documents:[releasedDocument(),releasedDocument('SOP-EH-061',{area:'Versand',image:false})]
  });

  assert.deepEqual(result.summary,{total:3,percentage:33,red:1,yellow:1,green:1,tour:2,image:1});
  assert.equal(result.items.find(item=>item.id==='green').status,'green');
  assert.equal(result.items.find(item=>item.id==='yellow').status,'yellow');
  assert.equal(result.items.find(item=>item.id==='yellow').capabilities.tour.present,true);
  assert.equal(result.items.find(item=>item.id==='red').status,'red');
});

test('Bereich, Hauptstatus und Fähigkeit sind kombinierbare Filter',()=>{
  const result=model({
    entries:[
      entry({id:'zoll'}),
      entry({id:'versand',sopNumber:'SOP-EH-061',area:'Versand',requiredImage:false}),
      entry({id:'admin',sopNumber:'SOP-EH-999',area:'Administration',requiredImage:false,requiredTour:false,requiredExam:false})
    ],
    documents:[releasedDocument(),releasedDocument('SOP-EH-061',{area:'Versand',image:false})]
  });

  assert.deepEqual(dashboard.filterItems(result.items,{area:'Versand'}).map(row=>row.id),['versand']);
  assert.deepEqual(dashboard.filterItems(result.items,{status:'green'}).map(row=>row.id),['zoll','versand']);
  assert.deepEqual(dashboard.filterItems(result.items,{capability:'image'}).map(row=>row.id),['zoll']);
  assert.deepEqual(dashboard.filterItems(result.items,{area:'Export / Zoll',status:'green',capability:'tour'}).map(row=>row.id),['zoll']);
});

test('Kundenfilter ist Coverage-Kontext und verändert nicht den Nenner',()=>{
  const requiredEntry=entry({customerOverlayRequired:true});
  const withoutCustomer=model({entries:[requiredEntry]});
  assert.equal(withoutCustomer.summary.total,1);
  assert.equal(withoutCustomer.summary.green,1);

  const missingOverlay=model({entries:[requiredEntry],customerId:'C1'});
  assert.equal(missingOverlay.summary.total,1);
  assert.equal(missingOverlay.summary.yellow,1);
  assert.ok(missingOverlay.items[0].reasons.includes('CUSTOMER_OVERLAY_MISSING'));

  const withOverlay=model({entries:[requiredEntry],documents:[releasedDocument(),overlay()],customerId:'C1'});
  assert.equal(withOverlay.summary.total,1);
  assert.equal(withOverlay.summary.green,1);
  assert.equal(withOverlay.items[0].customerOverlay.present,true);
  assert.equal(withOverlay.items[0].customerOverlay.number,'SOP-C1-060');
  assert.equal(withOverlay.context.customerId,'C1');
  assert.equal(withOverlay.context.customerName,'Kunde Alpha');
});

test('zentraler Dashboard-Scan bleibt statisch und verlangt kein gemountetes UI-Ziel',()=>{
  const result=model();
  assert.equal(result.items[0].status,'green');
  assert.ok(!result.items[0].reasons.includes('TARGET_MISSING'));
  assert.ok(!result.items[0].reasons.includes('TARGET_UNAVAILABLE'));
});

test('Navigation verwendet stabile SOP-, Schritt- und Overlay-IDs statt DOM-Textsuche',()=>{
  const result=model({documents:[releasedDocument(),overlay()],customerId:'C1'});
  const row=result.items[0];

  assert.deepEqual(dashboard.navigationFor(row,'sop'),{kind:'sop',view:'sop',sopNumber:'SOP-EH-060'});
  assert.deepEqual(dashboard.navigationFor(row,'step'),{kind:'step',view:'sop',sopNumber:'SOP-EH-060',stepId:'step-1'});
  assert.deepEqual(dashboard.navigationFor(row,'overlay'),{kind:'overlay',view:'sop',sopNumber:'SOP-C1-060',baseSopNumber:'SOP-EH-060',customerId:'C1'});

  let opened=null;
  assert.equal(dashboard.navigate(dashboard.navigationFor(row,'step'),{onNavigate:target=>{opened=target;}}),true);
  assert.equal(opened.stepId,'step-1');
});

test('Rendering zeigt Quote, alle vereinbarten Status-/Capability-KPIs, Filter und Direktaktionen',()=>{
  const result=model({documents:[releasedDocument(),overlay()],customerId:'C1'});
  const html=dashboard.render(result,{area:'',status:'',customerId:'C1',capability:''});

  assert.match(html,/SOPMaster Coverage/);
  assert.match(html,/Abdeckungsquote/);
  assert.match(html,/🔴/);
  assert.match(html,/SOP fehlt/);
  assert.match(html,/🟡/);
  assert.match(html,/SOP unvollständig/);
  assert.match(html,/🟢/);
  assert.match(html,/SOP vollständig/);
  assert.match(html,/🔵/);
  assert.match(html,/Tour vorhanden/);
  assert.match(html,/🟣/);
  assert.match(html,/Bildanleitung vorhanden/);
  assert.match(html,/data-coverage-filter="area"/);
  assert.match(html,/data-coverage-filter="status"/);
  assert.match(html,/data-coverage-filter="customerId"/);
  assert.match(html,/data-coverage-filter="capability"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/data-coverage-nav="sop"/);
  assert.match(html,/data-coverage-nav="step"/);
  assert.match(html,/data-coverage-nav="overlay"/);
});

test('Rendering kodiert dynamische Registry-/Kundentexte und mutiert Eingaben nicht',()=>{
  const entries=[entry({id:'unsafe<script>',area:'<img src=x onerror=1>'})];
  const documents=[releasedDocument('SOP-EH-060',{area:'<img src=x onerror=1>',documentTitle:'<script>alert(1)</script>'})];
  const beforeEntries=JSON.stringify(entries),beforeDocs=JSON.stringify(documents);
  const result=model({entries,documents,customers:[{id:'C1',name:'<b>Kunde</b>'}]});
  const html=dashboard.render(result,{});

  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html,/<img src=x onerror=1>/);
  assert.match(html,/&lt;img src=x onerror=1&gt;/);
  assert.equal(JSON.stringify(entries),beforeEntries);
  assert.equal(JSON.stringify(documents),beforeDocs);
});

test('leere Trefferliste bleibt zugänglich und erklärt den Zustand',()=>{
  const result=model();
  const html=dashboard.render(result,{area:'Nicht vorhanden'});
  assert.match(html,/Keine SOPs für die gewählten Filter/);
  assert.match(html,/role="status"/);
});
