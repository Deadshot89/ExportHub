'use strict';

// RC1666: Jede Sendung mit tatsächlich erstelltem ABD braucht einen Ausgangsvermerk (AV).
// Dies gilt sofort und rückwirkend, unabhängig von Abholung, Status und Alter.
// Eine stabile Aufgabe pro REF fasst mehrere fehlende AVs derselben Sendung zusammen.
// Nur die signierte Prüfung des echten REF-Ordners darf AV als vorhanden bestätigen.

const pickupStore=require('./pickup-store');

const AV_DUE_DAYS=Math.max(1,Math.round(Number(process.env.EXPORTHUB_AV_DUE_DAYS)||5));
const AV_LOOKBACK_DAYS=0; // RC1666: historischer Backfill ist unbegrenzt; keine 60-Tage-Ausschlüsse
const SOURCE_TYPE='av_missing';
const AREA='Ausgangsvermerk';
const DAY_MS=24*60*60*1000;

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function refOf(sh){return text(sh&&(sh.ref||sh.reference)).toUpperCase()}
function validRef(ref){return /^[A-Z0-9]{6}$/.test(ref)}
function taskId(ref){return 'task:av-missing:'+ref}
function isAvFileName(name){return /^av/i.test(text(name))}
function isAvTask(t){return !!t&&text(t.sourceType)===SOURCE_TYPE}
function isOpenTask(t){return !!t&&t.done!==true&&t.completed!==true&&!/^(erledigt|done|closed|geschlossen)$/i.test(text(t.status))}

const SHIPMENT_COLLECTIONS=['shipments','savedShipments','sharedShipments','salesSharedShipments','shipmentArchive','archivedShipments'];
function allShipments(state){
  const seen=new Map();
  for(const key of SHIPMENT_COLLECTIONS){
    for(const sh of (Array.isArray(state&&state[key])?state[key]:[])){
      const ref=refOf(sh);if(!validRef(ref))continue;
      if(!seen.has(ref))seen.set(ref,sh);
      else if(!text(seen.get(ref).id||seen.get(ref).shipmentId)&&text(sh.id||sh.shipmentId))seen.set(ref,sh);
    }
  }
  return Array.from(seen.values());
}
function shipmentCopies(state,ref){
  const copies=[];
  for(const key of SHIPMENT_COLLECTIONS){
    for(const sh of (Array.isArray(state&&state[key])?state[key]:[]))if(refOf(sh)===ref)copies.push(sh);
  }
  return copies;
}
function abdRequestsFor(state,sh){
  const sid=text(sh&&(sh.id||sh.shipmentId)),ref=refOf(sh);
  return(Array.isArray(state&&state.abdRequests)?state.abdRequests:[]).filter(r=>{
    const rid=text(r&&(r.linkedShipmentId||r.shipmentId)),rr=text(r&&(r.reference||r.ref||r.shipmentRef)).toUpperCase();
    return(sid&&rid===sid)||(ref&&rr===ref);
  });
}
function shipmentHasAbd(state,sh){
  if(!sh||typeof sh!=='object')return false;
  // Pflicht oder "Wartet auf ABD" allein beweist nicht, dass ein ABD erstellt wurde.
  return pickupStore.abdPresent(sh)||abdRequestsFor(state,sh).some(r=>pickupStore.abdPresent(r));
}

function requiredAvCount(state,sh){
  const requests=abdRequestsFor(state,sh).filter(r=>pickupStore.abdPresent(r));
  const keys=new Set(requests.map((r,i)=>text(r.id||r.requestId||r.abdReference||r.mrn)||'request-'+i));
  const ownFiles=Array.isArray(sh&&sh.abdFiles)?sh.abdFiles.filter(Boolean):[];
  return Math.max(1,keys.size,ownFiles.length);
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
  for(const sh of allShipments(state)){
    const ref=refOf(sh),copies=shipmentCopies(state,ref);
    const hasAbd=copies.some(s=>shipmentHasAbd(state,s));
    if(!hasAbd&&!openRefs.has(ref))continue;
    const day=pickupDay(sh);
    const latestCheck=copies.map(x=>text(x.avCheckedAt)).filter(Boolean).sort().pop()||'';
    out.push({reference:ref,shipmentId:text(sh.id||sh.shipmentId),pickupDay:day,
      dueDay:day?dueDay(day):'',eligible:hasAbd,requiredAvCount:hasAbd?Math.max(...copies.map(s=>requiredAvCount(state,s))):0,
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
    note:'Ausgangsvermerk (AV) zum erstellten ABD fehlt. Im REF-Ordner '+ref+' fehlt mindestens ein AV-Dokument (Dateiname beginnt mit "AV"). Dies gilt auch für ältere und noch nicht abgeholte Sendungen.\\nDie Aufgabe wird nach Prüfung der zugehörigen AV-Dokumente automatisch geschlossen.',
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
  const required=hasAbd?Math.max(...copies.map(x=>requiredAvCount(state,x))):0;
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
  return{reference:ref,status:'missing',closedTasks:0,createdTask:!existing&&!!sh,missingCount:missing};
}

// Ausschließlich der signierte Check erhält echte Graph-Dateilisten; bei Fehler keine Aufgabe.
async function checkReference(reference,listFiles){
  const files=await listFiles(reference);
  const avFiles=(Array.isArray(files)?files:[]).filter(f=>isAvFileName(f&&f.name));
  return{avFile:avFiles[0]?{name:text(avFiles[0].name)}:null,
    avFiles:avFiles.map(f=>({name:text(f.name)}))};
}

module.exports={AV_DUE_DAYS,AV_LOOKBACK_DAYS,SOURCE_TYPE,AREA,isAvFileName,isAvTask,shipmentHasAbd,requiredAvCount,allShipments,pickupDay,dueDay,candidates,applyResult,checkReference,taskId};
