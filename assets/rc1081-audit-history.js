// ExportHUB RC1084 – zentrale, vollständig deutsche Aktivitäts-Historie.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1081_AUDIT_HISTORY__)return;
w.__EXPORTHUB_RC1081_AUDIT_HISTORY__=true;

var FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:0,from:'',to:''};

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function historyView(){var v=view();return v==='history'||v==='historie'}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmt(v){var x=new Date(v);if(!Number.isFinite(x.getTime()))return q(v)||'—';return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'medium'}).format(x)}
function identity(sh){return q(sh&&(sh.id||sh.shipmentId||sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber)).toUpperCase()}
function shipmentRef(sh){return q(sh&&(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.id))}
function customerName(c){return q(c&&(c.name||c.customerName||c.companyName||c.account||c.customerNumber))||'Kunde'}
function actorName(e){return q(e&&e.actor&&e.actor.name||e&&e.actor||e&&e.by||e&&e.user)||'System'}
function eventKey(e){return q(e&&e.id)||[q(e&&e.at),q(e&&e.type),q(e&&e.subtype),q(e&&e.label),actorName(e),q(e&&e.entityId)].join('|').toLowerCase()}
function pushUnique(map,e){if(!e||!q(e.at))return;var k=eventKey(e);if(k&&!map.has(k))map.set(k,e)}

var AUDIT_LABELS={
 LOGIN_SUCCESS:'Anmeldung erfolgreich',
 LOGIN_FAILED:'Anmeldung fehlgeschlagen',
 LOGOUT:'Abmeldung',
 PROFILE_DISPLAY_NAME_UPDATED:'Anzeigename geändert',
 USER_DISPLAY_NAME_UPDATED_BY_ADMIN:'Anzeigename durch Administrator geändert',
 USER_CREATED:'Benutzer angelegt',
 USER_RIGHTS_UPDATED:'Benutzerrechte geändert',
 USER_ACTIVATED:'Benutzer aktiviert',
 USER_DEACTIVATED:'Benutzer deaktiviert',
 PASSWORD_RESET:'Passwort zurückgesetzt',
 PASSWORD_CHANGED:'Passwort geändert',
 ACCOUNT_UNLOCKED:'Benutzerkonto entsperrt',
 SESSIONS_TERMINATED:'Sitzungen durch Administrator beendet',
 INITIAL_ADMIN_BOOTSTRAPPED:'Admin-Zugang eingerichtet',
 INITIAL_ADMIN_RECOVERED:'Admin-Zugang wiederhergestellt',
 ADMIN_ACCOUNT_UNLOCKED_WITH_PERSONAL_PASSWORD:'Admin-Konto entsperrt',
 DIAGNOSTIC_AUTOFIX_REQUESTED:'Fehler zur automatischen Behebung übergeben',
 DIAGNOSTIC_AUTOFIX_FIXED:'Fehler automatisch behoben',
 DIAGNOSTIC_AUTOFIX_FAILED:'Automatische Fehlerbehebung fehlgeschlagen'
};
var SHIPMENT_LABELS={
 created:'Sendung erstellt',
 saved:'Sendung gespeichert',
 status:'Sendungsstatus geändert',
 mail:'E-Mail vorbereitet oder geöffnet',
 'mail-sent':'E-Mail-Versand bestätigt',
 print:'Druck oder PDF-Ausgabe',
 avis:'Lieferavis',
 abd:'ABD',
 pickup:'Abholung',
 'pickup-plan':'Abholung geplant oder gebucht',
 pod:'POD',
 document:'Dokument',
 registration:'Versandanmeldung',
 'work-start':'Arbeit an Sendung gestartet',
 event:'Sendungsaktion'
};
var CUSTOMER_LABELS={
 'customer-created':'Kunde angelegt',
 'customer-updated':'Kunde geändert'
};

function typeLabel(type){return({shipment:'Sendungen',customer:'Kunden',audit:'Benutzer & System'})[type]||'Sonstiges'}
function actionLabel(e){
 var subtype=q(e&&e.subtype);
 if(e&&e.type==='audit')return AUDIT_LABELS[subtype]||'Systemaktion';
 if(e&&e.type==='customer')return CUSTOMER_LABELS[subtype]||'Kundenaktion';
 if(e&&e.type==='shipment')return SHIPMENT_LABELS[subtype]||'Sendungsaktion';
 return'Aktion'
}
function actionTitle(e){
 var raw=q(e&&e.label),mapped=actionLabel(e);
 if(e&&e.type==='audit')return mapped;
 if(raw&&raw!==subtypeTechnical(e))return raw;
 return mapped
}
function subtypeTechnical(e){return q(e&&e.subtype).replace(/[-_]+/g,' ')}
function actionKey(e){return q(e&&e.type)+'|'+q(e&&e.subtype)}

function auditEvent(e){
 var details=e&&e.details||{},subtype=q(e&&e.type),entity='System',entityId=q(details.userId||details.username);
 if(entityId)entity='Benutzer';
 return{id:q(e&&e.id),at:q(e&&e.at),type:'audit',subtype:subtype,label:AUDIT_LABELS[subtype]||'Systemaktion',actor:{name:actorName(e)},entity:entity,entityId:entityId,details:details,source:'audit'}
}
function shipmentEvent(sh,e){
 var ref=shipmentRef(sh)||identity(sh)||'Sendung';
 return{id:q(e&&e.id),at:q(e&&e.at),type:'shipment',subtype:q(e&&e.type)||'event',label:q(e&&e.label),actor:e&&e.actor||{name:actorName(e)},entity:'Sendung',entityId:ref,details:e&&e.details||{},source:q(e&&e.source)||'shipment'}
}
function customerEvent(c,e){
 return{id:q(e&&e.id),at:q(e&&e.at),type:'customer',subtype:q(e&&e.type),label:q(e&&e.label),actor:e&&e.actor||{name:actorName(e)},entity:'Kunde',entityId:q(c&&c.account||c&&c.customerNumber||c&&c.kundennummer)||customerName(c),details:e&&e.details||{},source:'customer'}
}
function allShipments(){
 var s=state(),list=[];
 ['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments'].forEach(function(k){arr(s[k]).forEach(function(sh){if(sh&&typeof sh==='object')list.push(sh)})});
 return list
}
function shipmentEvents(sh){
 var api=w.ExportHUBShipmentHistory1071;
 if(api&&typeof api.events==='function'){try{return arr(api.events(sh))}catch(_){}}
 return arr(sh&&sh.shipmentHistory)
}
function allEvents(){
 var s=state(),map=new Map();
 arr(s.auditLog).forEach(function(e){pushUnique(map,auditEvent(e))});
 allShipments().forEach(function(sh){shipmentEvents(sh).forEach(function(e){pushUnique(map,shipmentEvent(sh,e))})});
 arr(s.customers).forEach(function(c){arr(c&&c.customerHistory).forEach(function(e){pushUnique(map,customerEvent(c,e))})});
 return Array.from(map.values()).sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)})
}
function detailText(e){
 var x=e&&e.details||{},parts=[];
 if(x.username)parts.push('Benutzer: '+q(x.username));
 if(x.previousName||x.displayName)parts.push('Name: '+(x.previousName?q(x.previousName)+' → ':'')+q(x.displayName));
 if(x.customer)parts.push('Kunde: '+q(x.customer));
 if(x.account)parts.push('Kundennummer: '+q(x.account));
 if(x.document)parts.push('Dokument: '+q(x.document));
 if(x.files)parts.push('Dateien: '+q(x.files));
 if(x.subject)parts.push('Betreff: '+q(x.subject));
 if(x.from&&x.to)parts.push('Änderung: '+q(x.from)+' → '+q(x.to));
 else if(x.to)parts.push('Empfänger: '+q(x.to));
 if(x.fields)parts.push('Geändert: '+q(x.fields));
 if(x.status)parts.push('Status: '+q(x.status));
 if(x.reference)parts.push('Referenz: '+q(x.reference));
 if(x.date)parts.push('Datum: '+q(x.date)+(x.time?' · '+q(x.time):''));
 if(x.driver)parts.push('Fahrer: '+q(x.driver));
 if(x.licensePlate)parts.push('Kennzeichen: '+q(x.licensePlate));
 if(Number.isFinite(Number(x.colli)))parts.push('Colli: '+Number(x.colli));
 if(Number.isFinite(Number(x.documents)))parts.push('Dokumente: '+Number(x.documents));
 if(Number.isFinite(Number(x.remaining)))parts.push('Restmenge: '+Number(x.remaining));
 if(x.action)parts.push('Auslöser: '+q(x.action));
 if(x.environment)parts.push('Umgebung: '+q(x.environment));
 if(x.diagnosticId)parts.push('Fehler-ID: '+q(x.diagnosticId));
 if(Number.isFinite(Number(x.failedAttempts)))parts.push('Fehlversuche: '+Number(x.failedAttempts));
 if(typeof x.globalAdmin==='boolean')parts.push('Globaler Admin: '+(x.globalAdmin?'Ja':'Nein'));
 if(Number.isFinite(Number(x.terminated))&&Number(x.terminated)>0)parts.push('Beendete Sitzungen: '+Number(x.terminated));
 return Array.from(new Set(parts.filter(Boolean))).join(' · ')
}
function actorList(events){return Array.from(new Set(events.map(function(e){return actorName(e)}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'de')})}
function actionList(events){
 var map=new Map();
 events.forEach(function(e){var k=actionKey(e);if(!map.has(k))map.set(k,{key:k,label:actionLabel(e),area:typeLabel(e.type)})});
 return Array.from(map.values()).sort(function(a,b){var x=a.label.localeCompare(b.label,'de');return x||a.area.localeCompare(b.area,'de')})
}
function filterEvents(events){
 var days=Number(FILTER.days||0),cutoff=days>0?Date.now()-days*86400000:0,needle=low(FILTER.query),
     from=FILTER.from?Date.parse(FILTER.from+'T00:00:00'):0,to=FILTER.to?Date.parse(FILTER.to+'T23:59:59.999'):0;
 return events.filter(function(e){
  var ts=Date.parse(e.at||'');
  if(cutoff&&Number.isFinite(ts)&&ts<cutoff)return false;
  if(from&&Number.isFinite(ts)&&ts<from)return false;
  if(to&&Number.isFinite(ts)&&ts>to)return false;
  if(FILTER.type!=='all'&&e.type!==FILTER.type)return false;
  if(FILTER.subtype!=='all'&&actionKey(e)!==FILTER.subtype)return false;
  if(FILTER.actor!=='all'&&actorName(e)!==FILTER.actor)return false;
  if(FILTER.entity!=='all'&&q(e.entity)!==FILTER.entity)return false;
  if(!needle)return true;
  var raw='';try{raw=JSON.stringify(e.details||{})}catch(_){}
  return low([actionTitle(e),actionLabel(e),e.entity,e.entityId,actorName(e),e.actor&&e.actor.role,typeLabel(e.type),detailText(e),raw,fmt(e.at)].join(' ')).indexOf(needle)>=0
 })
}
function countType(events,type){return events.filter(function(e){return e.type===type}).length}
function ensureStyle(){
 if(d.getElementById('rc1081AuditHistoryStyle'))return;
 var s=d.createElement('style');s.id='rc1081AuditHistoryStyle';
 s.textContent='.rc1084-history{margin-top:12px}.rc1084-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.rc1084-head h3{margin:5px 0 3px;font-size:22px}.rc1084-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin:14px 0}.rc1084-summary-card{padding:10px 12px;border:1px solid #dbe4ec;border-radius:12px;background:var(--surface,#fff)}.rc1084-summary-card b{display:block;font-size:20px}.rc1084-summary-card span{font-size:11px;color:#64748b}.rc1084-filters{display:grid;grid-template-columns:minmax(250px,1.5fr) repeat(4,minmax(145px,.7fr)) minmax(135px,.6fr) minmax(140px,.55fr) minmax(140px,.55fr);gap:8px;margin:12px 0 14px}.rc1084-filters label{display:grid;gap:4px;font-size:11px;font-weight:700;color:#475569}.rc1084-filters input,.rc1084-filters select{min-height:40px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;background:var(--surface,#fff);color:inherit}.rc1084-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.rc1084-table-wrap{width:100%;overflow-x:auto;border:1px solid #dbe4ec;border-radius:12px;background:var(--surface,#fff)}.rc1084-table{width:100%;border-collapse:collapse;min-width:980px}.rc1084-table th{padding:9px 10px;background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.03em;text-align:left;border-bottom:1px solid #dbe4ec}.rc1084-table td{padding:10px;border-bottom:1px solid #e7edf3;vertical-align:top;font-size:12px}.rc1084-table tr:last-child td{border-bottom:0}.rc1084-table tbody tr:hover{background:#f8fafc}.rc1084-time{white-space:nowrap;color:#475569}.rc1084-area{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef6ff;color:#1d4ed8;font-weight:750;white-space:nowrap}.rc1084-action-title{font-weight:800;color:#0f172a}.rc1084-user{font-weight:700}.rc1084-object{font-weight:700;color:#334155}.rc1084-detail{color:#64748b;line-height:1.35}.rc1084-empty{padding:24px;text-align:center;color:#64748b}.rc1084-count{font-size:12px;color:#64748b;margin-top:5px}@media(max-width:1180px){.rc1084-filters{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.rc1084-summary{grid-template-columns:1fr 1fr}.rc1084-filters{grid-template-columns:1fr 1fr}.rc1084-table{min-width:0}.rc1084-table thead{display:none}.rc1084-table,.rc1084-table tbody,.rc1084-table tr,.rc1084-table td{display:block;width:100%}.rc1084-table tr{padding:8px 10px;border-bottom:1px solid #dbe4ec}.rc1084-table td{display:grid;grid-template-columns:105px 1fr;gap:8px;padding:5px 0;border:0}.rc1084-table td:before{content:attr(data-label);font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b}.rc1084-table tbody tr:last-child{border-bottom:0}}@media(max-width:520px){.rc1084-summary,.rc1084-filters{grid-template-columns:1fr}}';
 (d.head||d.documentElement).appendChild(s)
}
function csvCell(v){var x=String(v==null?'':v);return '"'+x.replace(/"/g,'""')+'"'}
function currentFiltered(){return filterEvents(allEvents())}
function exportCsv(){
 var rows=[['Datum/Uhrzeit','Bereich','Aktion','Benutzer','Objekt','Referenz/Konto','Details']];
 currentFiltered().forEach(function(e){rows.push([fmt(e.at),typeLabel(e.type),actionTitle(e),actorName(e),e.entity,e.entityId||'',detailText(e)])});
 var csv='\ufeff'+rows.map(function(r){return r.map(csvCell).join(';')}).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=d.createElement('a');
 a.href=url;a.download='ExportHUB_Historie_'+new Date().toISOString().slice(0,10)+'.csv';d.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)
}
function printHistory(){
 var rows=currentFiltered(),body=rows.map(function(e){return'<tr><td>'+esc(fmt(e.at))+'</td><td>'+esc(typeLabel(e.type))+'</td><td><b>'+esc(actionTitle(e))+'</b>'+(detailText(e)?'<br><small>'+esc(detailText(e))+'</small>':'')+'</td><td>'+esc(actorName(e))+'</td><td>'+esc(e.entity)+(e.entityId?' · '+esc(e.entityId):'')+'</td></tr>'}).join('');
 var html='<!doctype html><html lang="de"><head><meta charset="utf-8"><title>ExportHUB Historie</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a}h1{margin:0 0 4px}.meta{margin:0 0 12px;color:#475569}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top;font-size:10px}th{background:#e2e8f0}small{color:#475569}</style></head><body><h1>ExportHUB · Historie</h1><p class="meta">'+rows.length+' Einträge · erstellt '+esc(fmt(new Date().toISOString()))+'</p><table><thead><tr><th>Datum/Uhrzeit</th><th>Bereich</th><th>Aktion</th><th>Benutzer</th><th>Objekt</th></tr></thead><tbody>'+body+'</tbody></table></body></html>',pw=w.open('about:blank','_blank','width=1200,height=820');
 if(!pw)return false;pw.opener=null;pw.document.open();pw.document.write(html);pw.document.close();var run=function(){try{pw.focus();pw.print()}catch(_){}};if(pw.document.readyState==='complete')setTimeout(run,200);else pw.addEventListener('load',function(){setTimeout(run,150)},{once:true});return true
}
function render(){
 var old=d.getElementById('rc1081AuditHistory');
 if(!historyView()){if(old)old.remove();return false}
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 if(!old){host.innerHTML='';host.classList.add('rc1082-history-view');host.setAttribute('data-exporthub-rendered-view','history');old=d.createElement('section');old.id='rc1081AuditHistory';old.className='card rc1084-history';host.appendChild(old)}
 var events=allEvents(),actors=actorList(events),actions=actionList(events),filtered=filterEvents(events),
     entities=Array.from(new Set(events.map(function(e){return q(e.entity)}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'de')});
 var typeOptions=[['all','Alle Bereiche'],['shipment','Sendungen'],['customer','Kunden'],['audit','Benutzer & System']].map(function(x){return'<option value="'+x[0]+'"'+(FILTER.type===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('');
 var actionOptions='<option value="all">Alle Aktionen</option>'+actions.map(function(a){return'<option value="'+esc(a.key)+'"'+(FILTER.subtype===a.key?' selected':'')+'>'+esc(a.label)+' · '+esc(a.area)+'</option>'}).join('');
 var actorOptions='<option value="all">Alle Benutzer</option>'+actors.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.actor===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
 var entityOptions='<option value="all">Alle Objekte</option>'+entities.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.entity===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
 var rows=filtered.length?filtered.map(function(e){var det=detailText(e);return'<tr><td class="rc1084-time" data-label="Zeitpunkt">'+esc(fmt(e.at))+'</td><td data-label="Bereich"><span class="rc1084-area">'+esc(typeLabel(e.type))+'</span></td><td data-label="Aktion"><div class="rc1084-action-title">'+esc(actionTitle(e))+'</div></td><td data-label="Benutzer"><div class="rc1084-user">'+esc(actorName(e))+'</div>'+(e.actor&&e.actor.role?'<div class="rc1084-detail">'+esc(e.actor.role)+'</div>':'')+'</td><td data-label="Objekt"><div class="rc1084-object">'+esc(e.entity)+'</div>'+(e.entityId?'<div class="rc1084-detail">'+esc(e.entityId)+'</div>':'')+'</td><td data-label="Details"><div class="rc1084-detail">'+esc(det||'—')+'</div></td></tr>'}).join(''):'<tr><td colspan="6" class="rc1084-empty">Keine Einträge für die gewählten Filter gefunden.</td></tr>';
 old.innerHTML='<div class="rc1084-head"><div><span class="pill blue">AKTIVITÄTSVERLAUF</span><h3>Historie</h3><div class="muted">Alle protokollierten Aktionen aus Sendungen, Kunden, Benutzern und System in einer vollständigen deutschen Übersicht.</div><div class="rc1084-count">'+events.length+' Aktionen im verfügbaren Datenbestand · '+filtered.length+' aktuell angezeigt</div></div><div class="rc1084-actions"><button type="button" class="btn ghost" data-rc1081-reset>Filter zurücksetzen</button><button type="button" class="btn ghost" data-rc1081-csv>CSV exportieren</button><button type="button" class="btn" data-rc1081-print>Drucken</button></div></div><div class="rc1084-summary"><div class="rc1084-summary-card"><b>'+events.length+'</b><span>Alle Aktionen</span></div><div class="rc1084-summary-card"><b>'+countType(events,'shipment')+'</b><span>Sendungen</span></div><div class="rc1084-summary-card"><b>'+countType(events,'customer')+'</b><span>Kunden</span></div><div class="rc1084-summary-card"><b>'+countType(events,'audit')+'</b><span>Benutzer & System</span></div></div><div class="rc1084-filters"><label>Suche<input data-rc1081-q placeholder="Benutzer, Referenz, Kunde, Aktion oder Detail …" value="'+esc(FILTER.query)+'"></label><label>Bereich<select data-rc1081-type>'+typeOptions+'</select></label><label>Aktion<select data-rc1081-subtype>'+actionOptions+'</select></label><label>Benutzer<select data-rc1081-actor>'+actorOptions+'</select></label><label>Objekt<select data-rc1081-entity>'+entityOptions+'</select></label><label>Zeitraum<select data-rc1081-days><option value="0"'+(FILTER.days===0?' selected':'')+'>Gesamter Bestand</option><option value="7"'+(FILTER.days===7?' selected':'')+'>7 Tage</option><option value="30"'+(FILTER.days===30?' selected':'')+'>30 Tage</option><option value="90"'+(FILTER.days===90?' selected':'')+'>90 Tage</option><option value="180"'+(FILTER.days===180?' selected':'')+'>180 Tage</option><option value="365"'+(FILTER.days===365?' selected':'')+'>12 Monate</option></select></label><label>Von<input type="date" data-rc1081-from value="'+esc(FILTER.from)+'"></label><label>Bis<input type="date" data-rc1081-to value="'+esc(FILTER.to)+'"></label></div><div class="rc1084-table-wrap"><table class="rc1084-table" data-rc1084-history-table><thead><tr><th>Zeitpunkt</th><th>Bereich</th><th>Aktion</th><th>Benutzer</th><th>Objekt</th><th>Details</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 ensureStyle();
 var qf=old.querySelector('[data-rc1081-q]'),tf=old.querySelector('[data-rc1081-type]'),sf=old.querySelector('[data-rc1081-subtype]'),af=old.querySelector('[data-rc1081-actor]'),ef=old.querySelector('[data-rc1081-entity]'),df=old.querySelector('[data-rc1081-days]'),ff=old.querySelector('[data-rc1081-from]'),tof=old.querySelector('[data-rc1081-to]');
 if(qf)qf.addEventListener('input',function(){FILTER.query=this.value;render()});
 if(tf)tf.addEventListener('change',function(){FILTER.type=this.value;render()});
 if(sf)sf.addEventListener('change',function(){FILTER.subtype=this.value;render()});
 if(af)af.addEventListener('change',function(){FILTER.actor=this.value;render()});
 if(ef)ef.addEventListener('change',function(){FILTER.entity=this.value;render()});
 if(df)df.addEventListener('change',function(){FILTER.days=Number(this.value)||0;render()});
 if(ff)ff.addEventListener('change',function(){FILTER.from=this.value;render()});
 if(tof)tof.addEventListener('change',function(){FILTER.to=this.value;render()});
 var reset=old.querySelector('[data-rc1081-reset]'),csv=old.querySelector('[data-rc1081-csv]'),pr=old.querySelector('[data-rc1081-print]');
 if(reset)reset.addEventListener('click',function(){FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:0,from:'',to:''};render()});
 if(csv)csv.addEventListener('click',exportCsv);
 if(pr)pr.addEventListener('click',printHistory);
 return true
}
function schedule(){w.setTimeout(function(){try{render()}catch(e){try{console.warn('RC1084 Historie',e)}catch(_){}}},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:user-profile-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1081AuditHistory=Object.freeze({version:'RC1084',events:allEvents,render:render,filter:filterEvents,exportCsv:exportCsv,print:printHistory,historyView:historyView,actionLabel:actionLabel});
})(window,document);
