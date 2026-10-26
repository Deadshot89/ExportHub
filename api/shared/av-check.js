'use strict';

// RC1666: Jede Sendung mit tatsächlich erstelltem ABD braucht einen Ausgangsvermerk (AV).
// Dies gilt sofort und rückwirkend, unabhängig von Abholung, Status und Alter.
// Eine stabile Aufgabe pro REF fasst mehrere fehlende AVs derselben Sendung zusammen.
// Nur die signierte Prüfung des echten REF-Ordners darf AV als vorhanden bestätigen.

const pickupStore=require('./pickup-store');

const AV_DUE_DAYS=0; // RC1666: Kontrolle ab tatsächlichem ABD, ohne 5-Tage-Wartefrist
const AV_LOOKBACK_DAYS=0; // RC1666: historischer Backfill ist unbegrenzt; keine 60-Tage-Ausschlüsse
const SOURCE_TYPE='av_missing';
const AREA='Ausgangsvermerk';
const DAY_MS=24*60*60*1000;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function refOf(sh){
  // Historic/archived entries use several REF field names. Prefer a valid
  // six-character ExportHUB REF over an unrelated legacy reference field.
  const keys=['ref','reference','shipmentRef','referenceNumber','referenceNo','refNo','refNr','exporthubRef','exportHubReference'];
  for(const key of keys){const ref=text(sh&&sh[key]).toUpperCase();if(validRef(ref))return ref}
  return text(sh&&(sh.ref||sh.reference)).toUpperCase();
}
function validRef(ref){return /^[A-Z0-9]{6}$/.test(ref)}
function taskId(ref){return 'task:av-missing:'+ref}
function isAvFileName(name){const n=text(name);return /^av/i.test(n)&&!/^avis/i.test(n)}
function isAvTask(t){return !!t&&text(t.sourceType)===SOURCE_TYPE}
function isOpenTask(t){return !!t&&t.done!==true&&t.completed!==true&&!/^(erledigt|done|closed|geschlossen)$/i.test(text(t.status))}

const SHIPMENT_COLLECTIONS=['shipments','savedShipments','sharedShipments','salesSharedShipments','shipmentArchive','archivedShipments','archive'];
function shipmentIndex(state){
  const index=new Map();
  for(const key of SHIPMENT_COLLECTIONS){
    const rows=state&&state[key];
    for(const sh of (Array.isArray(rows)?rows:[])){
      const ref=refOf(sh);if(!validRef(ref))continue;
      if(!index.has(ref))index.set(ref,[]);
      index.get(ref).push(sh);
    }
  }
  return index;
}
function allShipments(state){return Array.from(shipmentIndex(state).values()).map(copies=>copies[0]);}
function shipmentCopies(state,ref){return shipmentIndex(state).get(ref)||[];}
function abdRequestsFor(state,sh){
  const sid=text(sh&&(sh.id||sh.shipmentId)),ref=refOf(sh);
  return(Array.isArray(state&&state.abdRequests)?state.abdRequests:[]).filter(r=>{
    const rid=text(r&&(r.linkedShipmentId||r.shipmentId)),rr=text(r&&(r.reference||r.ref||r.shipmentRef)).toUpperCase();
    // RC1664: authoritative REF wins over a recycled technical shipment ID.
    if(ref&&rr&&rr!==ref)return false;
    return(ref&&rr===ref)||(sid&&rid===sid&&!rr);
  });
}
function shipmentHasAbd(state,sh){
  if(!sh||typeof sh!=='object')return false;
  // Pflicht oder "Wartet auf ABD" allein beweist nicht, dass ein ABD erstellt wurde.
  return pickupStore.abdPresent(sh)||abdRequestsFor(state,sh).some(r=>pickupStore.abdPresent(r));
}

function requiredAvCount(state,sh,indexedCopies){
  // Accept already indexed copies during historical scans to avoid rebuilding
  // the full shipment index once per shipment (quadratic growth).
  // A REF can occur in active, saved, shared and archived collections.
  // Count distinct ABD evidence across all copies: taking the maximum count
  // per copy would miss ABD_1 in an active copy and ABD_2 in an archived copy.
  const copies=Array.isArray(indexedCopies)?indexedCopies:shipmentCopies(state,refOf(sh));
  const sources=copies.length?copies:[sh];
  const requestKeys=new Set(),documentKeys=new Set();
  let maxUnnamed=0;
  for(const source of sources){
    for(const r of abdRequestsFor(state,source)){
      if(!pickupStore.abdPresent(r))continue;
      const key=text(r.id||r.requestId||r.abdReference||r.mrn);
      requestKeys.add(key?'request:'+key:r);
    }
    let unnamed=0;
    for(const file of (Array.isArray(source&&source.abdFiles)?source.abdFiles:[])){
      if(!file)continue;
      const key=typeof file==='string'?text(file):text(file.name||file.fileName||file.blobName||file.storageBlobName||file.storagePath||file.id);
      if(key)documentKeys.add(key.toLowerCase());
      else unnamed++;
    }
    // Missing legacy identity fields cannot safely be deduplicated;
    // keep at least the largest such group, without double-counting copies.
    maxUnnamed=Math.max(maxUnnamed,unnamed);
  }
  return Math.max(1,requestKeys.size,documentKeys.size+maxUnnamed);
}

// Historisches Abholdatum bleibt als Zusatzinformation erhalten, ist keine Voraussetzung.
function pickupDay(sh){
  if(!sh||typeof sh!=='object')return'';
  const status=lower([sh.status,sh.processStatus,sh.pickupStatus].join(' '));
  if(/teilweise/.test(status)||sh.pickupPartial===true)return'';
  const raw=text(sh.actualPickupDate||sh.pickedUpAtDate||sh.pickedUpAt||sh.pickupConfirmedAt||sh.pickupCompletedAt||sh.qrPickupConfirmedAt);
  const day=raw.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)?day:'';
}
function dueDay(day){const t=Date.parse(day+'T00:00:00Z');return isNaN(t)?'':new Date(t+AV_DUE_DAYS*DAY_MS).toISOString().slice(0,10)}
function todayOf(now){return new Date(now).toISOString().slice(0,10)}

// Die signierte AV-Prüfung nimmt ALLE historischen Sendungs-Collections mit.
// Kein Alter-/Abholfilter und keine Sperre durch ein früher einmal gesetztes avPresent.
// Batch-Reihenfolge über avCheckedAt, damit der stündliche Job den Backfill fortsetzt.
function candidates(state,now){
  const tasks=Array.isArray(state&&state.tasks)?state.tasks:[];
  const openRefs=new Set(tasks.filter(t=>isAvTask(t)&&isOpenTask(t)).map(t=>text(t.linkedShipmentRef||t.sourceRef).toUpperCase()));
  const out=[];
  for(const [ref,copies] of shipmentIndex(state)){
    const sh=copies[0];
    const hasAbd=copies.some(s=>shipmentHasAbd(state,s));
    if(!hasAbd&&!openRefs.has(ref))continue;
    const day=pickupDay(sh);
    const latestCheck=copies.map(x=>text(x.avCheckedAt)).filter(Boolean).sort().pop()||'';
    out.push({reference:ref,shipmentId:text(sh.id||sh.shipmentId),pickupDay:day,
      dueDay:day?dueDay(day):'',eligible:hasAbd,requiredAvCount:hasAbd?requiredAvCount(state,sh,copies):0,
      lastCheckedAt:latestCheck});
  }
  return out.sort((a,b)=>a.lastCheckedAt.localeCompare(b.lastCheckedAt)||a.reference.localeCompare(b.reference));
}

function missingTask(sh,nowIso){
  const ref=refOf(sh),customer=text(sh.customer&&sh.customer.name||sh.customerName),day=pickupDay(sh);
  return{
    id:taskId(ref),sourceType:SOURCE_TYPE,sourceId:ref,sourceRef:ref,
    title:'Ausgangsvermerk nicht vorhanden · '+ref+(customer?' · '+customer:''),
    area:AREA,group:AREA,status:'offen',priority:'high',manual:false,unread:true,
    owner:text(sh.customer&&sh.customer.owner)||'Tobias',
    dueDate:todayOf(nowIso),day:'',time:'',
    linkedShipmentId:text(sh.id||sh.shipmentId),linkedShipmentRef:ref,linkedCustomer:customer,
    linkedAccount:text(sh.customer&&(sh.customer.account||sh.customer.customerNumber)),
    actualPickupDate:day,
    note:'Ausgangsvermerk (AV) zum erstellten ABD fehlt. Im REF-Ordner '+ref+' fehlt mindestens ein AV-Dokument (Dateiname beginnt mit "AV"). Dies gilt auch für ältere und noch nicht abgeholte Sendungen.\nDie Aufgabe wird nach Prüfung der zugehörigen AV-Dokumente automatisch geschlossen.',
    createdAt:nowIso,updatedAt:nowIso,_syncUpdatedAt:nowIso,_syncDeviceId:'av-check'
  };
}

// Der Status wird ausschließlich nach erfolgreichem, signiertem REF-Ordner-Readback geändert.
function applyResult(state,reference,result,now){
  const ref=text(reference).toUpperCase(),nowIso=new Date(now).toISOString();
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  const copies=shipmentCopies(state,ref),sh=copies[0]||null;
  const open=state.tasks.filter(t=>isAvTask(t)&&text(t.linkedShipmentRef||t.sourceRef).toUpperCase()===ref&&isOpenTask(t));
  const avFiles=Array.isArray(result&&result.avFiles)?result.avFiles:(result&&result.avFile?[result.avFile]:[]);
  const count=avFiles.filter(f=>isAvFileName(f&&f.name)).length;
  const hasAbd=copies.some(x=>shipmentHasAbd(state,x));
  const required=hasAbd?requiredAvCount(state,sh,copies):0;
  const present=required>0&&count>=required;
  for(const copy of copies){
    copy.avPresent=present;
    copy.avDocumentName=present?text(avFiles[0]&&avFiles[0].name):'';
    copy.avCheckedAt=nowIso;
    copy.avRequiredCount=required;
    copy.avFoundCount=count;
    copy._syncUpdatedAt=nowIso;
    copy._syncDeviceId='av-check';
  }
  if(present||!hasAbd){
    for(const t of open){
      Object.assign(t,{status:'erledigt',done:true,completed:true,doneAt:nowIso,completedAt:nowIso,
        doneBy:'AV-Prüfung',completedBy:'AV-Prüfung',autoCompletedByAvCheck:true,
        updatedAt:nowIso,_syncUpdatedAt:nowIso,_syncDeviceId:'av-check'});
    }
    return{reference:ref,status:present?'present':'not-required',closedTasks:open.length,createdTask:false};
  }
  const missing=Math.max(1,required-count);
  const id=taskId(ref),existing=state.tasks.find(t=>text(t&&t.id)===id);
  const reopenedTask=!!existing&&!isOpenTask(existing);
  if(existing){
    Object.assign(existing,{status:'offen',done:false,completed:false,doneAt:'',completedAt:'',
      doneBy:'',completedBy:'',autoCompletedByAvCheck:false,unread:!isOpenTask(existing)||existing.unread===true,
      avMissingCount:missing,avRequiredCount:required,avFoundCount:count,
      updatedAt:nowIso,_syncUpdatedAt:nowIso,_syncDeviceId:'av-check'});
  }else if(sh){
    const task=missingTask(sh,nowIso);
    task.avMissingCount=missing;task.avRequiredCount=required;task.avFoundCount=count;
    state.tasks.unshift(task);
  }
  return{reference:ref,status:'missing',closedTasks:0,createdTask:!existing&&!!sh,reopenedTask,missingCount:missing};
}

// Ausschließlich der signierte Check erhält echte Graph-Dateilisten; bei Fehler keine Aufgabe.
async function checkReference(reference,listFiles){
  const files=await listFiles(reference);
  // An unexpected Graph response is not evidence that the folder is empty.
  // Failing closed avoids creating false "AV fehlt" tasks on malformed reads.
  if(!Array.isArray(files)){
    const e=new Error('Der REF-Ordner lieferte keine gültige Dateiliste.');
    e.code='GRAPH_REFERENCE_FOLDER_LIST_INVALID';
    throw e;
  }
  const avFiles=files.filter(f=>isAvFileName(f&&f.name));
  return{avFile:avFiles[0]?{name:text(avFiles[0].name)}:null,
    avFiles:avFiles.map(f=>({name:text(f.name)}))};
}

module.exports={AV_DUE_DAYS,AV_LOOKBACK_DAYS,SOURCE_TYPE,AREA,isAvFileName,isAvTask,shipmentHasAbd,requiredAvCount,allShipments,pickupDay,dueDay,candidates,applyResult,checkReference,taskId};
