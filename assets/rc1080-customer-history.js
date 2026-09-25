// ExportHUB RC1080 – Kundenhistorie mit Benutzerzuordnung für Anlage und Änderungen.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1080_CUSTOMER_HISTORY__)return;
w.__EXPORTHUB_RC1080_CUSTOMER_HISTORY__=true;

var BASELINES=Object.create(null),MAX_EVENTS=500,WRAPPED=false;

function q(v){return String(v==null?'':v).trim()}
function tr(key,vars,language){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars,language)}catch(_){}return key}
function de(key,vars){return tr(key,vars,'de')}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function user(){var s=state();try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}return s.currentUser||s.activeUser||w.currentUser||{}}
function actor(){var u=user();return{name:q(u.name||u.displayName||u.fullName||u.user||u.username||u.login)||de('customerHistory.unknown'),id:q(u.id||u.userId||u.user||u.username||u.login),role:q(u.role||u.rolle)}}
function id(c){return q(c&&(c.id||c.customerId||c.account||c.customerNumber||c.kundennummer||c.name||c.customerName)).toLocaleUpperCase('de-DE')}
function name(c){return q(c&&(c.name||c.customerName||c.companyName||c.account||c.customerNumber))||tr('history.entity.customer')}
function clean(value,key){
 if(key&&/customerHistory|history|updatedAt|updatedBy|createdAt|createdBy|_sync|lastSaved|lastModified/i.test(key))return undefined;
 if(Array.isArray(value))return value.map(function(x){return clean(x,'')});
 if(obj(value)){var out={};Object.keys(value).sort().forEach(function(k){var v=clean(value[k],k);if(v!==undefined)out[k]=v});return out}
 if(typeof value==='string')return value.trim();
 if(typeof value==='function')return undefined;
 return value
}
function fingerprint(c){try{return JSON.stringify(clean(c,''))}catch(_){return''}}
function topSnapshot(c){
 var out={};
 ['name','customerName','account','customerNumber','kundennummer','address','country','land','email','customerEmail','carrierEmail','salesMail','salesEmail','cc','portalName','portalUrl','processNotes'].forEach(function(k){out[k]=clean(c&&c[k],k)});
 out.locations=clean([].concat(arr(c&&c.locations),arr(c&&c.sites),arr(c&&c.standorte),arr(c&&c.deliveryLocations),arr(c&&c.shipToLocations)),'locations');
 out.mailTemplates=clean(c&&c.mailTemplates,'mailTemplates');
 return out
}
function changedFields(before,after){
 var a=topSnapshot(before||{}),b=topSnapshot(after||{}),labels={
  name:'Name',customerName:'Kundenname',account:'Kundennummer',customerNumber:'Kundennummer',kundennummer:'Kundennummer',
  address:'Adresse',country:'Land',land:'Land',email:'E-Mail',customerEmail:'Kunden-E-Mail',carrierEmail:'Spedition-E-Mail',
  salesMail:'Sales-E-Mail',salesEmail:'Sales-E-Mail',cc:'CC',portalName:'Portal',portalUrl:'Portal',processNotes:'Hinweise',
  locations:'Standorte',mailTemplates:'Mailvorlagen'
 },out=[];
 Object.keys(b).forEach(function(k){if(JSON.stringify(a[k])!==JSON.stringify(b[k])&&out.indexOf(labels[k]||k)<0)out.push(labels[k]||k)});
 return out
}
function eventId(type,customerId,who){return'CH-'+Date.now().toString(36)+'-'+low(type).replace(/[^a-z0-9]+/g,'-')+'-'+low(customerId).replace(/[^a-z0-9]+/g,'-').slice(0,18)+'-'+low(who).replace(/[^a-z0-9]+/g,'-').slice(0,18)+'-'+Math.random().toString(36).slice(2,6)}
function append(c,type,label,details){
 if(!c)return null;var a=actor(),e={id:eventId(type,id(c),a.id||a.name),at:new Date().toISOString(),type:type,label:label,actor:a,details:details||{},source:'exporthub',version:'RC1080'};
 var list=arr(c.customerHistory).slice();
 var duplicate=list.some(function(x){return x&&x.type===type&&x.label===label&&x.actor&&q(x.actor.id||x.actor.name)===q(a.id||a.name)&&Math.abs(Date.parse(x.at||0)-Date.parse(e.at))<1500});
 if(duplicate)return null;list.push(e);c.customerHistory=list.slice(-MAX_EVENTS);return e
}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function customerView(){var v=view();return v==='customers'||v==='customerfolder'||v==='customer'||v==='kunden'||v==='kundenordner'}
function customers(){return arr(state().customers)}
function currentCustomer(){
 var s=state(),direct=s.currentCustomer||s.selectedCustomer||null,key=q(s.currentCustomerId||s.selectedCustomerId||s.customerFolderId||s.customerFolderOpenId||(direct&&id(direct)));
 if(!key)return direct&&obj(direct)?direct:null;
 return customers().find(function(c){return c&&(id(c)===q(key).toLocaleUpperCase('de-DE')||q(c.id||c.customerId)===q(key)||q(c.account||c.customerNumber)===q(key))})||(direct&&obj(direct)?direct:null)
}
function baselineAll(){
 customers().forEach(function(c){var k=id(c);if(k)BASELINES[k]={fingerprint:fingerprint(c),snapshot:JSON.parse(JSON.stringify(c))}});
}
function shouldAudit(reason,opt){
 if(customerView())return true;
 var t=low(reason);return /kunde|customer|standort|stammdaten|kundenordner/.test(t)||!!(opt&&opt.customerAudit===true)
}
function prepare(reason,opt){
 if(!shouldAudit(reason,opt))return 0;
 var list=customers(),seen=Object.create(null),count=0;
 list.forEach(function(c){
  var k=id(c);if(!k)return;seen[k]=true;var fp=fingerprint(c),base=BASELINES[k];
  if(!base){
    if(append(c,'customer-created',de('history.customer.customer-created'),{customer:name(c),account:q(c.account||c.customerNumber||c.kundennummer)}))count++
  }else if(base.fingerprint!==fp){
    var fields=changedFields(base.snapshot,c);
    if(append(c,'customer-updated',de('history.customer.customer-updated'),{customer:name(c),fields:fields.join(', ')}))count++
  }
 });
 list.forEach(function(c){var k=id(c);if(k)BASELINES[k]={fingerprint:fingerprint(c),snapshot:JSON.parse(JSON.stringify(c))}});
 return count
}
function wrapSave(){
 var clean=w.ExportHUBClean;if(!clean||typeof clean.flushSave!=='function')return false;
 if(clean.flushSave.__rc1080CustomerHistory){WRAPPED=true;return true}
 var original=clean.flushSave;
 var wrapped=async function(){return await original.apply(this,arguments)};
 wrapped.__rc1080CustomerHistory=true;wrapped.__original=original;clean.flushSave=wrapped;WRAPPED=true;return true
}
function formatDate(v){var x=new Date(v);if(!Number.isFinite(x.getTime()))return q(v)||'—';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.formatDate==='function')return w.ExportHUBI18n.formatDate(x,{dateStyle:'short',timeStyle:'medium'})}catch(_){}return x.toLocaleString()}
function displayLabel(e){var type=q(e&&e.type);if(type==='customer-created')return tr('history.customer.customer-created');if(type==='customer-updated')return tr('history.customer.customer-updated');return q(e&&e.label)||tr('customerHistory.change')}

function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function detail(e){var d=e&&e.details||{},p=[];if(d.account)p.push(tr('customerHistory.number')+': '+d.account);if(d.fields)p.push(tr('customerHistory.changed')+': '+d.fields);return p.join(' · ')}
function ensureStyle(){
 if(d.getElementById('rc1080CustomerHistoryStyle'))return;
 var s=d.createElement('style');s.id='rc1080CustomerHistoryStyle';
 s.textContent='.rc1080-customer-history{margin-top:16px}.rc1080-customer-history-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.rc1080-customer-history-list{display:grid;gap:8px;margin-top:12px;max-height:420px;overflow:auto}.rc1080-customer-history-row{padding:10px 12px;border:1px solid #dbe4ec;border-radius:10px;background:#fff}.rc1080-customer-history-row strong{display:block}.rc1080-customer-history-meta,.rc1080-customer-history-detail{font-size:12px;color:#64748b;margin-top:2px}';
 (d.head||d.documentElement).appendChild(s)
}
function render(){
 var old=d.getElementById('rc1080CustomerHistory'),c=currentCustomer();
 if(!customerView()||!c){if(old)old.remove();return false}
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 if(!old){old=d.createElement('section');old.id='rc1080CustomerHistory';old.className='card rc1080-customer-history';host.appendChild(old)}
 var events=arr(c.customerHistory).slice().sort(function(a,b){return Date.parse(b&&b.at||0)-Date.parse(a&&a.at||0)});
 var rows=events.length?events.map(function(e){var det=detail(e);return'<div class="rc1080-customer-history-row"><strong>'+esc(displayLabel(e))+'</strong><div class="rc1080-customer-history-meta">'+esc(formatDate(e.at))+' · '+esc(e.actor&&e.actor.name||tr('customerHistory.unknown'))+(e.actor&&e.actor.role?' · '+esc(e.actor.role):'')+'</div>'+(det?'<div class="rc1080-customer-history-detail">'+esc(det)+'</div>':'')+'</div>'}).join(''):'<div class="muted">'+esc(tr('customerHistory.empty'))+'</div>';
 old.innerHTML='<div class="rc1080-customer-history-head"><div><span class="pill blue">'+esc(tr('customerHistory.badge'))+'</span><h3>'+esc(tr('customerHistory.title'))+'</h3><div class="muted">'+esc(name(c))+'</div></div><span class="pill gray">'+esc(tr('customerHistory.events',{count:events.length}))+'</span></div><div class="rc1080-customer-history-list">'+rows+'</div>';
 ensureStyle();return true
}

function schedule(){
 w.setTimeout(function(){try{wrapSave();render();if(!WRAPPED)baselineAll()}catch(e){try{console.warn('RC1080 Kundenhistorie',e)}catch(_){}}},0)
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){baselineAll();schedule()},{once:true});else{baselineAll();schedule()}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,function(){schedule()})}catch(_){}});
try{w.addEventListener('exporthub:user-profile-updated',schedule)}catch(_){}
w.ExportHUBRC1080CustomerHistory=Object.freeze({version:'RC1080',prepare:prepare,render:render,baselineAll:baselineAll,currentCustomer:currentCustomer});
})(window,document);
