'use strict';
// Separate, low-volume public announcement store. No shipment/team-state payloads are exposed.
const auth=require('./auth-store');
const {BlobServiceClient}=require('@azure/storage-blob');
const {isolationConfig}=require('./testservice-auth-isolation');
const BASE='avis-announcements/closure.json';
const LANGS=['de','en','pl','es','fr','it'];
function text(v){return String(v==null?'':v).trim()}
function err(code,message){const e=new Error(message);e.code=code;e.status=400;return e}
function time(value,name){
 const v=text(value);
 if(!v)return '';
 if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)||new Date(v+':00Z').toISOString().slice(0,16)!==v)throw err('AVIS_NOTICE_DATE_INVALID','Ungültiges Datum für '+name+'.');
 return v;
}
function normalize(input){
 const p=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const out={
  enabledMail:p.enabledMail===true,
  enabledPage:p.enabledPage===true,
  animate:p.animate===true,
  from:time(p.from,'Anzeigebeginn'),
  until:time(p.until,'Anzeigeende'),
  lastPickup:time(p.lastPickup,'letzte Abholung'),
  closedFrom:time(p.closedFrom,'Beginn der Betriebsruhe'),
  closedUntil:time(p.closedUntil,'Ende der Betriebsruhe'),
  firstPickup:time(p.firstPickup,'erste Abholung')
 };
 if(out.enabledMail||out.enabledPage){
  for(const k of ['from','until','lastPickup','closedFrom','closedUntil','firstPickup'])if(!out[k])throw err('AVIS_NOTICE_REQUIRED','Alle Termine müssen ausgefüllt werden, bevor der Hinweis aktiviert wird.');
 }
 if(out.from&&out.until&&out.from>out.until)throw err('AVIS_NOTICE_RANGE_INVALID','Anzeigeende liegt vor dem Beginn.');
 if(out.closedFrom&&out.closedUntil&&out.closedFrom>out.closedUntil)throw err('AVIS_NOTICE_RANGE_INVALID','Betriebsruhe endet vor ihrem Beginn.');
 if(out.lastPickup&&out.closedFrom&&out.lastPickup>out.closedFrom)throw err('AVIS_NOTICE_RANGE_INVALID','Die letzte Abholung muss vor der Betriebsruhe liegen.');
 if(out.firstPickup&&out.closedUntil&&out.firstPickup<=out.closedUntil)throw err('AVIS_NOTICE_RANGE_INVALID','Die erste Abholung muss nach der Betriebsruhe liegen.');
 return out;
}
function berlinNow(date){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date||new Date());
 const get=k=>parts.find(x=>x.type===k).value;
 return get('year')+'-'+get('month')+'-'+get('day')+'T'+get('hour')+':'+get('minute');
}
function isActive(settings,channel,now){
 const s=settings&&typeof settings==='object'?settings:{},key=channel==='mail'?'enabledMail':'enabledPage',point=typeof now==='string'?now:berlinNow(now);
 return s[key]===true&&!!s.from&&!!s.until&&point>=s.from&&point<=s.until;
}
const COPY={
 de:['Information zu Weihnachten & Neujahr','Bitte beachtet unsere geänderten Öffnungszeiten über die Feiertage.','Letzte Abholung','Betriebsruhe','Erste Abholung','Wir wünschen euch frohe Weihnachten und einen guten Start ins neue Jahr!'],
 en:['Christmas & New Year opening hours','Please note our adjusted opening hours during the holiday season.','Last collection','Closed','First collection','We wish you a Merry Christmas and a Happy New Year!'],
 pl:['Godziny pracy w okresie świątecznym','Prosimy uwzględnić zmienione godziny pracy w okresie świątecznym.','Ostatni odbiór','Przerwa świąteczna','Pierwszy odbiór','Wesołych Świąt i szczęśliwego Nowego Roku!'],
 es:['Horario de Navidad y Año Nuevo','Tengan en cuenta nuestro horario especial durante las fiestas.','Última recogida','Cerrado','Primera recogida','¡Feliz Navidad y próspero Año Nuevo!'],
 fr:['Horaires de Noël et du Nouvel An','Veuillez tenir compte de nos horaires modifiés pendant les fêtes.','Dernier enlèvement','Fermeture','Premier enlèvement','Joyeux Noël et bonne année !'],
 it:['Orari di Natale e Capodanno','Vi invitiamo a prendere nota degli orari modificati durante le festività.','Ultimo ritiro','Chiusura','Primo ritiro','Buon Natale e felice anno nuovo!']
};
function langOf(v){const m=text(v).toLowerCase().match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'}
function fmt(v,lang){
 if(!v)return '';
 const [ymd,hm]=v.split('T'),[y,m,d]=ymd.split('-');
 if(lang==='en')return d+'/'+m+'/'+y+' '+hm;
 return d+'.'+m+'.'+y+' '+hm;
}
function publicNotice(s,lang,now){
 if(!isActive(s,'page',now))return null;
 const l=langOf(lang),t=COPY[l];
 return{title:t[0],intro:t[1],lastLabel:t[2],lastPickup:fmt(s.lastPickup,l),closedLabel:t[3],closedFrom:fmt(s.closedFrom,l),closedUntil:fmt(s.closedUntil,l),firstLabel:t[4],firstPickup:fmt(s.firstPickup,l),greeting:t[5],animate:s.animate===true};
}
function emailBlock(s,lang,now){
 if(!isActive(s,'mail',now))return '';
 const l=langOf(lang),t=COPY[l];
 return [t[0],t[1],t[2]+': '+fmt(s.lastPickup,l),t[3]+': '+fmt(s.closedFrom,l)+' – '+fmt(s.closedUntil,l),t[4]+': '+fmt(s.firstPickup,l),t[5]].join('\n');
}
function appendEmail(body,s,lang,now){
 const base=String(body==null?'':body);
 const extra=emailBlock(s,lang,now);if(!extra)return base;
 const l=langOf(lang);
 const sig={de:/\n(?:Mit freundlichen Grüßen|Viele Grüße)\s*$/i,en:/\n(?:Kind regards|Best regards)\s*$/i,pl:/\nZ poważaniem\s*$/i,es:/\nAtentamente\s*$/i,fr:/\nCordialement\s*$/i,it:/\nCordiali saluti\s*$/i}[l];
 const m=base.match(sig);
 return m?base.slice(0,m.index).trimEnd()+'\n\n'+extra+'\n\n'+base.slice(m.index).trimStart():base+'\n\n'+extra;
}
function client(env){
 const iso=env==='testservice'?isolationConfig():{enabled:false};
 const cs=iso.enabled?iso.connectionString:process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||'';
 if(!cs)throw auth.error('STORAGE_NOT_CONFIGURED','Speicher nicht verfügbar.',503);
 const container=iso.enabled?iso.container:process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
 const blob=env==='testservice'?'testservice/'+BASE:BASE;
 return BlobServiceClient.fromConnectionString(cs).getContainerClient(container).getBlockBlobClient(blob);
}
async function load(env){
 const r=await auth.readJson(client(env),{});
 return{value:normalize(r.value||{}),etag:r.etag};
}
async function save(env,input){
 const value=normalize(input);
 const blob=client(env);
 for(let attempt=0;attempt<5;attempt++){
  const current=await auth.readJson(blob,{});
  try{await auth.writeJson(blob,value,current.etag);return value}
  catch(e){if(e&&e.statusCode===412&&attempt<4)continue;throw e}
 }
 throw auth.error('AVIS_NOTICE_WRITE_CONFLICT','Einstellungen wurden gleichzeitig geändert.',409);
}
module.exports={normalize,berlinNow,isActive,langOf,publicNotice,emailBlock,appendEmail,load,save};
