// ExportHUB RC1081 – zentrale Aktivitäts- und Audit-History im Archiv.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1081_AUDIT_HISTORY__)return;
w.__EXPORTHUB_RC1081_AUDIT_HISTORY__=true;

var FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:365,from:'',to:''};

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
function customerId(c){return q(c&&(c.id||c.customerId||c.account||c.customerNumber||c.kundennummer||c.name||c.customerName)).toUpperCase()}
function customerName(c){return q(c&&(c.name||c.customerName||c.companyName||c.account||c.customerNumber))||'Kunde'}
function actorName(e){return q(e&&e.actor&&e.actor.name||e&&e.actor||e&&e.by||e&&e.user)||'System'}
function eventKey(e){return q(e&&e.id)||[q(e&&e.at),q(e&&e.type),q(e&&e.label),actorName(e),q(e&&e.entityId)].join('|').toLowerCase()}
function pushUnique(map,e){if(!e||!q(e.at))return;var k=eventKey(e);if(!k)return;if(!map.has(k))map.set(k,e)}

var AUDIT_LABELS={
 LOGIN_SUCCESS:'Anmeldung erfolgreich',
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
 SESSIONS_TERMINATED:'Sitzung(en) durch Administrator beendet',
 INITIAL_ADMIN_BOOTSTRAPPED:'Admin-Zugang eingerichtet',
 INITIAL_ADMIN_RECOVERED:'Admin-Zugang wiederhergestellt',
 ADMIN_ACCOUNT_UNLOCKED_WITH_PERSONAL_PASSWORD:'Admin-Konto entsperrt',
 DIAGNOSTIC_AUTOFIX_REQUESTED:'Fehler an ChatGPT / Codex zur Behebung übergeben',
 DIAGNOSTIC_AUTOFIX_FIXED:'Fehler durch ChatGPT / Codex behoben',
 DIAGNOSTIC_AUTOFIX_FAILED:'Automatische Fehlerbehebung fehlgeschlagen'
};

function auditEvent(e){
 var details=e&&e.details||{},label=AUDIT_LABELS[q(e&&e.type)]||q(e&&e.type).replace(/_/g,' ')||'Audit-Ereignis';
 var entity='System',entityId=q(details.userId||details.username);
 if(entityId)entity='Benutzer';
 return{
   id:q(e&&e.id),at:q(e&&e.at),type:'audit',subtype:q(e&&e.type),label:label,
   actor:{name:actorName(e)},entity:entity,entityId:entityId,details:details,source:'audit'
 }
}
function shipmentEvent(sh,e){
 var ref=shipmentRef(sh)||identity(sh)||'Sendung';
 return{
  id:q(e&&e.id),at:q(e&&e.at),type:'shipment',subtype:q(e&&e.type),label:q(e&&e.label)||'Sendungsereignis',
  actor:e&&e.actor||{name:actorName(e)},entity:'Sendung',entityId:ref,details:e&&e.details||{},source:'shipment'
 }
}
function customerEvent(c,e){
 return{
  id:q(e&&e.id),at:q(e&&e.at),type:'customer',subtype:q(e&&e.type),label:q(e&&e.label)||'Kundenereignis',
  actor:e&&e.actor||{name:actorName(e)},entity:'Kunde',entityId:q(c&&c.account||c&&c.customerNumber||c&&c.kundennummer)||customerName(c),details:e&&e.details||{},source:'customer'
 }
}
function allShipments(){
 var s=state(),list=[];
 ['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments'].forEach(function(k){
  arr(s[k]).forEach(function(sh){if(sh&&typeof sh==='object')list.push(sh)})
 });
 return list
}
function allEvents(){
 var s=state(),map=new Map();
 arr(s.auditLog).forEach(function(e){pushUnique(map,auditEvent(e))});
 allShipments().forEach(function(sh){arr(sh&&sh.shipmentHistory).forEach(function(e){pushUnique(map,shipmentEvent(sh,e))})});
 arr(s.customers).forEach(function(c){arr(c&&c.customerHistory).forEach(function(e){pushUnique(map,customerEvent(c,e))})});
 return Array.from(map.values()).sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)})
}
function detailText(e){
 var x=e&&e.details||{},parts=[];
 if(x.username)parts.push('Benutzer: '+q(x.username));
 if(x.previousName||x.displayName)parts.push((x.previousName?q(x.previousName)+' → ':'')+q(x.displayName));
 if(x.document)parts.push(q(x.document));
 if(x.to)parts.push('An: '+q(x.to));
 if(x.from&&x.to)parts.push(q(x.from)+' → '+q(x.to));
 if(x.fields)parts.push('Geändert: '+q(x.fields));
 if(x.status)parts.push('Status: '+q(x.status));
 if(x.from&&x.to&&!x.document)parts.push(q(x.from)+' → '+q(x.to));
 if(x.reference)parts.push('Ref: '+q(x.reference));
 if(x.date)parts.push('Datum: '+q(x.date)+(x.time?' '+q(x.time):''));
 if(x.driver)parts.push('Fahrer: '+q(x.driver));
 if(x.licensePlate)parts.push('Kennzeichen: '+q(x.licensePlate));
 if(Number.isFinite(Number(x.colli)))parts.push('Colli: '+Number(x.colli));
 if(Number.isFinite(Number(x.terminated))&&Number(x.terminated)>0)parts.push('Beendet: '+Number(x.terminated));
 return Array.from(new Set(parts.filter(Boolean))).join(' · ')
}
function actorList(events){return Array.from(new Set(events.map(function(e){return actorName(e)}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'de')})}
function filterEvents(events){
 var days=Number(FILTER.days||0),cutoff=days>0?Date.now()-days*86400000:0,needle=low(FILTER.query),
     from=FILTER.from?Date.parse(FILTER.from+'T00:00:00'):0,to=FILTER.to?Date.parse(FILTER.to+'T23:59:59.999'):0;
 return events.filter(function(e){
  var ts=Date.parse(e.at||'');
  if(cutoff&&Number.isFinite(ts)&&ts<cutoff)return false;
  if(from&&Number.isFinite(ts)&&ts<from)return false;
  if(to&&Number.isFinite(ts)&&ts>to)return false;
  if(FILTER.type!=='all'&&e.type!==FILTER.type)return false;
  if(FILTER.subtype!=='all'&&q(e.subtype)!==FILTER.subtype)return false;
  if(FILTER.actor!=='all'&&actorName(e)!==FILTER.actor)return false;
  if(FILTER.entity!=='all'&&q(e.entity)!==FILTER.entity)return false;
  if(!needle)return true;
  var rawDetails='';try{rawDetails=JSON.stringify(e.details||{})}catch(_){}
  return low([e.label,e.entity,e.entityId,actorName(e),e.actor&&e.actor.role,e.subtype,e.source,detailText(e),rawDetails,fmt(e.at)].join(' ')).indexOf(needle)>=0
 })
}
function typeLabel(type){return({shipment:'Sendungen',customer:'Kunden',audit:'System / Benutzer'})[type]||type}
function typeIcon(type){return({shipment:'S',customer:'K',audit:'A'})[type]||'•'}
function ensureStyle(){
 if(d.getElementById('rc1081AuditHistoryStyle'))return;
 var s=d.createElement('style');s.id='rc1081AuditHistoryStyle';
 s.textContent='.rc1081-audit{margin-top:16px}.rc1081-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.rc1081-filters{display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(4,minmax(140px,.7fr)) minmax(130px,.6fr) minmax(135px,.55fr) minmax(135px,.55fr);gap:8px;margin:12px 0}.rc1081-filters label{display:grid;gap:3px;font-size:11px;font-weight:700;color:#475569}.rc1081-filters input,.rc1081-filters select{min-height:40px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}.rc1081-list{display:grid;gap:8px;max-height:620px;overflow:auto;padding-right:4px}.rc1081-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;padding:10px 12px;border:1px solid #dbe4ec;border-radius:10px;background:#fff;align-items:start}.rc1081-icon{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#eef6ff;font-weight:800}.rc1081-label{font-weight:750}.rc1081-meta,.rc1081-detail{font-size:12px;color:#64748b;margin-top:2px}.rc1081-entity{font-size:12px;font-weight:700;color:#334155;white-space:nowrap}.rc1081-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b}.rc1081-stats{display:flex;gap:6px;flex-wrap:wrap}@media(max-width:1100px){.rc1081-filters{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.rc1081-filters{grid-template-columns:1fr 1fr}.rc1081-row{grid-template-columns:30px 1fr}.rc1081-entity{grid-column:2;white-space:normal}}@media(max-width:520px){.rc1081-filters{grid-template-columns:1fr}}';
 (d.head||d.documentElement).appendChild(s)
}
function csvCell(v){var x=String(v==null?'':v);return '"'+x.replace(/"/g,'""')+'"'}
function currentFiltered(){return filterEvents(allEvents())}
function exportCsv(){
 var rows=[['Datum/Uhrzeit','Bereich','Aktion','Benutzer','Objekt','Referenz/Konto','Details']];
 currentFiltered().forEach(function(e){rows.push([fmt(e.at),typeLabel(e.type),e.label,actorName(e),e.entity,e.entityId||'',detailText(e)])});
 var csv='\ufeff'+rows.map(function(r){return r.map(csvCell).join(';')}).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=d.createElement('a');
 a.href=url;a.download='ExportHUB_History_'+new Date().toISOString().slice(0,10)+'.csv';d.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)
}
function printHistory(){
 var rows=currentFiltered(),body=rows.map(function(e){return'<tr><td>'+esc(fmt(e.at))+'</td><td>'+esc(typeLabel(e.type))+'</td><td><b>'+esc(e.label)+'</b>'+(detailText(e)?'<br><small>'+esc(detailText(e))+'</small>':'')+'</td><td>'+esc(actorName(e))+'</td><td>'+esc(e.entity)+(e.entityId?' · '+esc(e.entityId):'')+'</td></tr>'}).join('');
 var html='<!doctype html><html lang="de"><head><meta charset="utf-8"><title>ExportHUB History</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a}h1{margin:0 0 4px}.meta{margin:0 0 12px;color:#475569}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top;font-size:10px}th{background:#e2e8f0}small{color:#475569}</style></head><body><h1>ExportHUB · Aktivitäts- und Audit-History</h1><p class="meta">'+rows.length+' Einträge · erstellt '+esc(fmt(new Date().toISOString()))+'</p><table><thead><tr><th>Datum/Uhrzeit</th><th>Bereich</th><th>Aktion</th><th>Benutzer</th><th>Objekt</th></tr></thead><tbody>'+body+'</tbody></table></body></html>',pw=w.open('about:blank','_blank','width=1200,height=820');
 if(!pw)return false;pw.opener=null;pw.document.open();pw.document.write(html);pw.document.close();var run=function(){try{pw.focus();pw.print()}catch(_){}};if(pw.document.readyState==='complete')setTimeout(run,200);else pw.addEventListener('load',function(){setTimeout(run,150)},{once:true});return true
}
function render(){
 var old=d.getElementById('rc1081AuditHistory');
 if(!historyView()){if(old)old.remove();return false}
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 if(!old){
   host.innerHTML='';
   host.classList.add('rc1082-history-view');
   host.setAttribute('data-exporthub-rendered-view','history');
   old=d.createElement('section');old.id='rc1081AuditHistory';old.className='card rc1081-audit';host.appendChild(old)
 }
 var events=allEvents(),actors=actorList(events),filtered=filterEvents(events),
     subtypes=Array.from(new Set(events.map(function(e){return q(e.subtype)}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'de')}),
     entities=Array.from(new Set(events.map(function(e){return q(e.entity)}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'de')});
 var typeOptions=[['all','Alle Bereiche'],['shipment','Sendungen'],['customer','Kunden'],['audit','System / Benutzer']].map(function(x){return'<option value="'+x[0]+'"'+(FILTER.type===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('');
 var subtypeOptions='<option value="all">Alle Aktionen</option>'+subtypes.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.subtype===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
 var actorOptions='<option value="all">Alle Benutzer</option>'+actors.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.actor===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
 var entityOptions='<option value="all">Alle Objekte</option>'+entities.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.entity===a?' selected':'')+'>'+esc(a)+'</option>'}).join('');
 var rows=filtered.length?filtered.map(function(e){
  var det=detailText(e);
  return'<div class="rc1081-row"><div class="rc1081-icon">'+esc(typeIcon(e.type))+'</div><div><div class="rc1081-label">'+esc(e.label)+'</div><div class="rc1081-meta">'+esc(fmt(e.at))+' · '+esc(actorName(e))+' · '+esc(typeLabel(e.type))+'</div>'+(det?'<div class="rc1081-detail">'+esc(det)+'</div>':'')+'</div><div class="rc1081-entity">'+esc(e.entity)+(e.entityId?' · '+esc(e.entityId):'')+'</div></div>'
 }).join(''):'<div class="rc1081-empty">Keine History-Einträge für die gewählten Filter gefunden.</div>';
 old.innerHTML='<div class="rc1081-head"><div><span class="pill blue">HISTORY</span><h3>History</h3><div class="muted">Alle nachvollziehbaren Aktionen aus Sendungen, Kunden, Benutzern und System zentral filtern.</div></div><div class="rc1081-stats"><span class="pill gray">'+filtered.length+' angezeigt</span><span class="pill gray">'+events.length+' gesamt</span><button type="button" class="btn ghost" data-rc1081-reset>Filter zurücksetzen</button><button type="button" class="btn ghost" data-rc1081-csv>CSV exportieren</button><button type="button" class="btn" data-rc1081-print>Drucken</button></div></div><div class="rc1081-filters"><input data-rc1081-q placeholder="Suche nach Benutzer, Referenz, Kunde, Aktion, Detail …" value="'+esc(FILTER.query)+'"><select data-rc1081-type>'+typeOptions+'</select><select data-rc1081-subtype>'+subtypeOptions+'</select><select data-rc1081-actor>'+actorOptions+'</select><select data-rc1081-entity>'+entityOptions+'</select><select data-rc1081-days><option value="0"'+(FILTER.days===0?' selected':'')+'>Gesamter Bestand</option><option value="7"'+(FILTER.days===7?' selected':'')+'>7 Tage</option><option value="30"'+(FILTER.days===30?' selected':'')+'>30 Tage</option><option value="90"'+(FILTER.days===90?' selected':'')+'>90 Tage</option><option value="180"'+(FILTER.days===180?' selected':'')+'>180 Tage</option><option value="365"'+(FILTER.days===365?' selected':'')+'>12 Monate</option></select><label>Von<input type="date" data-rc1081-from value="'+esc(FILTER.from)+'"></label><label>Bis<input type="date" data-rc1081-to value="'+esc(FILTER.to)+'"></label></div><div class="rc1081-list">'+rows+'</div>';
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
 if(reset)reset.addEventListener('click',function(){FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:365,from:'',to:''};render()});
 if(csv)csv.addEventListener('click',exportCsv);
 if(pr)pr.addEventListener('click',printHistory);
 return true
}
function schedule(){w.setTimeout(function(){try{render()}catch(e){try{console.warn('RC1081 Audit-History',e)}catch(_){}}},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:user-profile-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1081AuditHistory=Object.freeze({version:'RC1082',events:allEvents,render:render,filter:filterEvents,exportCsv:exportCsv,print:printHistory,historyView:historyView});
})(window,document);
