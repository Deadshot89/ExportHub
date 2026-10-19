'use strict';

// Ausgangsvermerk-Prüfung: Jede abgeholte Sendung mit ABD braucht ein AV-Dokument
// (Dateiname beginnt mit "AV") im REF-Ordner. Fehlt es AV_DUE_DAYS Kalendertage nach
// der Abholung, entsteht genau eine offene Aufgabe pro REF; sie schließt sich,
// sobald das Dokument im Ordner liegt.

const pickupStore=require('./pickup-store');

const AV_DUE_DAYS=Math.max(1,Math.round(Number(process.env.EXPORTHUB_AV_DUE_DAYS)||5));
const AV_LOOKBACK_DAYS=Math.max(AV_DUE_DAYS,Math.round(Number(process.env.EXPORTHUB_AV_LOOKBACK_DAYS)||60));
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

function abdRequestsFor(state,sh){
  const sid=text(sh&&(sh.id||sh.shipmentId)),ref=refOf(sh);
  return(Array.isArray(state&&state.abdRequests)?state.abdRequests:[]).filter(r=>{
    const rid=text(r&&(r.linkedShipmentId||r.shipmentId)),rr=text(r&&(r.reference||r.ref||r.shipmentRef)).toUpperCase();
    return(sid&&rid===sid)||(ref&&rr===ref);
  });
}
function shipmentHasAbd(state,sh){
  if(!sh||typeof sh!=='object')return false;
  if(sh.abdRequired===false)return false;
  if(sh.abdRequired===true)return true;
  return pickupStore.abdPresent(sh)||abdRequestsFor(state,sh).some(r=>pickupStore.abdPresent(r));
}

// Liefert das Abholdatum (YYYY-MM-DD) einer vollständig abgeholten Sendung, sonst ''.
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

// Sendungen, deren REF-Ordner jetzt geprüft werden muss: fällige ABD-Sendungen ohne
// bestätigtes AV sowie alle REFs mit offener AV-Aufgabe (für das automatische Schließen).
function candidates(state,now){
  const today=todayOf(now),oldest=new Date(Date.parse(today+'T00:00:00Z')-AV_LOOKBACK_DAYS*DAY_MS).toISOString().slice(0,10);
  const shipments=Array.isArray(state&&state.shipments)?state.shipments:[],tasks=Array.isArray(state&&state.tasks)?state.tasks:[];
  const openRefs=new Set(tasks.filter(t=>isAvTask(t)&&isOpenTask(t)).map(t=>text(t.linkedShipmentRef).toUpperCase()));
  const out=[],seen=new Set();
  for(const sh of shipments){
    const ref=refOf(sh);if(!validRef(ref)||seen.has(ref))continue;
    if(sh.avPresent===true&&!openRefs.has(ref))continue;
    const day=pickupDay(sh),due=day&&dueDay(day);
    const eligible=!!day&&shipmentHasAbd(state,sh)&&due<=today&&day>=oldest;
    if(!eligible&&!openRefs.has(ref))continue;
    seen.add(ref);out.push({reference:ref,shipmentId:text(sh.id||sh.shipmentId),pickupDay:day,dueDay:due,eligible,lastCheckedAt:text(sh.avCheckedAt)});
  }
  // Am längsten nicht geprüfte REFs zuerst, damit begrenzte Läufe reihum alle erreichen.
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
    note:'Ausgangsvermerk (AV) zum ABD fehlt. Automatisch erstellt: Im REF-Ordner '+ref+' liegt '+AV_DUE_DAYS+' Tage nach der Abholung ('+(day||'unbekannt')+') kein Dokument, dessen Name mit "AV" beginnt.\nDie Aufgabe schließt sich automatisch, sobald der Ausgangsvermerk im REF-Ordner liegt.',
    createdAt:nowIso,updatedAt:nowIso,_syncUpdatedAt:nowIso,_syncDeviceId:'av-check'
  };
}

// Wendet das Prüfergebnis für eine REF auf den Team-State an. Mutiert state.
// result: {avFile:{name}|null}. Rückgabe beschreibt die Änderung.
function applyResult(state,reference,result,now){
  const ref=text(reference).toUpperCase(),nowIso=new Date(now).toISOString();
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  const shipments=Array.isArray(state.shipments)?state.shipments:[];
  const sh=shipments.find(x=>refOf(x)===ref)||null;
  const open=state.tasks.filter(t=>isAvTask(t)&&text(t.linkedShipmentRef).toUpperCase()===ref&&isOpenTask(t));
  const avFile=result&&result.avFile;
  if(avFile){
    if(sh){sh.avPresent=true;sh.avDocumentName=text(avFile.name);sh.avCheckedAt=nowIso;sh._syncUpdatedAt=nowIso;sh._syncDeviceId='av-check'}
    for(const t of open){t.status='erledigt';t.done=true;t.completed=true;t.doneAt=nowIso;t.completedAt=nowIso;t.doneBy='AV-Prüfung';t.completedBy='AV-Prüfung';t.autoCompletedByAvCheck=true;t.updatedAt=nowIso;t._syncUpdatedAt=nowIso;t._syncDeviceId='av-check'}
    return{reference:ref,status:'present',closedTasks:open.length,createdTask:false};
  }
  if(sh){sh.avPresent=false;sh.avCheckedAt=nowIso}
  const day=sh&&pickupDay(sh);
  if(open.length||!sh||!day||!shipmentHasAbd(state,sh)||dueDay(day)>todayOf(now))return{reference:ref,status:'missing',closedTasks:0,createdTask:false};
  const id=taskId(ref),existing=state.tasks.find(t=>text(t&&t.id)===id);
  if(existing){
    // Früher erledigte Aufgabe, aber das AV fehlt (wieder): dieselbe Aufgabe neu öffnen.
    Object.assign(existing,{status:'offen',done:false,completed:false,doneAt:'',completedAt:'',doneBy:'',completedBy:'',autoCompletedByAvCheck:false,unread:true,updatedAt:nowIso,_syncUpdatedAt:nowIso,_syncDeviceId:'av-check'});
  }else state.tasks.unshift(missingTask(sh,nowIso));
  return{reference:ref,status:'missing',closedTasks:0,createdTask:true};
}

// Prüft einen REF-Ordner. listFiles(ref) liefert [{name}] oder wirft; ein fehlender
// Ordner ist eine leere Liste.
async function checkReference(reference,listFiles){
  const files=await listFiles(reference);
  const avFile=(Array.isArray(files)?files:[]).find(f=>isAvFileName(f&&f.name))||null;
  return{avFile:avFile?{name:text(avFile.name)}:null};
}

module.exports={AV_DUE_DAYS,AV_LOOKBACK_DAYS,SOURCE_TYPE,AREA,isAvFileName,isAvTask,shipmentHasAbd,pickupDay,dueDay,candidates,applyResult,checkReference,taskId};
