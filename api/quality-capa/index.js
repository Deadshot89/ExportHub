'use strict';
/* ExportHUB360 – Qualitätsabweichungen und Korrekturmaßnahmen (CAPA).
 * Separate API actions, authenticated and stored outside the shared team state.
 * No external AI requests or new paid services.
 */
const crypto=require('node:crypto');
const auth=require('../shared/auth-store');
const apiI18n=require('../shared/i18n');
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
function actor(u){return str(u&&(u.name||u.user||u.username||u.login),120)||'Benutzer'}
/* CAPA records do not belong in shared team.state: that state is readable by unrelated
 * ExportHUB functions. Use a private, environment-separated Blob guarded by this API. */
function recordsClient(environment){
 const test=environment==='testservice',isolated=test?isolationConfig():{enabled:false};
 const connection=test&&isolated.enabled?isolated.connectionString:primaryConnection(process.env);
 if(!connection)throw err('STORAGE_NOT_CONFIGURED','Qualitätsspeicher nicht konfiguriert',503);
 const container=test&&isolated.enabled?isolated.container:auth.TEAM_CONTAINER;
 const path=(test?'testservice/':'')+'quality/capa-cases.json';
 return BlobServiceClient.fromConnectionString(connection).getContainerClient(container).getBlockBlobClient(path);
}
function recordsOf(doc){return Array.isArray(doc&&doc.items)?doc.items:[]}
async function readRecords(env){
 return auth.readJson(recordsClient(env),{schemaVersion:1,revision:0,items:[]},{missingBlobOnly:true});
}
async function mutateRecords(env,updater){
 const blob=recordsClient(env);
 for(let n=0;n<7;n++){
  const previous=await auth.readJson(blob,{schemaVersion:1,revision:0,items:[]},{missingBlobOnly:true});
  const result=updater(recordsOf(previous.value).slice());
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
function event(caseItem,action,user,notes,changedFields){caseItem.history=Array.isArray(caseItem.history)?caseItem.history:[];caseItem.history.push({at:new Date().toISOString(),action,actor:actor(user),notes:str(notes,300),changedFields:Array.isArray(changedFields)?changedFields.slice(0,32):[]});caseItem.history=caseItem.history.slice(-150)}
function newCase(data,user){const patch=cleanPatch(data);if(!patch.title||!patch.description)throw err('REQUIRED','Titel und Fehlerbeschreibung sind Pflicht');const now=new Date().toISOString();
 const item=Object.assign({id:'QM-'+now.slice(0,10).replace(/-/g,'')+'-'+crypto.randomBytes(4).toString('hex').toUpperCase(),revision:1,createdAt:now,updatedAt:now,createdBy:actor(user),status:'offen',category:'sonstiges',severity:'mittel',occurredOn:now.slice(0,10),title:'',description:'',area:'',reference:'',impact:'',immediateAction:'',rootCause:'',correctiveAction:'',preventiveAction:'',owner:'',dueDate:'',evidence:'',effectivenessResult:'',effectivenessEvidence:'',verifiedOn:'',verifiedBy:'',closedAt:'',history:[]},patch);
 event(item,'ANGELEGT',user,'Abweichung erfasst');return item}
function updateCase(item,p,user){if(item.status==='abgeschlossen')throw err('CLOSED','Abgeschlossenen Fall zuerst wieder öffnen',409);
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Der Fall wurde inzwischen verändert. Bitte neu laden.',409);
 const patch=cleanPatch(p),before=Object.assign({},item);Object.assign(item,patch);
 if(!item.title||!item.description)throw err('REQUIRED','Titel und Fehlerbeschreibung sind Pflicht');
 if(Object.prototype.hasOwnProperty.call(p,'status')){
  const status=str(p.status,40);
  if(!STATUSES.slice(0,-1).includes(status))throw err('INVALID_STATUS','Statuswechsel nicht erlaubt');
  item.status=status;
 }
 const changedFields=Object.keys(patch).filter(k=>String(before[k]==null?'':before[k])!==String(item[k]==null?'':item[k]));
 if(before.status!==item.status&&!changedFields.includes('status'))changedFields.push('status');
 item.revision++;item.updatedAt=new Date().toISOString();event(item,'AKTUALISIERT',user,str(p.changeNote,300),changedFields);return item}
function closeCase(item,p,user){
 if(item.status==='abgeschlossen')throw err('CLOSED','Fall bereits abgeschlossen',409);
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Fall wurde zwischenzeitlich geändert',409);
 if(!str(item.rootCause)||!str(item.correctiveAction)||!str(item.effectivenessEvidence)||item.effectivenessResult!=='wirksam'||!date(item.verifiedOn)||item.verifiedOn>new Date().toISOString().slice(0,10))
  throw err('CLOSE_INCOMPLETE','Abschluss erst nach Ursache, Abstellmaßnahme und dokumentiert wirksamer Prüfung möglich',422);
 item.status='abgeschlossen';item.closedAt=new Date().toISOString();item.updatedAt=item.closedAt;item.verifiedBy=actor(user);item.revision++;
 event(item,'ABGESCHLOSSEN',user,'Wirksamkeit bestätigt');return item
}
function reopenCase(item,p,user){
 if(item.status!=='abgeschlossen')throw err('STATUS','Nur abgeschlossene Fälle können erneut geöffnet werden',409);
 const reason=str(p.reason,500);if(reason.length<8)throw err('REASON','Bitte einen nachvollziehbaren Grund für das Wiederöffnen angeben');
 if(Number(p.revision)!==Number(item.revision))throw err('CONFLICT','Fall wurde zwischenzeitlich geändert',409);
 item.status='ursachenanalyse';item.closedAt='';item.effectivenessResult='offen';item.effectivenessEvidence='';item.verifiedOn='';item.verifiedBy='';item.updatedAt=new Date().toISOString();item.revision++;event(item,'WIEDEREROEFFNET',user,reason);return item
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD',message:'Nur POST erlaubt'});return}
 try{
  const payload=body(req);const current=await auth.validateSession(req),user=current.user;requireRight(canRead(user),'Qualitätsabweichungen');
  const action=str(payload.action||'list',30).toLowerCase(),env=auth.environmentFromRequest(req);
  if(action==='list'){const records=await readRecords(env),items=recordsOf(records.value);context.res=json(200,{ok:true,items,environment:env,canEdit:canEdit(user),canClose:canClose(user)});return}
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
module.exports._test={canRead,canEdit,canClose,cleanPatch,newCase,updateCase,closeCase,reopenCase,advice,relatedCases,STATUSES};
