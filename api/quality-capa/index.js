'use strict';
/* ExportHUB360 – Qualitätsabweichungen und Korrekturmaßnahmen (CAPA).
 * Separate API actions, authenticated and stored outside the shared team state.
 * No external AI requests or new paid services.
 */
const crypto=require('node:crypto');
const auth=require('../shared/auth-store');
const apiI18n=require('../shared/i18n');
const qmAi=require('../shared/qm-ai');
const qmPatterns=require('../shared/qm-patterns');
const {BlobServiceClient}=require('@azure/storage-blob');
const {isolationConfig,primaryConnection}=require('../shared/testservice-auth-isolation');
const STATUSES=['offen','ursachenanalyse','massnahme','wirksamkeitspruefung','abgeschlossen'];
const CATEGORIES=['versand','verladung','dokumente','zoll','kunde','qualitaet','umwelt','arbeitsschutz','sonstiges'];
const SEVERITIES=['niedrig','mittel','hoch','kritisch'];
const MAX_CASES=2000;
function str(v,max=2000){return String(v==null?'':v).trim().slice(0,max)}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)}}
function err(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){throw err('INVALID_JSON','Ungültige Anfrage')}}
function rights(user){return user&&user.rights&&user.rights.sop||{}}
function canRead(user){const r=rights(user);return auth.isAdmin(user)||r.read===true||r.visible===true||['view','edit','admin'].includes(str(r.level,12))}
function canEdit(user){const r=rights(user);return auth.isAdmin(user)||r.edit===true||r.admin===true||r.functionAdmin===true||['edit','admin'].includes(str(r.level,12))}
function canClose(user){const r=rights(user);return auth.isAdmin(user)||r.admin===true||r.functionAdmin===true||str(r.level,12)==='admin'}
function requireRight(valid,kind){if(!valid)throw err('FORBIDDEN','Keine Berechtigung für '+kind,403)}
function date(v){const s=str(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return'';const d=new Date(s+'T00:00:00.000Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:''}
function userKey(u){return str(u&&(u.user||u.login||u.username||u.name),120).toLowerCase()}
function actor(u){return str(u&&(u.name||u.user||u.username||u.login),120)||'Benutzer'}
/* CAPA records do not belong in shared team.state: that state is readable by unrelated
 * ExportHUB functions. Use a private, environment-separated Blob guarded by this API. */
function qualityContainer(environment){
 const test=environment==='testservice',isolated=test?isolationConfig():{enabled:false};
 const connection=test&&isolated.enabled?isolated.connectionString:primaryConnection(process.env);
 if(!connection)throw err('STORAGE_NOT_CONFIGURED','Qualitätsspeicher nicht konfiguriert',503);
 const container=test&&isolated.enabled?isolated.container:auth.TEAM_CONTAINER;
 return {container:BlobServiceClient.fromConnectionString(connection).getContainerClient(container),prefix:test?'testservice/':''};
}
function aiUsageStore(environment){
 const q=qualityContainer(environment),blob=q.container.getBlockBlobClient(q.prefix+'quality/ai-usage.json');
 return{read:()=>auth.readJson(blob,{schemaVersion:1,days:{},log:[]},{missingBlobOnly:true}),write:(value,etag)=>auth.writeJson(blob,value,etag)}
}
function recordsClient(environment){const q=qualityContainer(environment);return q.container.getBlockBlobClient(q.prefix+'quality/capa-cases.json')}
function recordsOf(doc){
 if(!doc||doc.schemaVersion!==1||!Array.isArray(doc.items)||!doc.items.every(item=>item&&typeof item.id==='string'&&item.id.startsWith('QM-')&&Number.isInteger(item.revision)&&item.revision>=1&&Array.isArray(item.history)))
  throw err('STORAGE_DATA_INVALID','QM-Daten sind unvollständig oder beschädigt. Speichern gesperrt, um Datenverlust zu verhindern.',503);
 return doc.items;
}
function validatedSnapshot(snapshot){
 const records=recordsOf(snapshot&&snapshot.value);
 // The shared JSON reader treats a stored JSON null as a default value.
 // Existing CAPA blobs must have been written with revision >= 1;
 // never overwrite an existing null/corrupted blob as though it were new.
 const revision=snapshot&&snapshot.value&&snapshot.value.revision;
 if(!Number.isSafeInteger(revision)||revision<0||(snapshot.etag&&revision<1))
  throw err('STORAGE_DATA_INVALID','QM-Daten sind unvollständig oder beschädigt. Speichern gesperrt, um Datenverlust zu verhindern.',503);
 return records;
}
async function readRecords(env){
 const snapshot=await auth.readJson(recordsClient(env),{schemaVersion:1,revision:0,items:[]},{missingBlobOnly:true});
 validatedSnapshot(snapshot);
 return snapshot;
}
async function mutateRecords(env,updater){
 const blob=recordsClient(env);
 for(let n=0;n<7;n++){
  const previous=await auth.readJson(blob,{schemaVersion:1,revision:0,items:[]},{missingBlobOnly:true});
  const result=updater(validatedSnapshot(previous).slice());
  const next={schemaVersion:1,revision:Number(previous.value.revision||0)+1,updatedAt:new Date().toISOString(),items:result.items};
  try{await auth.writeJson(blob,next,previous.etag);return result.item}
  catch(e){if(e&&[409,412].includes(e.statusCode)&&n<6)continue;throw e}
 }
 throw err('CONCURRENT_UPDATE','Gleichzeitige Änderung. Bitte neu laden.',409);
}
function cleanPatch(p){const allowed={
 title:180,description:4000,area:120,reference:120,impact:1500,immediateAction:2000,
 rootCause:2000,correctiveAction:2000,preventiveAction:2000,owner:120,
 evidence:2000,effectivenessEvidence:2000
 },o={};
 for(const [k,n] of Object.entries(allowed))if(Object.prototype.hasOwnProperty.call(p,k))o[k]=str(p[k],n);
 for(const key of ['occurredOn','dueDate','verifiedOn'])if(Object.prototype.hasOwnProperty.call(p,key)){
  if(p[key]&&!date(p[key]))throw err('INVALID_DATE','Datum ungültig: '+key);
  o[key]=date(p[key]);
 }
 for(const [key,values] of [['category',CATEGORIES],['severity',SEVERITIES]]){
  if(Object.prototype.hasOwnProperty.call(p,key)){const val=str(p[key],30);if(!values.includes(val))throw err('INVALID_ENUM','Ungültige Auswahl: '+key);o[key]=val}
 }
 if(Object.prototype.hasOwnProperty.call(p,'effectivenessResult')){
  const result=str(p.effectivenessResult,30);if(!['','offen','wirksam','unwirksam'].includes(result))throw err('INVALID_ENUM','Ungültige Wirksamkeitsbewertung');
  o.effectivenessResult=result;
 }
 return o;
}

function relatedCases(p,items){
 const stop=new Set(['fehler','falsch','wurde','haben','einer','einem','einen','durch','wegen','nicht','beim','beim','wieder','erneut','fehlt','fehlte','lieferung','sendung']);
 const words=v=>new Set((str(v,2500).toLowerCase().match(/[a-zäöüß0-9]{4,}/g)||[]).filter(w=>!stop.has(w)));
 const own=words([p.title,p.description,p.rootCause].join(' '));
 return (Array.isArray(items)?items:[]).filter(x=>x&&x.id!==p.id).map(x=>{
  const similar=words([x.title,x.description,x.rootCause].join(' '));
  let overlap=0;for(const w of own)if(similar.has(w))overlap++;
  const sameCategory=p.category&&p.category===x.category;
  const sameRef=p.reference&&x.reference&&str(p.reference,120).toLowerCase()===str(x.reference,120).toLowerCase();
  const sameArea=p.area&&x.area&&str(p.area,120).toLowerCase()===str(x.area,120).toLowerCase();
  const score=(sameCategory?2:0)+(sameRef?5:0)+(sameArea?1:0)+Math.min(overlap,5)*2;
  return {case:x,score,overlap,sameRef};
 }).filter(x=>x.score>=4&&(x.overlap>=1||x.sameRef)).sort((a,b)=>b.score-a.score||String(b.case.updatedAt||'').localeCompare(String(a.case.updatedAt||''))).slice(0,5).map(x=>({
  id:x.case.id,title:str(x.case.title,180),status:x.case.status,category:x.case.category,
  outcome:x.case.status==='abgeschlossen'&&x.case.effectivenessResult==='wirksam'?'wirksam':'noch nicht bestätigt',
  verifiedMeasure:x.case.status==='abgeschlossen'&&x.case.effectivenessResult==='wirksam'?str(x.case.correctiveAction,500):''
 }));
}

function advice(p){
 const text=[p.title,p.description,p.impact,p.rootCause,p.immediateAction].map(v=>str(v,4000)).join(' ').toLowerCase();
 const out=[
  {priority:'sofort',title:'Auswirkung begrenzen',detail:'Betroffene Sendungen, Dokumente und Kunden feststellen. Weitere Fehler verhindern; gegebenenfalls Verladung oder Versand bis zur Klärung stoppen.'},
  {priority:'analyse',title:'Ursache mit 5 Warum prüfen',detail:'Nicht bei „Mitarbeiterfehler“ stehen bleiben: Arbeitsablauf, Prüfschritte, Hilfsmittel, System und Schulung einzeln untersuchen.'},
  {priority:'nachhaltig',title:'Wirksamkeit nachweisen',detail:'Prüfkriterium, Verantwortlichen und Termin festlegen. Nach Umsetzung anhand realer Vorgänge prüfen, ob die Abweichung erneut auftritt.'}
 ];
 if(/palette|palett|verlad|falsch.*lad|colli|paket/.test(text))out.splice(1,0,{priority:'praevention',title:'Verladefreigabe absichern',detail:'Referenz und Colli-Anzahl vor Beladung mit Sendung und Ladeliste abgleichen. Bei kritischen Sendungen zweite Kontrolle dokumentieren.'});
 if(/dokument|lieferschein|cmr|abd|zoll|pdf|rechnung|falsch.*kund/.test(text))out.splice(1,0,{priority:'praevention',title:'Dokumentkontrolle verbessern',detail:'Empfänger, Referenz, Dokumentart und Versandfreigabe vor dem Versenden prüfen; bei wiederkehrenden Fehlern eine verpflichtende Checkliste in der SOP ergänzen.'});
 if(/umwelt|abfall|verpackung|entsorg|energie|transport/.test(text))out.splice(1,0,{priority:'umwelt',title:'Umweltfolgen bewerten',detail:'Zusätzliche Transportwege, Verpackungsabfall und Ressourceneinsatz erfassen. Abstellmaßnahme auch auf Umweltwirkung prüfen.'});
 if(/wieder|erneut|mehrfach|regelmässig|regelmäßig|häufig/.test(text))out.push({priority:'system',title:'Wiederholungsfehler systematisch behandeln',detail:'Frühere Fälle derselben Ursache vergleichen. Prozess, Prüfpunkt oder IT-Sperre verbessern und die Änderung in die Unterweisung aufnehmen.'});
 if(p.severity==='kritisch'||p.severity==='hoch')out.unshift({priority:'sofort',title:'Verantwortliche sofort informieren',detail:'Bei erheblicher Kunden-, Sicherheits- oder Umweltwirkung die zuständige Führungskraft einbeziehen und die Eskalation festhalten.'});
 return out.slice(0,7);
}
/* Manipulationssicherer Verlauf: jeder Eintrag trägt seq, prevHash und hash (SHA-256 über den Inhalt und den Vorgänger).
 * Alt-Einträge ohne Hash bleiben als Präfix zulässig (prevHash des ersten verketteten Eintrags = 'LEGACY'). */
const MAX_HISTORY=500;
function eventHash(e){return crypto.createHash('sha256').update(JSON.stringify([e.seq,e.at,e.action,e.actor,e.notes,e.changedFields,e.prevHash])).digest('hex')}
function verifyChain(history){
 const list=Array.isArray(history)?history:[];let legacy=0;
 while(legacy<list.length&&!list[legacy].hash)legacy++;
 let prev=legacy?'LEGACY':'GENESIS';
 for(let i=legacy;i<list.length;i++){
  const e=list[i];
  if(!e||e.seq!==i+1||e.prevHash!==prev||e.hash!==eventHash(e))return{ok:false,brokenAt:i+1,legacy};
  prev=e.hash;
 }
 return{ok:true,brokenAt:0,legacy};
}
function requireIntactHistory(item){if(!verifyChain(item.history).ok)throw err('HISTORY_BROKEN','Der Verlauf dieses Falls ist nicht integer. Änderungen sind gesperrt, bis die Leitung den Fall geprüft hat.',409)}
function withIntegrity(item){return Object.assign({},item,{historyIntegrity:verifyChain(item.history),attachments:publicAttachments(item)})}
function event(caseItem,action,user,notes,changedFields){
 caseItem.history=Array.isArray(caseItem.history)?caseItem.history:[];
 if(caseItem.history.length>=MAX_HISTORY)throw err('HISTORY_LIMIT','Der Verlauf dieses Falls hat die Höchstzahl erreicht. Bitte einen Folgefall anlegen.',409);
 const last=caseItem.history[caseItem.history.length-1];
 const e={seq:caseItem.history.length+1,at:new Date().toISOString(),action,actor:actor(user),notes:str(notes,300),changedFields:Array.isArray(changedFields)?changedFields.slice(0,32):[],prevHash:last&&last.hash?last.hash:(last?'LEGACY':'GENESIS')};
 e.hash=eventHash(e);caseItem.history.push(e)
}
function newCase(data,user){const patch=cleanPatch(data);if(!patch.title||!patch.description)throw err('REQUIRED','Titel und Fehlerbeschreibung sind Pflicht');const now=new Date().toISOString();
 const item=Object.assign({id:'QM-'+now.slice(0,10).replace(/-/g,'')+'-'+crypto.randomBytes(4).toString('hex').toUpperCase(),revision:1,createdAt:now,updatedAt:now,createdBy:actor(user),createdByUser:userKey(user),status:'offen',category:'sonstiges',severity:'mittel',occurredOn:now.slice(0,10),title:'',description:'',area:'',reference:'',impact:'',immediateAction:'',rootCause:'',correctiveAction:'',preventiveAction:'',owner:'',dueDate:'',evidence:'',effectivenessResult:'',effectivenessEvidence:'',verifiedOn:'',verifiedBy:'',closedAt:'',history:[]},patch);
 event(item,'ANGELEGT',user,'Abweichung erfasst');return item}
function updateCase(item,p,user){requireIntactHistory(item);if(item.status==='abgeschlossen')throw err('CLOSED','Abgeschlossenen Fall zuerst wieder öffnen',409);
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Der Fall wurde inzwischen verändert. Bitte neu laden.',409);
 const patch=cleanPatch(p),before=Object.assign({},item);Object.assign(item,patch);
 if(!item.title||!item.description)throw err('REQUIRED','Titel und Fehlerbeschreibung sind Pflicht');
 if(Object.prototype.hasOwnProperty.call(p,'status')){
  const status=str(p.status,40);
  if(!STATUSES.slice(0,-1).includes(status))throw err('INVALID_STATUS','Statuswechsel nicht erlaubt');
  item.status=status;
 }
 const changedFields=Object.keys(patch).filter(k=>String(before[k]==null?'':before[k])!==String(item[k]==null?'':item[k]));
 // A changed root cause or measure invalidates the previous effectiveness proof.
 // This must happen even if a browser sends old verified values in the same update.
 const measureRevised=['rootCause','correctiveAction','preventiveAction'].some(k=>changedFields.includes(k));
 if(measureRevised && (before.effectivenessResult==='wirksam'||before.effectivenessResult==='unwirksam')){
  item.effectivenessResult='offen';item.effectivenessEvidence='';item.verifiedOn='';item.verifiedBy='';
  for(const field of ['effectivenessResult','effectivenessEvidence','verifiedOn'])if(!changedFields.includes(field))changedFields.push(field);
  if(item.status==='wirksamkeitspruefung')item.status=changedFields.includes('rootCause')?'ursachenanalyse':'massnahme';
 }
 if(before.status!==item.status&&!changedFields.includes('status'))changedFields.push('status');
 item.revision++;item.updatedAt=new Date().toISOString();event(item,'AKTUALISIERT',user,str(p.changeNote,300),changedFields);return item}
function closeCase(item,p,user){
 requireIntactHistory(item);
 if(item.status==='abgeschlossen')throw err('CLOSED','Fall bereits abgeschlossen',409);
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Fall wurde zwischenzeitlich geändert',409);
 if(!str(item.rootCause)||!str(item.correctiveAction)||!str(item.effectivenessEvidence)||item.effectivenessResult!=='wirksam'||!date(item.verifiedOn)||item.verifiedOn>new Date().toISOString().slice(0,10))
  throw err('CLOSE_INCOMPLETE','Abschluss erst nach Ursache, Abstellmaßnahme und dokumentiert wirksamer Prüfung möglich',422);
 item.status='abgeschlossen';item.closedAt=new Date().toISOString();item.updatedAt=item.closedAt;item.verifiedBy=actor(user);item.revision++;
 event(item,'ABGESCHLOSSEN',user,'Wirksamkeit bestätigt');return item
}
function reopenCase(item,p,user){
 requireIntactHistory(item);
 if(item.status!=='abgeschlossen')throw err('STATUS','Nur abgeschlossene Fälle können erneut geöffnet werden',409);
 const reason=str(p.reason,500);if(reason.length<8)throw err('REASON','Bitte einen nachvollziehbaren Grund für das Wiederöffnen angeben');
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Fall wurde zwischenzeitlich geändert',409);
 item.status='ursachenanalyse';item.closedAt='';item.effectivenessResult='offen';item.effectivenessEvidence='';item.verifiedOn='';item.verifiedBy='';item.updatedAt=new Date().toISOString();item.revision++;event(item,'WIEDEREROEFFNET',user,reason);return item
}
/* Anhänge: PDF/JPG/PNG als Nachweis. Dateien liegen im privaten QM-Speicher (nicht im Team-State), im Fall stehen nur
 * Metadaten und der SHA-256. Beim Herunterladen wird der Hash erneut geprüft. */
const ATTACH_TYPES={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'};
const MAX_ATTACH_BYTES=15*1024*1024,MAX_ATTACHMENTS=10;
function attachSignatureOk(ext,b){
 if(ext==='.pdf')return b.length>=5&&b.subarray(0,5).toString('ascii')==='%PDF-';
 if(ext==='.jpg'||ext==='.jpeg')return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
 if(ext==='.png')return b.length>=8&&b.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
 return false
}
function parseAttachment(p){
 const base=str(p&&(p.fileName||p.name),300).split(/[\\/]/).pop();
 const name=base.replace(/[\\/:*?"<>|\r\n]+/g,'_').replace(/\s+/g,' ').trim().slice(0,120);
 const ext=((name.toLowerCase().match(/(\.[a-z0-9]+)$/)||[])[1])||'';
 const mime=ATTACH_TYPES[ext];
 if(!name||!mime)throw err('ATTACH_TYPE','Nur PDF, JPG oder PNG sind als Anhang erlaubt',400);
 const raw=String(p&&p.data||'').replace(/^data:[^,]*,/,'').replace(/\s+/g,'');
 if(raw.length>Math.ceil(MAX_ATTACH_BYTES/3)*4+8)throw err('ATTACH_SIZE','Der Anhang ist größer als 15 MB',413);
 if(!raw||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))throw err('ATTACH_EMPTY','Der Anhang ist leer oder ungültig',400);
 const buffer=Buffer.from(raw,'base64');
 if(!buffer.length)throw err('ATTACH_EMPTY','Der Anhang ist leer oder ungültig',400);
 if(buffer.length>MAX_ATTACH_BYTES)throw err('ATTACH_SIZE','Der Anhang ist größer als 15 MB',413);
 if(!attachSignatureOk(ext,buffer))throw err('ATTACH_CONTENT','Der Dateiinhalt passt nicht zum Dateityp',400);
 const sha256=crypto.createHash('sha256').update(buffer).digest('hex');
 return{id:sha256.slice(0,16),name,mime,size:buffer.length,sha256,ext,buffer}
}
function verifyAttachmentBytes(meta,buffer){return !!meta&&Buffer.isBuffer(buffer)&&crypto.createHash('sha256').update(buffer).digest('hex')===meta.sha256}
function canAttach(item,user){return canEdit(user)||!!(item&&item.createdByUser&&item.createdByUser===userKey(user)&&item.status==='offen')}
function addAttachment(item,a,user){
 requireIntactHistory(item);
 if(item.status==='abgeschlossen')throw err('CLOSED','Der Fall ist abgeschlossen. Zum Anhängen bitte zuerst wieder öffnen',409);
 item.attachments=Array.isArray(item.attachments)?item.attachments:[];
 if(item.attachments.some(x=>x.sha256===a.sha256))return item;
 if(item.attachments.length>=MAX_ATTACHMENTS)throw err('ATTACH_LIMIT','Je Fall sind höchstens '+MAX_ATTACHMENTS+' Anhänge möglich',409);
 const at=new Date().toISOString();
 item.attachments.push({id:a.id,name:a.name,mime:a.mime,size:a.size,sha256:a.sha256,blobPath:'quality/attachments/'+item.id+'/'+a.sha256+a.ext,uploadedAt:at,uploadedBy:actor(user)});
 event(item,'ANHANG',user,a.name);item.revision++;item.updatedAt=at;return item
}
function publicAttachments(item){return(Array.isArray(item.attachments)?item.attachments:[]).map(x=>({id:x.id,name:x.name,mime:x.mime,size:x.size,sha256:x.sha256,uploadedAt:x.uploadedAt,uploadedBy:x.uploadedBy}))}
/* Meldung für jeden angemeldeten Mitarbeiter: nur Meldefelder, Status immer 'offen', höchstens 20 Meldungen je Benutzer und 24 h. */
const REPORT_FIELDS=['title','description','category','severity','occurredOn','area','reference','impact','immediateAction'];
const MAX_REPORTS_PER_DAY=20;
function reportCase(data,user,items){
 const key=userKey(user),since=Date.now()-24*3600*1000;
 const recent=(Array.isArray(items)?items:[]).filter(x=>x&&x.createdByUser===key&&Date.parse(x.createdAt)>=since).length;
 if(recent>=MAX_REPORTS_PER_DAY)throw err('REPORT_LIMIT','Zu viele Meldungen in 24 Stunden. Bitte die Leitung ansprechen.',429);
 const picked={};for(const k of REPORT_FIELDS)if(data&&Object.prototype.hasOwnProperty.call(data,k))picked[k]=data[k];
 const item=newCase(picked,user);
 item.history=[];event(item,'GEMELDET',user,'Abweichung gemeldet');
 return item
}
function addReportNote(item,p,user){
 if(!item.createdByUser||item.createdByUser!==userKey(user))throw err('FORBIDDEN','Ergänzungen sind nur zur eigenen Meldung möglich',403);
 if(item.status!=='offen')throw err('STATUS','Die Meldung ist nicht mehr offen, sondern in Bearbeitung, und nur noch durch die Leitung änderbar',409);
 const note=str(p&&p.note,300);if(!note)throw err('REQUIRED','Bitte eine Ergänzung eingeben');
 requireIntactHistory(item);
 event(item,'ERGAENZT',user,note);item.revision++;item.updatedAt=new Date().toISOString();return item
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD',message:'Nur POST erlaubt'});return}
 try{
  const payload=body(req);const current=await auth.validateSession(req),user=current.user;
  const action=str(payload.action||'list',30).toLowerCase(),env=auth.environmentFromRequest(req);
  if(action==='attach'){
   const file=parseAttachment(payload),id=str(payload.id,50);
   const found=recordsOf((await readRecords(env)).value).find(x=>x.id===id);
   if(!found)throw err('NOT_FOUND','Fall nicht gefunden',404);
   requireRight(canAttach(found,user),'Anhänge zu diesem Fall');
   const q=qualityContainer(env),path='quality/attachments/'+found.id+'/'+file.sha256+file.ext;
   await q.container.getBlockBlobClient(q.prefix+path).uploadData(file.buffer,{blobHTTPHeaders:{blobContentType:file.mime}});
   const saved=await mutateRecords(env,items=>{
    const idx=items.findIndex(x=>x.id===id);if(idx<0)throw err('NOT_FOUND','Fall nicht gefunden',404);
    const item=JSON.parse(JSON.stringify(items[idx]));requireRight(canAttach(item,user),'Anhänge zu diesem Fall');
    addAttachment(item,file,user);items[idx]=item;return {items,item};
   });
   context.res=json(200,{ok:true,id:saved.id,attachments:publicAttachments(saved)});return}
  if(action==='report'||action==='report-note'){
   const saved=await mutateRecords(env,items=>{
    let item;
    if(action==='report'){if(items.length>=MAX_CASES)throw err('LIMIT','Maximale Fallzahl erreicht; Archivierung prüfen',409);item=reportCase(payload,user,items);items.unshift(item)}
    else{const idx=items.findIndex(x=>x.id===str(payload.id,50));if(idx<0)throw err('NOT_FOUND','Fall nicht gefunden',404);item=JSON.parse(JSON.stringify(items[idx]));addReportNote(item,payload,user);items[idx]=item}
    return {items,item};
   });
   // Melder ohne Leserecht erhalten nur die Fallnummer zurück, keine fremden Daten.
   context.res=json(200,{ok:true,id:saved.id,environment:env});return}
  requireRight(canRead(user),'Qualitätsabweichungen');
  if(action==='attachment'){
   const item=recordsOf((await readRecords(env)).value).find(x=>x.id===str(payload.id,50));
   const meta=item&&(item.attachments||[]).find(x=>x.id===str(payload.attachmentId,40));
   if(!meta)throw err('NOT_FOUND','Anhang nicht gefunden',404);
   const q=qualityContainer(env),buffer=await q.container.getBlockBlobClient(q.prefix+meta.blobPath).downloadToBuffer();
   if(!verifyAttachmentBytes(meta,buffer))throw err('ATTACH_INTEGRITY','Der Anhang stimmt nicht mehr mit dem gespeicherten Prüfwert überein',409);
   context.res={status:200,isRaw:true,headers:{'Content-Type':meta.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:buffer};return}
  if(action==='list'){const records=await readRecords(env),items=recordsOf(records.value);context.res=json(200,{ok:true,items:items.map(withIntegrity),environment:env,canEdit:canEdit(user),canClose:canClose(user)});return}
  if(action==='patterns'){
   // Reine Berechnung über die gespeicherten Fälle: nur lesend, keine KI, keine Kosten.
   const days=[30,90,365,0].includes(Number(payload.days))?Number(payload.days):90;
   const cases=recordsOf((await readRecords(env)).value);
   context.res=json(200,{ok:true,patterns:qmPatterns.analyze(cases,{days}),environment:env});return}
  if(action==='ai-case'){
   // KI-Tipps (Gemini): nur lesend, ändert keinen Fall und speichert keinen KI-Text. Bei jedem Problem Rückfall auf die Regeln.
   const cases=recordsOf((await readRecords(env)).value),item=cases.find(x=>x.id===str(payload.id,50));
   if(!item)throw err('NOT_FOUND','Fall nicht gefunden',404);
   const cfg=qmAi.resolveConfig(process.env),lang=str(payload.language,5).toLowerCase(),language=Object.prototype.hasOwnProperty.call(qmAi.LANGUAGES,lang)?lang:'de';
   const fallback=(reason,providerStatus,detail)=>{context.res=json(200,{ok:true,mode:'regelbasiert',fallbackReason:reason,providerStatus:Number(providerStatus)||0,providerDetail:str(detail,40),suggestions:advice(item),relatedCases:relatedCases(item,cases),notice:'Regelbasierte Entscheidungshilfe – die KI ist gerade nicht verfügbar.'})};
   if(!cfg.enabled){fallback('not_configured');return}
   let quota;try{quota=await qmAi.consumeQuota(aiUsageStore(env),cfg,userKey(user),item.id)}catch(_){fallback('busy');return}
   if(!quota.allowed){fallback(quota.reason);return}
   const answer=await qmAi.askGemini({config:cfg,item,language});
   if(!answer.ok){
    // Fehlgeschlagene Aufrufe zählen nicht aufs Limit; bei erschöpftem Google-Kontingent (429) gibt es keine Gutschrift.
    if(answer.reason!=='busy'){try{await qmAi.refundQuota(aiUsageStore(env),cfg,userKey(user),quota.at)}catch(_){/* Gutschrift ist optional */}}
    fallback(answer.reason,answer.status,answer.detail);return}
   context.res=json(200,{ok:true,mode:'ki',text:answer.text,model:answer.model,usedToday:quota.total,dailyLimit:quota.limit,notice:'KI-Vorschlag – fachlich prüfen. Gesendet wurden nur anonymisierte Fachfelder.'});return}
  if(action==='advise'){
   const cases=recordsOf((await readRecords(env)).value);
   const p=payload.id?cases.find(x=>x.id===str(payload.id,50)):Object.assign({},payload.case||{});
   if(!p)throw err('NOT_FOUND','Fall nicht gefunden',404);
   context.res=json(200,{ok:true,mode:'regelbasiert',suggestions:advice(p),relatedCases:relatedCases(p,cases),notice:'Automatisierte Entscheidungshilfe – keine generative KI, keine automatische Maßnahmenfreigabe.'});return}
  requireRight(canEdit(user),'Bearbeitung');
  if(!['create','update','close','reopen'].includes(action))throw err('INVALID_ACTION','Unbekannte Aktion');
  if((action==='close'||action==='reopen'))requireRight(canClose(user),'Abschlussfreigabe');
  const saved=await mutateRecords(env,items=>{
   let item;
   if(action==='create'){if(items.length>=MAX_CASES)throw err('LIMIT','Maximale Fallzahl erreicht; Archivierung prüfen',409);item=newCase(payload,user);items.unshift(item)}
   else{
    const id=str(payload.id,50),idx=items.findIndex(x=>x.id===id);if(idx<0)throw err('NOT_FOUND','Fall nicht gefunden',404);
    item=JSON.parse(JSON.stringify(items[idx]));
    if(action==='update')updateCase(item,payload,user);
    if(action==='close')closeCase(item,payload,user);
    if(action==='reopen')reopenCase(item,payload,user);
    items[idx]=item;
   }
   return {items,item};
  });
  context.res=json(200,{ok:true,item:saved,environment:env});
 }catch(e){context.log&&context.log.warn&&context.log.warn('quality-capa',e.code||'SERVER_ERROR');context.res=json(e.status||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.status?e.message:apiI18n.t(req,'api.state.unknownStorage')})}
};
module.exports._test={parseAttachment,addAttachment,canAttach,verifyAttachmentBytes,verifyChain,reportCase,addReportNote,withIntegrity,canRead,canEdit,canClose,cleanPatch,newCase,updateCase,closeCase,reopenCase,advice,relatedCases,recordsOf,validatedSnapshot,STATUSES};
