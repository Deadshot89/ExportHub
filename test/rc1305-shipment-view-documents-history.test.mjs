import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const historySource=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const buildSource=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
const shipmentViewFixSource=fs.readFileSync('assets/rc1460-shipment-view-files-avis-preview.js','utf8');

function runtime(){
  const shipment={id:'S1',ref:'ABC123',status:'Abgeholt',shipmentHistory:[]};
  const state={view:'shipmentview',shipmentViewId:'S1',shipments:[shipment],savedShipments:[shipment],currentUser:{id:'U1',name:'Tobias',role:'Globaler Administrator'}};
  const listeners={};
  const document={
    body:null,readyState:'loading',
    addEventListener(name,fn){(listeners[name]||(listeners[name]=[])).push(fn)},
    getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]}
  };
  const window={
    ExportHUBI18n:{
      language(){return'de'},
      t(key,vars){let value=de[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
      formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)}
    },
    __EXPORTHUB_GET_STATE__:()=>state,
    __EXPORTHUB_GET_CURRENT_USER__:()=>state.currentUser,
    ExportHUBClean:{state,queueSave(){return true},flushSave(){return Promise.resolve(true)}},
    addEventListener(){},document,console
  };
  const context={window,document,console,Date,Intl,Math,Map,Set,Array,Object,String,Number,Promise,CustomEvent:function(){},
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},MutationObserver:undefined};
  vm.runInNewContext(historySource,context,{filename:'rc1071-shipment-history.js'});
  return{shipment,listeners,api:window.ExportHUBShipmentHistory1071};
}

function clickTarget(label,sectionText){
  const section={
    textContent:sectionText||label,
    getAttribute(){return''}
  };
  const button={
    textContent:label,
    getAttribute(name){
      if(name==='data-rc776-documents')return label==='Ladeliste & CMR'?'1':'';
      return'';
    },
    closest(selector){
      if(selector==='button,a,[role="button"]')return this;
      if(selector.includes('section')||selector.includes('.card')||selector.includes('.panel')||selector.includes('.field'))return section;
      return null;
    }
  };
  return{closest(selector){return selector==='button,a,[role="button"]'?button:null}};
}

test('RC1305: Navigation zu Ladeliste & CMR erzeugt keinen falschen CMR-geöffnet-Eintrag',()=>{
  const {shipment,listeners}=runtime();
  const click=(listeners.click||[])[0];
  assert.equal(typeof click,'function');
  click({target:clickTarget('Ladeliste & CMR','Dateien & Dokumente Ladeliste & CMR')});
  assert.equal((shipment.shipmentHistory||[]).filter(x=>x.type==='document-open').length,0);
});

test('RC1305: eine ausdrückliche Dokumentöffnung wird weiterhin protokolliert',()=>{
  const {shipment,api}=runtime();
  api.recordDocumentAction(shipment,'open','CMR','CMR_ABC123.pdf');
  const opens=(shipment.shipmentHistory||[]).filter(x=>x.type==='document-open');
  assert.equal(opens.length,1);
  assert.equal(opens[0].details.document,'CMR');
  assert.equal(opens[0].details.fileName,'CMR_ABC123.pdf');
});

test('RC1305: Sendungsansicht verbindet Ref-Ordner, gespeicherte Anhänge und Blob-Dokumente',()=>{
  assert.match(buildSource,/function mergeReferenceDocs\(live,fallback\)/);
  assert.match(buildSource,/fallback=shipmentAssociatedDocs\(sh,fallback\)/);
  assert.match(buildSource,/ExportHUBDocumentBlob1059/);
  assert.match(buildSource,/source==='combined'/);
  assert.match(buildSource,/Ref-Ordner \+ gespeicherte Anhänge/);
});

test('RC1305: Statusverlauf enthält fachliche Sendungsbewegung einschließlich Abholung',()=>{
  assert.match(buildSource,/pickupRows\(sh&&sh\.pickupHistory,'main'\)/);
  assert.match(buildSource,/actualPickupDate\|\|sh\.pickedUpAtDate\|\|sh\.pickedUpAt\|\|sh\.pickupConfirmedAt/);
  assert.match(buildSource,/'Abgeholt'/);
  assert.match(buildSource,/'POD vorhanden'/);
  assert.match(buildSource,/'Abgeschlossen'/);
  assert.match(buildSource,/Fachliche Bewegung der Sendung: Status, Abholung, POD und Abschluss/);
});

test('RC1305: Build-Skript bleibt syntaktisch gültig und lädt die History mit neuem Cache-Key',()=>{
  const check=spawnSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr||check.stdout);
  assert.match(buildSource,/rc1071-shipment-history\.js\?v=1468/);
  assert.match(historySource,/version:'RC1305'/);
});


test('RC1460: Sendungsansicht berücksichtigt alle fachlichen Datei-Felder',()=>{
  assert.match(buildSource,/function shipmentAssociatedDocs\(sh,prior\)/);
  assert.match(buildSource,/fallback=shipmentAssociatedDocs\(sh,fallback\)/);
  for(const field of ['deliveryFiles','deliveryNotesFiles','lieferscheine','files','attachments','abdFiles','podFiles','invoiceFiles','cmrFiles','photos','pickupPhotos','containerPhotos']){
    assert.ok(buildSource.includes(field),field+' wird von der Dokumentauflösung nicht berücksichtigt');
  }
  assert.match(buildSource,/out\.push\(normalizeFallback\(entry\)\)/);
});

test('RC1460: Statusverlauf zeigt den ausführenden Benutzer',()=>{
  assert.match(buildSource,/Benutzer: /);
  assert.match(buildSource,/row&&row\.actor&&row\.actor\.name/);
});

test('RC1460: aktives Lieferavis erhält zentral übersetzte Öffnen- und Kopieren-Aktion',()=>{
  assert.match(shipmentViewFixSource,/function tr\(key,fallback\)/);
  assert.match(shipmentViewFixSource,/tr\('common\.open','Öffnen'\)/);
  assert.doesNotMatch(shipmentViewFixSource,/a\.textContent='AVIS öffnen'/);
  assert.match(shipmentViewFixSource,/Link kopieren/);
  assert.match(shipmentViewFixSource,/customerAvisUrl\|\|sh\.avisUrl\|\|sh\.customerAvisLink\|\|sh\.avisLink/);
});

test('RC1460: zentrale Dateivorschau unterstützt PDF und Bilder',()=>{
  assert.match(shipmentViewFixSource,/ExportHUBFilePreview1460/);
  assert.match(shipmentViewFixSource,/pdf\|png\|jpe\?g\|webp\|gif\|bmp\|svg/);
  assert.match(shipmentViewFixSource,/data-exporthub-file-preview/);
});

test('RC1460: Build lädt die neue Runtime',()=>{
  assert.match(buildSource,/rc1460-shipment-view-files-avis-preview\.js\?v=1460/);
});


test('Sendungsansicht: gespeicherte Kopien, verknüpfte ABD-Rechnungen und Packtischdokumente werden gefunden',()=>{
  const match=buildSource.match(/const docHelpers=`([\s\S]*?)`;/);
  assert.ok(match,'Dokument-Helfer fehlen im Build');
  const shipment={id:'SHIP-9Z7L82',ref:'9Z7L82'};
  const state={
    shipments:[shipment],
    savedShipments:[{id:'SHIP-9Z7L82',ref:'9Z7L82',deliveryFiles:[{name:'SIDE250071804.pdf',storage:'blob',blobName:'persisted-delivery'}]}],
    abdRequests:[
      {id:'ABD-9Z7L82',ref:'9Z7L82',invoiceFiles:[{name:'Rechnung_9Z7L82.pdf',storage:'blob',blobName:'persisted-invoice'}]},
      {id:'ABD-OTHER',ref:'OTHER1',invoiceFiles:[{name:'FREMDE_Rechnung.pdf',storage:'blob',blobName:'other'}]}
    ],
    packNotifications:[{id:'PACK-1',shipmentId:'SHIP-9Z7L82',documents:[{name:'Packtisch_Lieferschein.pdf',storage:'blob',blobName:'packing-note'}]}]
  };
  const keys=['deliveryFiles','invoiceFiles','documents','attachments'];
  const context={
    window:{ExportHUBDocumentBlob1059:{isBlobDocument:file=>file&&file.storage==='blob'&&!!file.blobName}},
    arr:v=>Array.isArray(v)?v:[],
    q:v=>String(v==null?'':v).trim(),
    low:v=>String(v==null?'':v).trim().toLowerCase(),
    refOf:sh=>String(sh&&(sh.ref||sh.reference||sh.shipmentRef)||'').toUpperCase(),
    idOf:sh=>String(sh&&(sh.id||sh.shipmentId)||''),
    roots:()=>[state],
    state:()=>state,
    fileName:(file,fallback)=>file&&file.name||fallback,
    fileUrl:file=>file&&file.url||'',
    normalizeFallback:d=>Object.assign({source:'shipmentState'},d),
    collectDocs:sh=>keys.flatMap(key=>(Array.isArray(sh&&sh[key])?sh[key]:[]).map(file=>({file,name:file.name,group:key,url:file.url||''})))
  };
  vm.runInNewContext(match[1],context,{filename:'generated-shipment-doc-helpers.js'});
  const docs=context.shipmentAssociatedDocs(shipment,[]);
  const names=docs.map(d=>d.name).sort();
  assert.deepEqual(names,['Packtisch_Lieferschein.pdf','Rechnung_9Z7L82.pdf','SIDE250071804.pdf']);
  assert.equal(names.includes('FREMDE_Rechnung.pdf'),false);
});

test('Sendungsansicht: nur gespeicherte Dateimetadaten zählen nicht als öffnungsfähige Datei',()=>{
  const match=buildSource.match(/const docHelpers=`([\s\S]*?)`;/);
  assert.ok(match);
  const state={shipments:[],savedShipments:[],abdRequests:[]};
  const context={
    window:{ExportHUBDocumentBlob1059:{isBlobDocument:()=>false}},
    arr:v=>Array.isArray(v)?v:[],
    q:v=>String(v==null?'':v).trim(),
    low:v=>String(v==null?'':v).trim().toLowerCase(),
    refOf:sh=>String(sh&&sh.ref||'').toUpperCase(),
    idOf:sh=>String(sh&&sh.id||''),
    roots:()=>[state],state:()=>state,
    fileName:(file,fallback)=>file&&file.name||fallback,
    fileUrl:()=>'',normalizeFallback:d=>d,
    collectDocs:()=>[{name:'Nur-Name.pdf',file:{name:'Nur-Name.pdf'},url:''}]
  };
  vm.runInNewContext(match[1],context);
  assert.equal(context.shipmentAssociatedDocs({id:'S',ref:'ABC123'},[]).length,0);
});

test('Blob-Dokumente werden vom Release-Build auch ohne direkte URL öffnungsfähig gemacht',()=>{
  const baseline=fs.readFileSync('dist-rc1048/index.html','utf8');
  const start=baseline.indexOf('function openDoc(index){');
  const end=baseline.indexOf('function downloadDoc(index)',start);
  assert.ok(start>=0&&end>start,'Dokumentenöffnung fehlt in der Release-Basis');
  const legacy=buildSource.match(/const legacyBlobOpenGuard="([^"]+)";/);
  const corrected=buildSource.match(/const fixedBlobOpenGuard="([^"]+)";/);
  assert.ok(legacy&&corrected,'Build-Transformation zum Öffnen von Blob-Dateien fehlt');
  const block=baseline.slice(start,end);
  assert.ok(block.includes(legacy[1]),'Der ursprünglich zu ersetzende Guard wurde nicht gefunden');
  const transformed=block.replace(legacy[1],corrected[1]);
  assert.ok(transformed.includes('fallbackDocUsable(d)'),'Der korrigierte Guard wurde nicht eingesetzt');
  assert.equal(transformed.includes(legacy[1]),false,'Der alte URL-only-Guard ist noch aktiv');
  let opened=null,alerts=0;
  const doc={name:'Rechnung.pdf',file:{storage:'blob',blobName:'rc1059/production/ab/'+'a'.repeat(64)}};
  const sandbox={
    currentDocs:()=>[doc],
    fallbackDocUsable:d=>Boolean(d&&d.file&&d.file.storage==='blob'),
    routeViewer:(d,print)=>{opened={name:d.name,print};return true},
    alert:()=>{alerts++}
  };
  vm.runInNewContext(transformed,sandbox,{filename:'shipment-document-open.js'});
  assert.equal(sandbox.openDoc(0),true);
  assert.deepEqual(opened,{name:'Rechnung.pdf',print:false});
  assert.equal(alerts,0);
});

test('RC1616: uploaded inline Lieferscheine with real PDF data remain visible and fetchable',()=>{
 const match=buildSource.match(/const docHelpers=`([\\s\\S]*?)`;/);
 assert.ok(match);
 const inline='data:application/pdf;base64,'+Buffer.from('%PDF-1.7\\n'+'Lieferschein'.repeat(10)).toString('base64');
 const state={shipments:[{id:'S1',ref:'8LSUHW',deliveryFiles:[{id:'DNC1',name:'DNC3019222063.pdf',dataUrl:inline}]}],savedShipments:[]};
 const context={
   window:{ExportHUBDocumentBlob1059:{isBlobDocument:()=>false}},
   arr:v=>Array.isArray(v)?v:[],q:v=>String(v==null?'':v).trim(),
   low:v=>String(v==null?'':v).trim().toLowerCase(),
   refOf:sh=>String(sh&&sh.ref||'').toUpperCase(),
   idOf:sh=>String(sh&&sh.id||''),
   roots:()=>[state],state:()=>state,
   fileName:(f,backup)=>f&&f.name||backup,fileUrl:f=>f&&f.url||'',
   normalizeFallback:d=>d,collectDocs:sh=>(sh.deliveryFiles||[]).map(file=>({file,name:file.name,group:'Lieferscheine',url:''}))
 };
 vm.runInNewContext(match[1],context);
 const files=context.shipmentAssociatedDocs(state.shipments[0],[]);
 assert.ok(files.some(f=>f.name==='DNC3019222063.pdf'), 'A genuinely uploaded inline PDF must not disappear from the shipment view');
 assert.match(buildSource,/Hochgeladene PDF hat keinen gültigen PDF-Header/);
 assert.match(buildSource,/decoded\.slice\(0,5\)\.text\(\)/);
});

test('RC1616: POD document history is grouped without changing original file indices or deleting stored files',()=>{
 assert.match(buildSource,/Weitere gespeicherte POD-Versionen/);
 assert.match(buildSource,/versions\.push\(html\)/);
 assert.match(buildSource,/shown\.push\(html\)/);
 assert.match(buildSource,/docHtml\(d,i\)/,'Open/download actions must keep original index into the document array');
 assert.match(buildSource,/arr\(sh&&sh\.subShipments\)\.length<2/,'Multi-truck POD files must remain separately visible');
});
