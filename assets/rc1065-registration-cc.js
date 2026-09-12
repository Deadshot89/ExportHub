(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1065_REGISTRATION_CC__)return;
w.__EXPORTHUB_RC1065_REGISTRATION_CC__=true;

var REQUIRED=Object.freeze(['Sevastian Marcu','Daniel Ollmann']);

function q(v){return String(v==null?'':v).trim()}
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
 var s=state(),lists=[s.users,s.userAccounts,s.accounts,s.members,s.employees,s.staff,s.people,s.directoryUsers],out=[];
 lists.forEach(function(list){if(Array.isArray(list))list.forEach(function(x){if(x&&typeof x==='object')out.push(x)})});
 return out
}
function nameOf(x){return q(x&&(x.name||x.displayName||x.fullName||([x.firstName,x.lastName].filter(Boolean).join(' '))||x.userName||x.username))}
function emailOf(x){return mail(x&&(x.email||x.mail||x.emailAddress||x.userPrincipalName||x.upn||x.login))}
function resolve(){
 var cfg=configured(),rows=candidates(),addresses=[],missing=[];
 REQUIRED.forEach(function(required){
  var key=norm(required),found=cfg.find(function(x){return norm(x.name)===key})||rows.find(function(x){return norm(nameOf(x))===key}),e=found&&emailOf(found)||'';
  if(e)addresses.push(e);else missing.push(required)
 });
 return{ok:missing.length===0,addresses:Array.from(new Set(addresses.map(function(x){return x.toLowerCase()}))),missing:missing}
}
function isRegistration(url){
 var raw=q(url);if(!/^mailto:/i.test(raw))return false;
 var decoded=raw;try{decoded=decodeURIComponent(raw.replace(/\+/g,' '))}catch(_){}
 return /anmeld|abhol|lieferavis|collection\s+notice|pickup|sendung|shipment/i.test(decoded)
}
function prepare(url){
 var raw=q(url);if(!isRegistration(raw))return{ok:true,url:raw,required:false,missing:[]};
 var r=resolve();if(!r.ok)return{ok:false,url:raw,required:true,missing:r.missing};
 var parts=raw.split('?'),params=new URLSearchParams(parts.slice(1).join('?')),existing=q(params.get('cc')).split(/[;,]/).map(mail).filter(Boolean);
 r.addresses.forEach(function(x){if(!existing.some(function(y){return y.toLowerCase()===x.toLowerCase()}))existing.push(x)});
 params.set('cc',existing.join(';'));
 return{ok:true,url:parts[0]+'?'+params.toString(),required:true,missing:[]}
}
function block(p){
 var names=(p&&p.missing||[]).join(', '),msg='Anmeldung nicht geöffnet: Pflicht-CC konnte nicht aus den ExportHUB-Benutzerdaten aufgelöst werden'+(names?': '+names:'')+'. Bitte die E-Mail-Adresse im Benutzerstamm pflegen.';
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
w.ExportHUBRC1065RegistrationCC=Object.freeze({version:'RC1065',required:REQUIRED.slice(),resolve:resolve,isRegistration:isRegistration,prepare:prepare});
})(window);
