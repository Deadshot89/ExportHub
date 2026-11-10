'use strict';

const LINK_LABELS=Object.freeze({
 de:'Hier zur Avisierung klicken',
 en:'Click here to arrange pickup',
 pl:'Kliknij tutaj, aby zgłosić odbiór',
 es:'Haga clic aquí para gestionar la recogida',
 fr:'Cliquez ici pour organiser l’enlèvement',
 it:'Clicca qui per organizzare il ritiro'
});

function languageOf(value){
 const matched=String(value||'').trim().toLowerCase().replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);
 return matched?matched[1]:'de';
}
function escapeHtml(value){
 return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const CLOSURE_LABELS=Object.freeze({
 de:{title:'Wichtige Information zu unseren Betriebsferien',last:'Letzte Abholung',closed:'Geschlossen',reopen:'Wieder geöffnet ab'},
 en:{title:'Important notice – Holiday closure',last:'Last collection',closed:'Closed',reopen:'Reopening'},
 pl:{title:'Ważna informacja – Przerwa w pracy',last:'Ostatni odbiór',closed:'Zamknięte',reopen:'Ponowne otwarcie'},
 es:{title:'Información importante – Cierre temporal',last:'Última recogida',closed:'Cerrado',reopen:'Reapertura'},
 fr:{title:'Information importante – Fermeture',last:'Dernier enlèvement',closed:'Fermé',reopen:'Réouverture'},
 it:{title:'Informazione importante – Chiusura',last:'Ultimo ritiro',closed:'Chiuso',reopen:'Riapertura'}
});
const DATE_LOCALES=Object.freeze({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'});
function isoDay(value){
 const v=String(value||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';
 const d=new Date(v+'T12:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v?v:'';
}
function berlinDay(now){
 const d=now instanceof Date?now:new Date(now||Date.now());
 if(!Number.isFinite(d.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const part=k=>parts.find(x=>x.type===k)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day');
}
function normalizeClosureNotice(value){
 if(!value||typeof value!=='object'||value.enabled!==true)return null;
 const startDate=isoDay(value.startDate),endDate=isoDay(value.endDate),
  lastPickupDate=isoDay(value.lastPickupDate),reopenDate=isoDay(value.reopenDate);
 const lastPickupTime=String(value.lastPickupTime||'').trim();
 const leadDays=value.leadDays==null?14:Number(value.leadDays);
 if(!startDate||!endDate||!lastPickupDate||!reopenDate||
    startDate>endDate||lastPickupDate>=startDate||reopenDate<=endDate||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(lastPickupTime)||
    !Number.isInteger(leadDays)||leadDays<0||leadDays>90)return null;
 return{startDate,endDate,lastPickupDate,lastPickupTime,reopenDate,leadDays,animateSnow:value.animateSnow===true};
}
function activeClosureNotices(state,now){
 const settings=state&&state.settings;
 const entries=settings&&settings.closureNotices;
 if(!Array.isArray(entries))return [];
 const today=berlinDay(now||new Date());
 if(!today)return [];
 const unique=new Set();
 return entries.slice(0,100).map(normalizeClosureNotice).filter(Boolean)
  .filter(v=>{
   const from=new Date(v.startDate+'T12:00:00Z');
   from.setUTCDate(from.getUTCDate()-v.leadDays);
   const first=from.toISOString().slice(0,10);
   const key=[v.startDate,v.endDate,v.lastPickupDate,v.lastPickupTime,v.reopenDate].join('|');
   if(today<first||today>=v.reopenDate||unique.has(key))return false;
   unique.add(key);return true;
  }).sort((a,b)=>a.startDate.localeCompare(b.startDate)).slice(0,3);
}
function closureForPickupDate(state,value){
 const day=isoDay(value);
 const entries=state&&state.settings&&state.settings.closureNotices;
 if(!day||!Array.isArray(entries))return null;
 return entries.slice(0,100).map(normalizeClosureNotice).filter(Boolean)
  // The last actual collection is the operational cutoff. No further pickup
  // days may be booked until the explicit reopening date, including weekends.
  .filter(notice=>day>notice.lastPickupDate&&day<notice.reopenDate)
  .sort((a,b)=>a.lastPickupDate.localeCompare(b.lastPickupDate))[0]||null;
}
function closureForPickupSlot(state,value,from,to){
 const dateClosed=closureForPickupDate(state,value);
 if(dateClosed)return dateClosed;
 const day=isoDay(value),end=String(to||'').trim();
 const entries=state&&state.settings&&state.settings.closureNotices;
 if(!day||!Array.isArray(entries)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end))return null;
 return entries.slice(0,100).map(normalizeClosureNotice).filter(Boolean)
  .filter(notice=>day===notice.lastPickupDate&&end>notice.lastPickupTime)
  .sort((a,b)=>a.lastPickupTime.localeCompare(b.lastPickupTime))[0]||null;
}
function mailDate(value,lang){
 return new Intl.DateTimeFormat(DATE_LOCALES[lang]||DATE_LOCALES.de,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(value+'T12:00:00Z'));
}
function closureNoticePlain(notices,language){
 const lang=languageOf(language),t=CLOSURE_LABELS[lang];
 return (Array.isArray(notices)?notices:[]).map(v=>[
  t.title,
  t.last+': '+mailDate(v.lastPickupDate,lang)+', '+v.lastPickupTime,
  t.closed+': '+mailDate(v.startDate,lang)+' – '+mailDate(v.endDate,lang),
  t.reopen+': '+mailDate(v.reopenDate,lang)
 ].join('\n')).join('\n\n');
}
function closureNoticeHtml(notices,language){
 const lang=languageOf(language),t=CLOSURE_LABELS[lang];
 return (Array.isArray(notices)?notices:[]).map(v=>{
  const row=(label,content)=>'<tr><td style="padding:4px 12px 4px 0;vertical-align:top;font-weight:700">'+
   escapeHtml(label)+'</td><td style="padding:4px 0;vertical-align:top"><strong>'+escapeHtml(content)+'</strong></td></tr>';
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 20px;background:#fff7ed;border:2px solid #b45309;border-radius:6px;color:#292524;font-family:Arial,Helvetica,sans-serif">'+
   '<tr><td style="padding:16px 18px"><div style="font-size:17px;line-height:1.4;font-weight:700;color:#7c2d12;margin-bottom:10px">'+escapeHtml(t.title)+'</div>'+
   '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;line-height:1.5">'+
   row(t.last,mailDate(v.lastPickupDate,lang)+', '+v.lastPickupTime)+
   row(t.closed,mailDate(v.startDate,lang)+' – '+mailDate(v.endDate,lang))+
   row(t.reopen,mailDate(v.reopenDate,lang))+'</table></td></tr></table>';
 }).join('');
}

function renderAvisMailHtml(plainText,avisUrl,language,closureHtml){
 const lang=languageOf(language),url=new URL(String(avisUrl||''));
 if(url.protocol!=='https:')throw new Error('AVIS_HTML_URL_INVALID');
 url.searchParams.set('lang',lang);
 const fullUrl=url.toString(),source=String(plainText==null?'':plainText);
 const parts=source.split(fullUrl);
 if(parts.length!==2)throw new Error('AVIS_HTML_LINK_MISMATCH');
 const format=part=>escapeHtml(part).replace(/\r\n|\r|\n/g,'<br>');
 const button='<a href="'+escapeHtml(fullUrl)+'" style="display:inline-block;background:#155eef;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:22px;padding:12px 18px;border-radius:8px;">'+escapeHtml(LINK_LABELS[lang])+'</a>';
 return '<!doctype html><html lang="'+lang+'"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:14px;line-height:1.65"><div style="max-width:680px;margin:0 auto">'+String(closureHtml||'')+format(parts[0])+button+format(parts[1])+'</div></body></html>';
}
module.exports={LINK_LABELS,languageOf,renderAvisMailHtml,activeClosureNotices,closureForPickupDate,closureForPickupSlot,closureNoticePlain,closureNoticeHtml};
