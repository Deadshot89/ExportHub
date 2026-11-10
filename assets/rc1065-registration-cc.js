// ExportHUB RC1065 finaler Runtime-Marker; autoritativer Produktionsrelease bleibt RC1048.
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1065_REGISTRATION_CC__)return;
w.__EXPORTHUB_RC1065_REGISTRATION_CC__=true;

var REQUIRED=Object.freeze(['Sevastian Marcu','Daniel Ollmann']);
var DEFAULTS=Object.freeze({'sevastian marcu':'SevastianMarcu@essentra.com','daniel ollmann':'DanielOllmann@essentra.com'});
var REQUIRED_DEFAULTS=Object.freeze(REQUIRED.map(function(name){return{name:name,email:DEFAULTS[norm(name)]}}));

function q(v){return String(v==null?'':v).trim()}
function tr(key,vars,language){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars,language)}catch(_){}return key}
function norm(v){return q(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function mail(v){var m=q(v).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);return m?m[0]:''}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function configured(){
 var s=state(),raw=(s.settings&&s.settings.registrationMandatoryCc)||s.registrationMandatoryCc||w.__EXPORTHUB_REGISTRATION_CC__,out=[];
 (Array.isArray(raw)?raw:[]).forEach(function(x){
  if(typeof x==='string'){var e=mail(x);if(e)out.push({name:'',email:e});return}
  if(x&&typeof x==='object'){var e=mail(x.email||x.mail||x.emailAddress||x.userPrincipalName||x.upn),n=q(x.name||x.displayName||x.fullName);if(e)out.push({name:n,email:e})}
 });
 return out
}
function candidates(){
 var s=state(),nested=[s.state,s.team,s.data],runtime=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},lists=[s.users,s.userAccounts,s.accounts,s.members,s.employees,s.staff,s.people,s.directoryUsers,runtime.users,runtime.userAccounts],out=[];
 nested.forEach(function(root){if(root&&typeof root==='object')lists.push(root.users,root.userAccounts,root.accounts,root.members)});
 lists.forEach(function(list){if(Array.isArray(list))list.forEach(function(x){if(x&&typeof x==='object')out.push(x)})});
 return out
}
function nameOf(x){return q(x&&(x.name||x.displayName||x.fullName||([x.firstName,x.lastName].filter(Boolean).join(' '))||x.userName||x.username||x.user||x.login))}
function emailOf(x){
 if(!x||typeof x!=='object')return'';
 var direct=mail(x.email||x.mail||x.emailAddress||x.userPrincipalName||x.upn||x.workEmail||x.businessEmail||x.primaryEmail||x.login);
 if(direct)return direct;
 var nested=[x.contact,x.profile,x.directory,x.account];for(var i=0;i<nested.length;i++){var e=mail(nested[i]&&(nested[i].email||nested[i].mail||nested[i].emailAddress||nested[i].userPrincipalName||nested[i].upn));if(e)return e}
 var list=Array.isArray(x.emails)?x.emails:[];for(var j=0;j<list.length;j++){var item=list[j],e2=mail(typeof item==='string'?item:(item&&item.address||item&&item.email));if(e2)return e2}
 return''
}
function compact(v){return norm(v).replace(/\s+/g,'')}
function emailLocal(v){var e=emailOf(v);return e?compact(e.split('@')[0]):''}
function requiredAliases(required){var parts=norm(required).split(/\s+/).filter(Boolean),full=parts.join(''),first=parts[0]||'',last=parts[parts.length-1]||'',out=[full];if(first&&last){out.push(first.charAt(0)+last,last+first.charAt(0))}return out}
function matchesRequired(x,required){
 if(!x)return false;var key=norm(required),aliases=requiredAliases(required),names=[nameOf(x),x.user,x.login,x.username,x.userName,x.displayName,x.fullName];
 for(var i=0;i<names.length;i++){var n=norm(names[i]);if(n&&n===key)return true;var c=compact(names[i]);if(c&&aliases.indexOf(c)>=0)return true}
 var local=emailLocal(x);return !!(local&&aliases.indexOf(local)>=0)
}
function resolve(){
 var cfg=configured(),rows=candidates(),addresses=[],missing=[];
 REQUIRED.forEach(function(required){
  var fallback=mail(DEFAULTS[norm(required)])||'',found=cfg.find(function(x){return matchesRequired(x,required)})||rows.find(function(x){return matchesRequired(x,required)}),e=found&&emailOf(found)||fallback;
  if(e)addresses.push(e);else missing.push(required)
 });
 return{ok:missing.length===0,addresses:Array.from(new Set(addresses.map(function(x){return x.toLowerCase()}))),missing:missing}
}
function isRegistration(url){
 var raw=q(url);if(!/^mailto:/i.test(raw))return false;
 var decoded=raw;try{decoded=decodeURIComponent(raw.replace(/\+/g,' '))}catch(_){}
 return /(?:versand|sendungs)?anmeld|registration/i.test(decoded)
}
function decodeQueryValue(v){try{return decodeURIComponent(q(v).replace(/\\+/g,' '))}catch(_){return q(v)}}
function mergeRequiredCc(raw,requiredAddresses){
 var qm=raw.indexOf('?'),base=qm>=0?raw.slice(0,qm):raw,query=qm>=0?raw.slice(qm+1):'',parts=query?query.split('&'):[],ccIndex=-1,existing=[];
 for(var i=0;i<parts.length;i++){
  var eq=parts[i].indexOf('='),key=decodeQueryValue(eq>=0?parts[i].slice(0,eq):parts[i]).toLowerCase();
  if(key!=='cc')continue;
  ccIndex=i;
  var value=decodeQueryValue(eq>=0?parts[i].slice(eq+1):'');
  value.split(/[;,]/).map(mail).filter(Boolean).forEach(function(e){if(!existing.some(function(x){return x.toLowerCase()===e.toLowerCase()}))existing.push(e)});
  break
 }
 (requiredAddresses||[]).forEach(function(e){e=mail(e);if(e&&!existing.some(function(x){return x.toLowerCase()===e.toLowerCase()}))existing.push(e)});
 var ccPart='cc='+encodeURIComponent(existing.join(';'));
 if(ccIndex>=0)parts[ccIndex]=ccPart;else parts.push(ccPart);
 return base+'?'+parts.join('&')
}
function prepare(url){
 var raw=q(url);if(!isRegistration(raw))return{ok:true,url:raw,required:false,missing:[]};
 var r=resolve();if(!r.ok)return{ok:false,url:raw,required:true,missing:r.missing};
 return{ok:true,url:withRegistrationClosureNotice(mergeRequiredCc(raw,r.addresses)),required:true,missing:[]}
}
function block(p){
 var names=(p&&p.missing||[]).join(', '),msg=tr('registrationCc.blocked',{names:names?': '+names:''});
 try{w.alert(msg)}catch(_){}
 return false
}
if(w.document&&w.document.addEventListener)w.document.addEventListener('click',function(ev){
 var a=ev.target&&ev.target.closest&&ev.target.closest('a[href^="mailto:"]');if(!a)return;
 var p=prepare(a.getAttribute('href'));if(!p.ok){ev.preventDefault();ev.stopImmediatePropagation();block(p);return}
 if(p.url!==a.getAttribute('href'))a.setAttribute('href',p.url)
},true);
var nativeOpen=typeof w.open==='function'?w.open.bind(w):null;
if(nativeOpen)w.open=function(url,target,features){var p=prepare(url);if(!p.ok){block(p);return null}return nativeOpen(p.url,target,features)};

function currentUser(){
 try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function')return w.__EXPORTHUB_GET_CURRENT_USER__()||{}}catch(_){}
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user}catch(_){}
 var s=state();return s.currentUser||s.user||{}
}
function globalAdmin(){
 var u=currentUser()||{},role=norm(u.role||u.rolle||u.level||u.type),perms=Array.isArray(u.permissions)?u.permissions:[],roles=['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'];
 return u.globalAdmin===true||u.isGlobalAdmin===true||perms.indexOf('*')>=0||roles.indexOf(role)>=0
}
function viewName(){
 var s=state(),v=q(s.view||s.currentView||s.activeView||s.page||'');
 if(v)return norm(v);
 try{
  var active=w.document&&w.document.querySelector&&w.document.querySelector('[data-view].active,[data-view][aria-current="page"]');
  if(active)return norm(active.getAttribute('data-view')||active.textContent)
 }catch(_){}
 return''
}
function settingsVisible(){var v=viewName();return v==='settings'||v==='einstellungen'||/\bsettings\b|\beinstellungen\b/.test(v)}
function configuredEmail(name){
 var key=norm(name),row=configured().find(function(x){return matchesRequired(x,name)}),user=candidates().find(function(x){return matchesRequired(x,name)});
 return row&&emailOf(row)||user&&emailOf(user)||mail(DEFAULTS[key])||''
}
function ccSettingsStatus(node,text,kind){
 if(!node)return;
 node.textContent=text||'';
 node.setAttribute('data-kind',kind||'info')
}
async function persistCcSettings(next){
 var s=state();s.settings=s.settings&&typeof s.settings==='object'?s.settings:{};
 var previous=s.settings.registrationMandatoryCc;
 s.settings.registrationMandatoryCc=next;
 try{
  var clean=w.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error(tr('registrationCc.storageUnavailable'));
  await clean.queueSave('Pflicht-CC Anmeldung gespeichert');
  var ok=await clean.flushSave('Pflicht-CC Anmeldung gespeichert',{force:true,userInitiated:true});
  if(ok!==true)throw new Error(tr('registrationCc.storageUnconfirmed'));
  try{w.dispatchEvent(new CustomEvent('exporthub:registration-cc-updated',{detail:{required:REQUIRED.slice()}}))}catch(_){}
  return true
 }catch(e){
  if(previous===undefined)delete s.settings.registrationMandatoryCc;else s.settings.registrationMandatoryCc=previous;
  throw e
 }
}
function ensureCcStyle(){
 if(!w.document||w.document.getElementById('rc1065RegistrationCcStyle'))return;
 var style=w.document.createElement('style');style.id='rc1065RegistrationCcStyle';
 style.textContent='.rc1065-cc-settings{margin-top:16px}.rc1065-cc-settings .rc1065-cc-grid{display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:12px}.rc1065-cc-settings label{display:grid;gap:6px;font-weight:700}.rc1065-cc-settings input{min-height:42px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:8px}.rc1065-cc-settings .rc1065-cc-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}.rc1065-cc-settings [data-kind="error"]{color:#b91c1c}.rc1065-cc-settings [data-kind="ok"]{color:#166534}@media(max-width:720px){.rc1065-cc-settings .rc1065-cc-grid{grid-template-columns:1fr}}';
 (w.document.head||w.document.documentElement).appendChild(style)
}

/* Shipping closure notices are deliberately separate from the task planner calendar:
   a task closure does not prove the final carrier collection or reopening date. */
function closureEntries(){
 var v=state().settings&&state().settings.closureNotices;
 return Array.isArray(v)?v.map(function(x){return Object.assign({},x)}):[]
}
function safeDay(v){
 v=q(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return'';
 var t=new Date(v+'T12:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===v?v:''
}
function registrationMailLanguage(){
 var i=w.ExportHUBI18n||{},v='';
 // A separately selected email language takes precedence over the site language.
 try{var selector=w.document&&w.document.getElementById&&w.document.getElementById('rc543MailLang');v=q(selector&&selector.value)}catch(_){}
 if(!v)try{v=typeof i.language==='function'?i.language():i.language||i.currentLanguage||''}catch(_){}
 v=q(v).toLowerCase().replace('_','-');
 var m=v.match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'
}
var CLOSURE_MAIL_FALLBACK=Object.freeze({
 de:{title:'Wichtige Information zu unseren Betriebsferien',last:'Letzte Abholung',closed:'Geschlossen',resume:'Wieder geöffnet ab'},
 en:{title:'Important notice – Holiday closure',last:'Last collection',closed:'Closed',resume:'Reopening'},
 pl:{title:'Ważna informacja – Przerwa w pracy',last:'Ostatni odbiór',closed:'Zamknięte',resume:'Ponowne otwarcie'},
 es:{title:'Información importante – Cierre temporal',last:'Última recogida',closed:'Cerrado',resume:'Reapertura'},
 fr:{title:'Information importante – Fermeture',last:'Dernier enlèvement',closed:'Fermé',resume:'Réouverture'},
 it:{title:'Informazione importante – Chiusura',last:'Ultimo ritiro',closed:'Chiuso',resume:'Riapertura'}
});
function closureMailLabel(key,lang){
 var value=tr('closureMail.mail'+({title:'Title',last:'Last',closed:'Closed',resume:'Resume'}[key]||''),null,lang);
 if(value&&value!=='closureMail.mail'+({title:'Title',last:'Last',closed:'Closed',resume:'Resume'}[key]||''))return value;
 return (CLOSURE_MAIL_FALLBACK[lang]||CLOSURE_MAIL_FALLBACK.de)[key]||''
}
function registrationClosureNotices(language){
 var m=q(language).toLowerCase().replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);
 var rows=closureEntries(),lang=m?m[1]:registrationMailLanguage(),locale={de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'}[lang];
 if(!rows.length)return '';
 var today='';
 try{
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date());
  var part=function(k){var x=parts.find(function(v){return v.type===k});return x&&x.value||''};
  today=part('year')+'-'+part('month')+'-'+part('day')
 }catch(_){return''}
 function mailDate(day){return new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'))}
 var out=[],seen={},marker='=== ExportHUB360 ===';
 rows.slice(0,100).forEach(function(v){
  if(!v||v.enabled!==true||v.mailEnabled===false)return;
  var a=safeDay(v.startDate),b=safeDay(v.endDate),p=safeDay(v.lastPickupDate),r=safeDay(v.reopenDate),hour=q(v.lastPickupTime);
  var lead=v.leadDays==null?14:Number(v.leadDays);
  if(!a||!b||!p||!r||a>b||p>=a||r<=b||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hour)||!Number.isInteger(lead)||lead<0||lead>90)return;
  var from=new Date(a+'T12:00:00Z');from.setUTCDate(from.getUTCDate()-lead);
  if(today<from.toISOString().slice(0,10)||today>=r)return;
  var dedup=[a,b,p,hour,r].join('|');if(seen[dedup])return;seen[dedup]=1;
  out.push({start:a,end:b,last:p,time:hour,reopen:r})
 });
 out.sort(function(a,b){return a.start.localeCompare(b.start)});
 if(!out.length)return'';
 var body=out.slice(0,3).map(function(c){
  return [
   closureMailLabel('title',lang),
   closureMailLabel('last',lang)+': '+mailDate(c.last)+', '+c.time,
   closureMailLabel('closed',lang)+': '+mailDate(c.start)+' – '+mailDate(c.end),
   closureMailLabel('resume',lang)+': '+mailDate(c.reopen)
  ].join('\n')
 }).join('\n\n');
 return marker+'\n'+body+'\n'+'===================='
}
function withRegistrationClosureNotice(url){
 var qmark=url.indexOf('?'),base=qmark>=0?url.slice(0,qmark):url;
 var parts=qmark>=0?url.slice(qmark+1).split('&'):[];
 var index=parts.findIndex(function(row){
  try{return decodeURIComponent(row.split('=')[0]||'').toLowerCase()==='body'}catch(_){return false}
 });
 var source=index>=0?parts[index].slice(parts[index].indexOf('=')+1):'',body='';
 try{body=decodeURIComponent(source.replace(/\+/g,' '))}catch(_){return url}
 // Refresh an earlier ExportHUB-generated notice when the language, dates, or
 // active state change. Never delete or rewrite the user's other email text.
 var noteRx=/(?:\r?\n){0,2}=== ExportHUB360 ===\r?\n[\s\S]*?\r?\n====================(?=\r?\n|$)/g;
 var clean=body.replace(noteRx,'');
 var notice=registrationClosureNotices();
 if(!notice&&clean===body)return url;
 var next=clean+(notice?(clean?'\n\n':'')+notice:'');
 if(index<0){if(!next)return url;parts.push('body='+encodeURIComponent(next))}
 else parts[index]='body='+encodeURIComponent(next);
 return base+'?'+parts.join('&')
}
function pickupClosureWarning(value,slotEnd){
 var day=safeDay(value),end=q(slotEnd);if(!day)return null;
 var matches=closureEntries().filter(function(c){
  if(!c||c.enabled!==true)return false;
  var a=safeDay(c.startDate),b=safeDay(c.endDate),last=safeDay(c.lastPickupDate),reopen=safeDay(c.reopenDate),hour=q(c.lastPickupTime),lead=c.leadDays==null?14:Number(c.leadDays);
  if(!(a&&b&&last&&reopen&&a<=b&&last<a&&reopen>b&&
   /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hour)&&Number.isInteger(lead)&&lead>=0&&lead<=90))return false;
  return (day>last&&day<reopen)||(day===last&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(end)&&end>hour)
 }).sort(function(a,b){return q(a.lastPickupDate).localeCompare(q(b.lastPickupDate))});
 if(!matches.length)return null;
 var c=matches[0];
 return{pickupDate:day,startDate:c.startDate,endDate:c.endDate,lastPickupDate:c.lastPickupDate,lastPickupTime:c.lastPickupTime,reopenDate:c.reopenDate}
}
async function persistClosureEntries(next){
 if(!globalAdmin())throw new Error(tr('closureMail.onlyAdmins'));
 var s=state();s.settings=s.settings&&typeof s.settings==='object'?s.settings:{};
 var previous=s.settings.closureNotices;
 s.settings.closureNotices=next;
 try{
  var clean=w.ExportHUBClean;
  if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error(tr('closureMail.storageUnavailable'));
  await clean.queueSave('Schließzeiten für E-Mails geändert');
  var ok=await clean.flushSave('Schließzeiten für E-Mails geändert',{force:true,userInitiated:true});
  if(ok!==true)throw new Error(tr('closureMail.storageUnconfirmed'));
  try{w.dispatchEvent(new CustomEvent('exporthub:closure-notices-updated',{detail:{count:next.length}}))}catch(_){}
  return true
 }catch(e){if(previous===undefined)delete s.settings.closureNotices;else s.settings.closureNotices=previous;throw e}
}
function installClosureSettings(host){
 if(!w.document||!globalAdmin()||!settingsVisible())return false;
 if(w.document.getElementById('rc1328ClosureSettings'))return true;
 host=host||w.document.getElementById('content')||w.document.querySelector('main')||w.document.body;
 if(!host)return false;
 var style=w.document.getElementById('rc1328ClosureStyle');
 if(!style){
  style=w.document.createElement('style');style.id='rc1328ClosureStyle';
  style.textContent='.rc1328-closure{margin-top:16px}.rc1328-fields{display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:12px}.rc1328-fields label{display:grid;gap:5px;font-weight:700}.rc1328-fields input{padding:9px;border:1px solid #94a3b8;border-radius:8px;min-height:40px}.rc1328-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0}.rc1328-entries{padding-left:22px}.rc1328-entries li{margin-bottom:9px}.rc1328-entries button{margin-left:8px}.rc1328-status[data-kind="error"]{color:#b91c1c}.rc1328-status[data-kind="ok"]{color:#166534}.rc1337-snow-setting{display:flex;align-items:center;gap:9px;margin-top:14px;font-weight:650}.rc1337-snow-setting input{width:18px;height:18px;accent-color:#2563eb}.rc1337-snow-toggle{margin-left:8px}.rc1337-delivery-channels{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px}.rc1337-delivery-channels label{display:flex;align-items:center;gap:8px;font-weight:650}.rc1337-delivery-channels input{width:18px;height:18px;accent-color:#2563eb}.rc1337-channel-toggle{margin-left:8px}@media(max-width:700px){.rc1328-fields{grid-template-columns:1fr}}';
  (w.document.head||w.document.documentElement).appendChild(style)
 }
 var box=w.document.createElement('section');box.id='rc1328ClosureSettings';box.className='card rc1328-closure';
 box.innerHTML='<h3>'+tr('closureMail.heading')+'</h3><p>'+tr('closureMail.help')+'</p><form data-rc1328-form><div class="rc1328-fields"><label>'+tr('closureMail.closedFrom')+'<input type="date" name="startDate" required></label><label>'+tr('closureMail.closedTo')+'<input type="date" name="endDate" required></label><label>'+tr('closureMail.lastPickupDate')+'<input type="date" name="lastPickupDate" required></label><label>'+tr('closureMail.lastPickupTime')+'<input type="time" name="lastPickupTime" required></label><label>'+tr('closureMail.reopenDate')+'<input type="date" name="reopenDate" required></label><label>'+tr('closureMail.leadDays')+'<input type="number" name="leadDays" min="0" max="90" step="1" value="14" required></label></div><div class="rc1337-delivery-channels"><label><input type="checkbox" name="mailEnabled" checked>' +tr('closureMail.mailVisible')+'</label><label><input type="checkbox" name="portalEnabled" checked>' +tr('closureMail.portalVisible')+'</label></div><label class="rc1337-snow-setting"><input type="checkbox" name="animateSnow">' +tr('closureMail.snowAnimation')+'</label><div class="rc1328-actions"><button class="btn" type="submit">'+tr('closureMail.add')+'</button><span class="rc1328-status" data-rc1328-status aria-live="polite"></span></div></form><h4>'+tr('closureMail.existing')+'</h4><ul class="rc1328-entries" data-rc1328-entries></ul>';
 host.appendChild(box);
 var form=box.querySelector('[data-rc1328-form]'),status=box.querySelector('[data-rc1328-status]'),list=box.querySelector('[data-rc1328-entries]');
 function show(message,kind){status.textContent=message||'';status.setAttribute('data-kind',kind||'info')}
 function display(){
  list.textContent='';
  var entries=closureEntries();
  if(!entries.length){var empty=w.document.createElement('li');empty.textContent=tr('closureMail.none');list.appendChild(empty);return}
  entries.forEach(function(item,index){
   var li=w.document.createElement('li'),text=w.document.createElement('span'),remove=w.document.createElement('button');
   text.textContent=[item.startDate+' – '+item.endDate,tr('closureMail.lastPickup')+': '+item.lastPickupDate+' '+item.lastPickupTime,tr('closureMail.reopens')+': '+item.reopenDate,tr('closureMail.advance')+': '+item.leadDays+ ' '+tr('closureMail.days'),item.enabled?tr('closureMail.on'):tr('closureMail.off'),item.animateSnow===true?tr('closureMail.snowOn'):tr('closureMail.snowOff')].join(' · ');
   remove.type='button';remove.className='btn flat small';remove.textContent=tr('closureMail.remove');remove.setAttribute('aria-label',tr('closureMail.removeAria')+' '+(index+1));
   remove.addEventListener('click',async function(){
    remove.disabled=true;show(tr('closureMail.saving'));
    try{var entries=closureEntries();entries.splice(index,1);await persistClosureEntries(entries);display();show(tr('closureMail.removed'),'ok')}
    catch(e){show(tr('closureMail.removeFailed')+': '+q(e&&e.message),'error');remove.disabled=false}
   });
   var snowToggle=w.document.createElement('button');
   snowToggle.type='button';snowToggle.className='btn flat small rc1337-snow-toggle';
   snowToggle.textContent=tr(item.animateSnow===true?'closureMail.snowDisable':'closureMail.snowEnable');
   snowToggle.setAttribute('aria-pressed',item.animateSnow===true?'true':'false');
   snowToggle.setAttribute('data-rc1337-snow-toggle','1');
   snowToggle.addEventListener('click',async function(){
    snowToggle.disabled=true;show(tr('closureMail.saving'));
    try{
     var rows=closureEntries();
     if(!rows[index])throw new Error(tr('closureMail.invalid'));
     rows[index].animateSnow=rows[index].animateSnow!==true;
     await persistClosureEntries(rows);display();show(tr('closureMail.saved'),'ok')
    }catch(e){show(tr('closureMail.saveFailed')+': '+q(e&&e.message),'error');snowToggle.disabled=false}
   });
   function channelToggle(prop,showKey,hideKey){
    var button=w.document.createElement('button'),enabled=item[prop]!==false;
    button.type='button';button.className='btn flat small rc1337-channel-toggle';
    button.textContent=tr(enabled?hideKey:showKey);
    button.setAttribute('aria-pressed',enabled?'true':'false');
    button.setAttribute('aria-label',button.textContent+' · '+item.startDate);
    button.addEventListener('click',async function(){
     button.disabled=true;show(tr('closureMail.saving'));
     try{
      var rows=closureEntries();
      if(!rows[index])throw new Error(tr('closureMail.invalid'));
      rows[index][prop]=rows[index][prop]===false;
      await persistClosureEntries(rows);display();show(tr('closureMail.saved'),'ok')
     }catch(e){show(tr('closureMail.saveFailed')+': '+q(e&&e.message),'error');button.disabled=false}
    });
    return button
   }
   li.appendChild(text);
   li.appendChild(channelToggle('mailEnabled','closureMail.mailShow','closureMail.mailHide'));
   li.appendChild(channelToggle('portalEnabled','closureMail.portalShow','closureMail.portalHide'));
   li.appendChild(snowToggle);li.appendChild(remove);list.appendChild(li)
  })
 }
 form.addEventListener('submit',async function(ev){
  ev.preventDefault();
  var field=function(k){return q(form.elements.namedItem(k)&&form.elements.namedItem(k).value)};
  var entry={enabled:true,startDate:safeDay(field('startDate')),endDate:safeDay(field('endDate')),lastPickupDate:safeDay(field('lastPickupDate')),lastPickupTime:field('lastPickupTime'),reopenDate:safeDay(field('reopenDate')),leadDays:Number(field('leadDays')),animateSnow:!!(form.elements.namedItem('animateSnow')&&form.elements.namedItem('animateSnow').checked),mailEnabled:!!(form.elements.namedItem('mailEnabled')&&form.elements.namedItem('mailEnabled').checked),portalEnabled:!!(form.elements.namedItem('portalEnabled')&&form.elements.namedItem('portalEnabled').checked)};
  if(!entry.startDate||!entry.endDate||!entry.lastPickupDate||!entry.reopenDate||
    entry.startDate>entry.endDate||entry.lastPickupDate>=entry.startDate||entry.reopenDate<=entry.endDate||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(entry.lastPickupTime)||!Number.isInteger(entry.leadDays)||entry.leadDays<0||entry.leadDays>90){
   show(tr('closureMail.invalid'),'error');return
  }
  var button=form.querySelector('[type="submit"]');button.disabled=true;show(tr('closureMail.saving'));
  try{
   var entries=closureEntries();entries.push(entry);await persistClosureEntries(entries);
   form.reset();display();show(tr('closureMail.saved'),'ok')
  }catch(e){show(tr('closureMail.saveFailed')+': '+q(e&&e.message),'error')}
  finally{button.disabled=false}
 });
 display();return true
}

function installSettings(){
 if(!w.document||!w.document.body)return false;
 var old=w.document.getElementById('rc1065RegistrationCcSettings');
 if(!globalAdmin()||!settingsVisible()){if(old&&old.parentNode)old.parentNode.removeChild(old);var oldClosure=w.document.getElementById('rc1328ClosureSettings');if(oldClosure)oldClosure.remove();return false}
 if(old){installClosureSettings();return true}
 var host=w.document.getElementById('content')||w.document.querySelector('main')||w.document.body;
 if(!host)return false;
 ensureCcStyle();
 var box=w.document.createElement('section');box.id='rc1065RegistrationCcSettings';box.className='card rc1065-cc-settings';
 box.innerHTML='<div><span class="pill blue">'+tr('registrationCc.badge')+'</span><h3>'+tr('registrationCc.title')+'</h3><p>'+tr('registrationCc.help')+'</p></div><div class="rc1065-cc-grid"><label>Sevastian Marcu<input type="email" autocomplete="off" data-rc1065-cc="sevastian" placeholder="'+tr('registrationCc.emailPlaceholder')+'"></label><label>Daniel Ollmann<input type="email" autocomplete="off" data-rc1065-cc="daniel" placeholder="'+tr('registrationCc.emailPlaceholder')+'"></label></div><div class="rc1065-cc-actions"><button type="button" class="btn" data-rc1065-cc-save>'+tr('registrationCc.save')+'</button><span data-rc1065-cc-status></span></div>';
 host.appendChild(box);
 var sev=box.querySelector('[data-rc1065-cc="sevastian"]'),dan=box.querySelector('[data-rc1065-cc="daniel"]'),status=box.querySelector('[data-rc1065-cc-status]'),save=box.querySelector('[data-rc1065-cc-save]');
 if(sev)sev.value=configuredEmail(REQUIRED[0]);
 if(dan)dan.value=configuredEmail(REQUIRED[1]);
 ccSettingsStatus(status,(sev&&sev.value&&dan&&dan.value)?tr('registrationCc.ready'):tr('registrationCc.missing'),'info');
 if(save)save.addEventListener('click',async function(){
  var a=mail(sev&&sev.value),b=mail(dan&&dan.value);
  if(!a||!b){ccSettingsStatus(status,tr('registrationCc.invalid'),'error');return}
  save.disabled=true;ccSettingsStatus(status,tr('registrationCc.saving'),'info');
  try{
   await persistCcSettings([{name:REQUIRED[0],email:a},{name:REQUIRED[1],email:b}]);
   if(sev)sev.value=a;if(dan)dan.value=b;
   ccSettingsStatus(status,tr('registrationCc.saved'),'ok')
  }catch(e){ccSettingsStatus(status,tr('registrationCc.saveFailed',{error:q(e&&e.message||e)}),'error')}
  finally{save.disabled=false}
 });
 installClosureSettings(host);
 return true
}

function scheduleSettings(){try{if(typeof w.setTimeout==='function')w.setTimeout(installSettings,0);else installSettings()}catch(_){}}
if(w.addEventListener){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){w.addEventListener(name,scheduleSettings)});
 w.addEventListener('exporthub:language-changed',function(){var old=w.document&&w.document.getElementById('rc1065RegistrationCcSettings');if(old)old.remove();var closure=w.document&&w.document.getElementById('rc1328ClosureSettings');if(closure)closure.remove();scheduleSettings()});
 w.addEventListener('click',scheduleSettings,true)
}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',scheduleSettings,{once:true});else scheduleSettings()
}

w.ExportHUBRC1065RegistrationCC=Object.freeze({version:'RC1093',required:REQUIRED.slice(),resolve:resolve,isRegistration:isRegistration,prepare:prepare,installSettings:installSettings,persistCcSettings:persistCcSettings,closureNoticeText:registrationClosureNotices,pickupClosureWarning:pickupClosureWarning});
})(window);
