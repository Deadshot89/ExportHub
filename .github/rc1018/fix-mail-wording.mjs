import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const file=path.join(ROOT,'assets/rc1018-mail-language-standard.js');
let source=fs.readFileSync(file,'utf8');
const replacements=[
  ['A separate confirmation of the shipment details by email is not required.','A separate confirmation by email is not required.'],
  ['The shipment details are therefore not repeated in this email.','The information is therefore not repeated in this email.'],
  ['Eine zusätzliche Bestätigung der Sendungsdetails per E-Mail ist nicht erforderlich.','Eine zusätzliche Bestätigung per E-Mail ist nicht erforderlich.'],
  ['Die Sendungsdetails werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.','Die Informationen werden deshalb in dieser E-Mail nicht zusätzlich wiederholt.']
];
for(const [before,after] of replacements)if(source.includes(before))source=source.replaceAll(before,after);
fs.writeFileSync(file,source);

function replaceRequired(rel,before,after,label){const target=path.join(ROOT,rel);let src=fs.readFileSync(target,'utf8');if(src.includes(after))return false;if(!src.includes(before))throw new Error((label||rel)+': erwarteter Patch-Anker fehlt.');src=src.replace(before,after);fs.writeFileSync(target,src,'utf8');return true}

// RC1049: State-API darf in Static-Web-Apps auch die vorhandene AzureWebJobsStorage-Verbindung nutzen.
replaceRequired('api/exporthub-state/index.js',
"function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.EXPORTHUB_STORAGE_CONNECTION || process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING || ''; }",
"function connectionString(){ return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING || process.env.EXPORTHUB_STORAGE_CONNECTION || process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || ''; }",
'RC1049 State Storage fallback');
replaceRequired('api/exporthub-state/index.js',
"function connectionSource(){ if(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_STORAGE_CONNECTION_STRING'; if(process.env.EXPORTHUB_STORAGE_CONNECTION)return 'EXPORTHUB_STORAGE_CONNECTION'; if(process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING'; return ''; }",
"function connectionSource(){ if(process.env.EXPORTHUB_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_STORAGE_CONNECTION_STRING'; if(process.env.EXPORTHUB_STORAGE_CONNECTION)return 'EXPORTHUB_STORAGE_CONNECTION'; if(process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING)return 'EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING'; if(process.env.AzureWebJobsStorage)return 'AzureWebJobsStorage'; return ''; }",
'RC1049 State Storage source');

const apiFile=path.join(ROOT,'api/customer-avis/index.js');
let api=fs.readFileSync(apiFile,'utf8');

// RC1053: Bei normaler Link-Erstellung ist der bereits serverseitig whitelistbare Draft-Snapshot ausreichend.
// Dadurch wird der mehrere Sekunden teure Team-State-Read nur noch benötigt, wenn wirklich Serverzustand
// gebraucht wird (Disable, fehlender Snapshot oder bewusst manuell deaktivierter Avis).
if(!api.includes("fastSnapshotIssue=action==='issue'")){
 const before="const env=access.environment(req,payload),teamBlobStarted=Date.now(),blob=await teamBlob(env),teamBlobMs=elapsed(teamBlobStarted),canReuseAuthTeam=env==='production'&&internal&&internal.teamDoc&&obj(internal.teamDoc.value)&&text(auth.TEAM_CONTAINER)===TEAM_CONTAINER&&text(auth.TEAM_BLOB)===TEAM_BLOB_BASE,readStarted=Date.now(),d=canReuseAuthTeam?internal.teamDoc:await readTeam(blob),team=d.value||{},state=obj(team.state)?team.state:{};if(!obj(team.state))team.state=state;\n   const timing={authMs,teamBlobMs,teamReadMs:elapsed(readStarted),flagWriteMs:0,tokenIssueMs:0,totalMs:0};\n   const subjectId=text(payload.shipmentId||payload.id||payload.reference||payload.ref),reference=upper(payload.reference||payload.ref);let target=findShipment(state,subjectId,reference),draftOnly=false;\n   if(!target&&payload.shipmentSnapshot){target=sanitizeDraftSnapshot(payload.shipmentSnapshot,subjectId,reference);draftOnly=true}";
 const after="const env=access.environment(req,payload),teamBlobStarted=Date.now(),blob=await teamBlob(env),teamBlobMs=elapsed(teamBlobStarted),subjectId=text(payload.shipmentId||payload.id||payload.reference||payload.ref),reference=upper(payload.reference||payload.ref),safeSnapshot=payload.shipmentSnapshot?sanitizeDraftSnapshot(payload.shipmentSnapshot,subjectId,reference):null,fastSnapshotIssue=action==='issue'&&!!safeSnapshot&&!avisManuallyDisabled(payload.shipmentSnapshot),canReuseAuthTeam=!fastSnapshotIssue&&env==='production'&&internal&&internal.teamDoc&&obj(internal.teamDoc.value)&&text(auth.TEAM_CONTAINER)===TEAM_CONTAINER&&text(auth.TEAM_BLOB)===TEAM_BLOB_BASE,readStarted=Date.now(),d=fastSnapshotIssue?{value:{state:{}},etag:null}:(canReuseAuthTeam?internal.teamDoc:await readTeam(blob)),team=d.value||{},state=obj(team.state)?team.state:{};if(!obj(team.state))team.state=state;\n   const timing={authMs,teamBlobMs,teamReadMs:fastSnapshotIssue?0:elapsed(readStarted),flagWriteMs:0,tokenIssueMs:0,totalMs:0};\n   let target=fastSnapshotIssue?safeSnapshot:findShipment(state,subjectId,reference),draftOnly=fastSnapshotIssue;\n   if(!target&&safeSnapshot){target=safeSnapshot;draftOnly=true}";
 if(!api.includes(before))throw new Error('RC1053 Avis Fast-Issue: erwarteter Issue-Anker fehlt.');
 api=api.replace(before,after);
}

if(!api.includes('function abdPolicy(state,sh)')){
 const marker="function validateTime(v){return!v||/^([01]\\d|2[0-3]):[0-5]\\d$/.test(v)}";
 if(!api.includes(marker))throw new Error('RC1049 Avis API: validateTime-Anker fehlt.');
 const helper=`function abdRequestOf(state,sh){const ref=sref(sh),id=sid(sh),list=arr(state&&state.abdRequests);for(let i=list.length-1;i>=0;i--){const r=list[i]||{},rr=upper(r.ref||r.reference||r.shipmentRef),rid=text(r.linkedShipmentId||r.shipmentId);if((ref&&rr===ref)||(id&&rid===id))return r}return null}\nfunction abdPresent(sh,req){const lists=[sh&&sh.abdFiles,req&&req.abdFiles,sh&&sh.abdDocuments];if(lists.some(x=>Array.isArray(x)&&x.length))return true;const st=lower(req&&(req.abdStatus||req.status)||sh&&sh.abdStatus);return /vorhanden|fertig|erledigt|completed|done|available|erstellt/.test(st)&&!/wartet|offen|pending|angefordert/.test(st)}\nfunction easterDate(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(Date.UTC(y,mo-1,day))}\nfunction isoDay(d){return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}\nfunction addIsoDays(s,n){const p=s.split('-').map(Number);return isoDay(new Date(Date.UTC(p[0],p[1]-1,p[2]+n)))}\nfunction nrwHolidays(y){const e=easterDate(y),o={};['01-01','05-01','10-03','11-01','12-25','12-26'].forEach(md=>o[y+'-'+md]=1);[-2,1,39,50,60].forEach(n=>o[isoDay(new Date(e.getTime()+n*86400000))]=1);return o}\nfunction businessDay(s){const p=s.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2])),w=d.getUTCDay();return w!==0&&w!==6&&!nrwHolidays(p[0])[s]}\nfunction nextBusinessDay(s,count){let x=s,n=0;while(n<count){x=addIsoDays(x,1);if(businessDay(x))n++}return x}\nfunction berlinRequest(raw){const d=new Date(raw);if(!Number.isFinite(d.getTime()))return null;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),o={};parts.forEach(p=>o[p.type]=p.value);return{date:o.year+'-'+o.month+'-'+o.day,minutes:Number(o.hour)*60+Number(o.minute)}}\nfunction abdPolicy(state,sh){const req=abdRequestOf(state,sh),required=sh&&sh.abdRequired===true||!!req||/wartet auf abd/i.test(text(sh&&(sh.status||sh.shipmentStatus))),present=abdPresent(sh,req);if(!required)return{required:false,present:true,pending:false};if(present)return{required:true,present:true,pending:false};const requestedAt=text(req&&(req.createdAt||req.created||req.requestedAt)||sh&&(sh.abdRequestedAt||sh.abdRequestCreatedAt||sh.createdAt)),b=berlinRequest(requestedAt)||berlinRequest(now()),days=b.minutes<=810?1:2,minDate=nextBusinessDay(b.date,days);return{required:true,present:false,pending:true,requestedAt,requestedBeforeCutoff:b.minutes<=810,expectedAvailableDate:minDate,expectedAvailableTime:'10:00',minPickupDate:minDate,minPickupTime:'10:00'}}\nfunction enforceAbdAppointment(state,sh,payload){const p=abdPolicy(state,sh);if(!p.pending)return;const date=text(payload.pickupDate),from=text(payload.timeFrom);if(date<p.minPickupDate||(date===p.minPickupDate&&(!from||from<p.minPickupTime)))throw error('ABD_PICKUP_TOO_EARLY','Das ABD liegt voraussichtlich erst am '+p.minPickupDate+' gegen 10:00 Uhr vor. Eine Abholung kann erst ab diesem Zeitpunkt gebucht werden.',409)}\n`;
 api=api.replace(marker,helper+marker);
 api=api.replace('function publicShipment(sh,session){','function publicShipment(sh,session,state){');
 api=api.replace('status:publicStatus(sh),goodsDescription:','status:publicStatus(sh),abd:abdPolicy(state,sh),goodsDescription:');
 api=api.replace('applyAppointment(state,target,payload);','enforceAbdAppointment(state,target,payload);applyAppointment(state,target,payload);');
 api=api.replace('return publicShipment(findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference),session)','return publicShipment(findShipment(state,sessionInfo.record.subjectId,sessionInfo.record.reference),session,state)');
 api=api.replace('response=publicShipment(sh,sessionInfo.session);','response=publicShipment(sh,sessionInfo.session,state);');
 api=api.replace('context.res=json(200,publicShipment(sh,session));','context.res=json(200,publicShipment(sh,session,state));');
 if(!api.includes('ABD_PICKUP_TOO_EARLY')||!api.includes('abd:abdPolicy(state,sh)'))throw new Error('RC1049 Avis API Patch unvollständig.');
}
fs.writeFileSync(apiFile,api,'utf8');

const RC1027_ID='exporthub-rc1027-lieferavis-immediate';
const RC1027_TAG='<script id="'+RC1027_ID+'" defer src="/assets/rc1027-lieferavis-immediate.js?v=1052"></script>';
const RC1037_ID='exporthub-rc1037-lieferavis-timing-diagnostics';
const RC1037_TAG='<script id="'+RC1037_ID+'" defer src="/assets/rc1037-lieferavis-timing-diagnostics.js?v=1038"></script>';
const RC1049_ID='exporthub-rc1049-abd-avis-policy';
const RC1049_TAG='<script id="'+RC1049_ID+'" defer src="/assets/rc1049-abd-avis-policy.js?v=1050"></script>';
const RC1065_CC_ID='exporthub-rc1065-registration-cc';
const RC1065_CC_TAG='<script id="'+RC1065_CC_ID+'" defer src="/assets/rc1065-registration-cc.js?v=1065"></script>';
function injectScript(rel,id,tag){const target=path.join(ROOT,rel);if(!fs.existsSync(target))return false;let html=fs.readFileSync(target,'utf8');const existing=new RegExp('<script\\b(?=[^>]*\\bid=["\\\']'+id+'["\\\'])[^>]*>\\s*<\\/script>','i');if(existing.test(html)){const next=html.replace(existing,tag);if(next===html)return false;fs.writeFileSync(target,next,'utf8');return true}const body=html.search(/<body\b/i),close=(body>=0?html.slice(0,body):html).search(/<\/head\s*>/i);if(close<0)throw new Error(rel+': </head> für ExportHUB-Laufzeitlayer fehlt.');html=html.slice(0,close)+tag+'\n'+html.slice(close);fs.writeFileSync(target,html,'utf8');return true}
for(const page of ['index.html','TESTVERSION.html','demo.html']){injectScript(page,RC1027_ID,RC1027_TAG);injectScript(page,RC1037_ID,RC1037_TAG);injectScript(page,RC1049_ID,RC1049_TAG);injectScript(page,RC1065_CC_ID,RC1065_CC_TAG)}
injectScript('customer-avis.html',RC1049_ID,RC1049_TAG);
await import('../rc1049/fix-mail-abd-gate.mjs');
console.log('RC1053: Azure-State-Fallback, ABD-Regeln und schneller Avis-Snapshot-Pfad aktiviert.');