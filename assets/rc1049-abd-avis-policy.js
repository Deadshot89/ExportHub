(function(){
'use strict';
if(window.__EXPORTHUB_RC1049_ABD_AVIS_POLICY__)return;window.__EXPORTHUB_RC1049_ABD_AVIS_POLICY__=true;
function q(v){return String(v==null?'':v).trim()}
function normLang(v){var m=q(v).toLowerCase().replace('_','-').match(/^(de|en|pl|es|fr|it)(?:-|$)/);return m?m[1]:'de'}
function tr(key,vars,lang,fallback){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key,vars,normLang(lang));if(v&&v!==key)return v}}catch(_){}return fallback||key}
function state(){try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return window.ExportHUBClean&&window.ExportHUBClean.state||window.appState||{}}
function shipment(){try{if(typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){var x=window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(x&&typeof x==='object')return x}}catch(_){}var s=state();return s.currentShipment||s.shipment||s.selectedShipment||null}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.referenceNo||sh.id||sh.shipmentId)).toUpperCase()}
function idOf(sh){return q(sh&&(sh.id||sh.shipmentId||sh.uuid||sh.ref||sh.reference))}
function reqOf(sh){var s=state(),ref=refOf(sh),id=idOf(sh),list=Array.isArray(s.abdRequests)?s.abdRequests:[];for(var i=list.length-1;i>=0;i--){var r=list[i]||{},rr=q(r.ref||r.reference||r.shipmentRef).toUpperCase(),rid=q(r.linkedShipmentId||r.shipmentId);if((ref&&rr===ref)||(id&&rid===id))return r}return null}
function hasAbd(sh,req){var lists=[sh&&sh.abdFiles,req&&req.abdFiles,sh&&sh.abdDocuments];for(var i=0;i<lists.length;i++)if(Array.isArray(lists[i])&&lists[i].length)return true;var st=q((req&&req.abdStatus)||(sh&&sh.abdStatus)||(req&&req.status));return /vorhanden|fertig|erledigt|completed|done|available|erstellt/i.test(st)&&!/wartet|offen|pending|angefordert/i.test(st)}
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(Date.UTC(y,mo-1,day))}
function ymd(d){return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function addDays(s,n){var p=s.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2]+n));return ymd(d)}
function holidays(y){var e=easter(y),out={};function add(s){out[s]=1}['01-01','05-01','10-03','11-01','12-25','12-26'].forEach(function(md){add(y+'-'+md)});[-2,1,39,50,60].forEach(function(n){var d=new Date(e.getTime()+n*86400000);add(ymd(d))});return out}
function business(s){var p=s.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2])),wd=d.getUTCDay();return wd!==0&&wd!==6&&!holidays(p[0])[s]}
function nextBusiness(s,count){var x=s,n=0;while(n<count){x=addDays(x,1);if(business(x))n++}return x}
function berlinParts(raw){var d=new Date(raw);if(!isFinite(d))return null;var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d),o={};parts.forEach(function(p){o[p.type]=p.value});return{date:o.year+'-'+o.month+'-'+o.day,minutes:Number(o.hour)*60+Number(o.minute)}}
function policy(sh){sh=sh||shipment()||{};var req=reqOf(sh),required=sh.abdRequired===true||!!req||/wartet auf abd/i.test(q(sh.status||sh.shipmentStatus)),present=hasAbd(sh,req);if(!required)return{required:false,present:true,pending:false};if(present)return{required:true,present:true,pending:false};var raw=q((req&&(req.createdAt||req.created||req.requestedAt))||sh.abdRequestedAt||sh.abdRequestCreatedAt||sh.createdAt),bp=berlinParts(raw)||berlinParts(new Date().toISOString()),days=bp.minutes<=810?1:2,minDate=nextBusiness(bp.date,days);return{required:true,present:false,pending:true,requestedAt:raw,requestedBeforeCutoff:bp.minutes<=810,expectedAvailableDate:minDate,expectedAvailableTime:'10:00',minPickupDate:minDate,minPickupTime:'10:00'}}
function fmtDate(s){if(!s)return'';var p=s.split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:s}
function notice(sh,lang){var p=policy(sh);if(!p.pending)return'';lang=normLang(lang);return tr('abd.mailPending',{expected:fmtDate(p.expectedAvailableDate),minimum:fmtDate(p.minPickupDate)},lang,'ABD not yet available. Expected '+fmtDate(p.expectedAvailableDate)+' around 10:00; pickup no earlier than '+fmtDate(p.minPickupDate)+' at 10:00.')}
function addNotice(body,sh,lang){lang=normLang(lang);var n=notice(sh,lang),source=String(body);if(!n||source.indexOf(n)>=0)return body;var close=tr('mail.closing',null,lang,'Kind regards'),needle='\n\n'+close;if(source.indexOf(needle)>=0)return source.replace(needle,'\n\n'+n+needle);return source+'\n\n'+n}
var baseFetch=window.fetch&&window.fetch.bind(window);if(baseFetch){window.fetch=function(input,opt){try{var u=typeof input==='string'?input:(input&&input.url)||'';if(/\/api\/customer-avis(?:\?|$)/.test(u)&&opt&&typeof opt.body==='string'){var b=JSON.parse(opt.body);if(b&&b.action==='issue'&&b.shipmentSnapshot){var sh=shipment()||b.shipmentSnapshot,r=reqOf(sh);b.shipmentSnapshot.abdRequired=sh.abdRequired===true||!!r||/wartet auf abd/i.test(q(sh.status||sh.shipmentStatus));b.shipmentSnapshot.abdStatus=q((r&&(r.abdStatus||r.status))||sh.abdStatus);b.shipmentSnapshot.abdRequestedAt=q((r&&(r.createdAt||r.created||r.requestedAt))||sh.abdRequestedAt||sh.abdRequestCreatedAt||'');opt=Object.assign({},opt,{body:JSON.stringify(b)})}}}
catch(_){}return baseFetch(input,opt).then(function(res){try{var u=typeof input==='string'?input:(input&&input.url)||'';if(/\/api\/customer-avis(?:\?|$)/.test(u)&&res&&typeof res.clone==='function'){res.clone().json().then(function(d){if(d&&d.abd){window.__EXPORTHUB_RC1049_PUBLIC_ABD__=d.abd;setTimeout(applyPublic,0)}}).catch(function(){})}}catch(_){}return res})}}
function installMail(){var cur=window.ExportHUBCustomerAvis706||window.ExportHUBCustomerAvis705;if(!cur||cur.__rc1049)return false;var wrapped=Object.freeze(Object.assign({},cur,{version:'RC1049',injectMailBody:function(sh,target,body,lang){var out=cur.injectMailBody?cur.injectMailBody(sh,target,body,lang):body;return addNotice(out,sh,normLang(lang))},__rc1049:true,__base1049:cur}));window.ExportHUBCustomerAvis706=wrapped;window.ExportHUBCustomerAvis705=wrapped;return true}
function syncMail(){installMail();var sh=shipment(),p=policy(sh);if(!p.pending||!document)return;var area=document.getElementById('rc543MailArea'),ta=area&&area.querySelector('textarea');if(!ta)return;var lang=normLang((document.getElementById('rc543MailLang')||{}).value),next=addNotice(ta.value,sh,lang);if(next!==ta.value){ta.value=next;try{ta.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}}}
function applyPublic(){if(!document)return;var p=window.__EXPORTHUB_RC1049_PUBLIC_ABD__;if(!p||!p.pending)return;var content=document.getElementById('content');if(content&&!document.getElementById('rc1049AbdNotice')){var box=document.createElement('div');box.id='rc1049AbdNotice';box.className='status';box.style.cssText='border-left-color:#9a620e;background:#fff5e2;color:#754b09;margin:0 0 14px';box.textContent=tr('abd.publicPending',{expected:fmtDate(p.expectedAvailableDate),minimum:fmtDate(p.minPickupDate)},null,'ABD not yet available. Expected availability: '+fmtDate(p.expectedAvailableDate)+' around 10:00. Pickup no earlier than '+fmtDate(p.minPickupDate)+' at 10:00.');content.insertBefore(box,content.firstChild)}var date=document.querySelector('input[name="pickupDate"]'),from=document.querySelector('input[name="timeFrom"]');if(date){date.min=p.minPickupDate||'';var adjust=function(){if(from)from.min=(date.value===p.minPickupDate?(p.minPickupTime||'10:00'):'')};date.addEventListener('change',adjust);adjust()}}
function boot(){installMail();syncMail();applyPublic()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
['exporthub:rendered','exporthub:viewchange','exporthub:rc1027-avis-ready','exporthub:customer-avis-updated'].forEach(function(n){window.addEventListener(n,function(){setTimeout(function(){syncMail();applyPublic()},0)})});

/* RC1278: Outlook öffnen bestätigt den Versand direkt; separate Bestätigung entfällt. */
(function(){
if(window.__EXPORTHUB_RC1278_MAIL_OPEN_AUTOCONFIRM__)return;window.__EXPORTHUB_RC1278_MAIL_OPEN_AUTOCONFIRM__=true;
function actorName(){try{return q((window.currentUser||{}).name||(window.currentUser||{}).user)||'Benutzer'}catch(_){return'Benutzer'}}
function abdCurrent(){var s=state();return s.abdRequest||s.abdDraft||reqOf(shipment())||null}
function queueSave(reason){try{if(window.ExportHUBClean&&typeof window.ExportHUBClean.queueSave==='function')window.ExportHUBClean.queueSave(reason||'Mailversand automatisch bestätigt')}catch(_){}}
function historyCount(sh){return sh&&Array.isArray(sh.mailHistory)?sh.mailHistory.length:0}
function actionButton(e){var t=e&&e.target;return t&&t.closest?t.closest('button,a'):null}
function textOf(b){return q((b&&b.textContent)||'')+' '+q(b&&b.getAttribute&&b.getAttribute('onclick'))+' '+q(b&&b.id)}
function isMainMailOpen(b){return !!(b&&b.closest&&b.closest('#rc543MailArea')&&(/rc543OpenMail|rc542OpenMail|rc524OpenMail/i.test(textOf(b))||/Mail in Outlook öffnen/i.test(q(b.textContent))))}
function isRc543AbdOpen(b){return !!(b&&(/rc543OpenAbdMail/i.test(textOf(b))||/ABD-Mail in Outlook öffnen/i.test(q(b.textContent))))}
function isRc626AbdOpen(b){return !!(b&&(/ExportHUBRC626\.openAbdMail/i.test(textOf(b))||/ABD-Anfrage in Outlook öffnen/i.test(q(b.textContent))))}
function hideManualConfirmButtons(){
 if(!document||!document.querySelectorAll)return;
 document.querySelectorAll('#rc543ConfirmMailButton,button[onclick*="rc543ConfirmMail"],button[onclick*="rc542ConfirmMail"],button[onclick*="rc543ConfirmAbdMail"]').forEach(function(b){b.hidden=true;b.disabled=true;b.setAttribute('aria-hidden','true');b.style.setProperty('display','none','important')});
 Array.prototype.forEach.call(document.querySelectorAll('button'),function(b){var t=q(b.textContent);if(/^(Mail als versendet bestätigen|ABD-Anfrage als versendet bestätigen)$/i.test(t)){b.hidden=true;b.disabled=true;b.setAttribute('aria-hidden','true');b.style.setProperty('display','none','important')}});
}
function confirmRc626Abd(){
 if(typeof window.rc542AbdMarkSent==='function'){try{return window.rc542AbdMarkSent()}catch(_){}}
 var a=abdCurrent();if(!a)return false;var stamp=new Date().toISOString();a.status='Angefragt';a.sentAt=stamp;a.sentBy=actorName();a.mailSent=true;a.mailConfirmed=true;a.mailConfirmedAt=stamp;a.mailStatus='Versendet';queueSave('ABD-Anfrage in Outlook geöffnet und als versendet bestätigt');return false
}
function intercept(e){
 var b=actionButton(e);if(!b)return;
 if(isMainMailOpen(b)){
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  var sh=shipment(),before=historyCount(sh),openFn=window.rc543OpenMail||window.rc542OpenMail||window.rc524OpenMail,confirmFn=window.rc543ConfirmMail||window.rc542ConfirmMail;
  if(typeof openFn==='function')openFn();
  if(typeof confirmFn==='function'&&historyCount(sh)<=before)confirmFn();
  hideManualConfirmButtons();setTimeout(hideManualConfirmButtons,0);return
 }
 if(isRc543AbdOpen(b)){
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  var a=abdCurrent(),wasSent=!!(a&&(a.sentAt||a.mailConfirmedAt)),openAbd=window.rc543OpenAbdMail;
  if(typeof openAbd==='function')openAbd();
  a=abdCurrent();
  if(!wasSent&&a&&!a.sentAt&&typeof window.rc543ConfirmAbdMail==='function')window.rc543ConfirmAbdMail();
  hideManualConfirmButtons();setTimeout(hideManualConfirmButtons,0);return
 }
 if(isRc626AbdOpen(b)){
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  var fn=window.ExportHUBRC626&&window.ExportHUBRC626.openAbdMail;
  if(typeof fn==='function')fn();
  confirmRc626Abd();hideManualConfirmButtons();setTimeout(hideManualConfirmButtons,0);return
 }
}
window.addEventListener('click',intercept,true);
var confirmHideTimer=0,confirmObserver=null;
function watchConfirmButtons(){if(confirmObserver||!window.MutationObserver||!document.body)return;confirmObserver=new MutationObserver(function(){clearTimeout(confirmHideTimer);confirmHideTimer=setTimeout(hideManualConfirmButtons,0)});confirmObserver.observe(document.body,{childList:true,subtree:true})}
function autoBoot(){hideManualConfirmButtons();watchConfirmButtons()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoBoot,{once:true});else autoBoot();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(n){window.addEventListener(n,function(){setTimeout(hideManualConfirmButtons,0)})});
window.ExportHUBRC1278MailAutoConfirm=Object.freeze({version:'RC1278',hideManualConfirmButtons:hideManualConfirmButtons});
})();

window.ExportHUBRC1049ABDPolicy=Object.freeze({version:'RC1049',policy:policy,notice:notice});
})();
/* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD START */
(function(){
'use strict';
if(window.__EXPORTHUB_RC1550_ABD_UPLOAD_BRIDGE__)return;
window.__EXPORTHUB_RC1550_ABD_UPLOAD_BRIDGE__=true;
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function state(){try{if(typeof window.__EXPORTHUB_GET_STATE__==='function')return window.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return window.ExportHUBClean&&window.ExportHUBClean.runtime&&window.ExportHUBClean.runtime.state||window.ExportHUBClean&&window.ExportHUBClean.state||window.state||window.appState||{}}
function refOf(x){return q(x&&(x.ref||x.reference||x.shipmentRef||x.referenceNumber||x.referenceNo)).toUpperCase()}
function idOf(x){return q(x&&(x.id||x.shipmentId||x.uuid))}
function sameShipment(sh,a){if(!sh||!a)return false;var linked=q(a.linkedShipmentId||a.shipmentId),sid=idOf(sh),ar=refOf(a),sr=refOf(sh);return !!((linked&&sid&&linked===sid)||(ar&&sr&&ar===sr))}
function requestById(id){var s=state(),list=Array.isArray(s.abdRequests)?s.abdRequests.slice():[],wanted=q(id);[s.abdRequest,s.abdDraft].forEach(function(a){if(a&&list.indexOf(a)<0)list.push(a)});for(var i=list.length-1;i>=0;i--){if(q(list[i]&&list[i].id)===wanted)return list[i]}return null}
function shipmentForRequest(a){var s=state(),candidates=[];function add(x){if(x&&typeof x==='object'&&candidates.indexOf(x)<0)candidates.push(x)};[s.shipments,s.savedShipments,s.sharedShipments].forEach(function(list){if(Array.isArray(list))list.forEach(add)});[s.shipment,s.currentShipment,s.selectedShipment,s.activeShipment,s.documentShipment].forEach(add);var linked=q(a&& (a.linkedShipmentId||a.shipmentId));if(linked){for(var j=candidates.length-1;j>=0;j--){if(idOf(candidates[j])===linked)return candidates[j]}}var matches=candidates.filter(function(sh){return sameShipment(sh,a)}),ids={};matches.forEach(function(sh){ids[idOf(sh)||refOf(sh)]=true});return Object.keys(ids).length===1?matches[0]||null:null}
function uploadMsg(key,vars,fallback){try{var i=window.ExportHUBI18n;if(i&&typeof i.t==='function'){var t=i.t(key,vars);if(t&&t!==key)return t}}catch(_){}return fallback}
function uploadStatus(input,message,failed){try{if(input&&input.setAttribute)input.setAttribute('aria-invalid',failed?'true':'false');var host=input&&input.closest&&input.closest('.rc543-abd-upload,.rc524-upload,.rc626-upload')||input&&input.parentNode;if(host&&typeof document.createElement==='function'){var el=host.querySelector&&host.querySelector('[data-rc1584-abd-status]');if(!el){el=document.createElement('small');el.setAttribute('data-rc1584-abd-status','');host.appendChild(el)}el.textContent=message;el.setAttribute('role',failed?'alert':'status');el.style.display='block';el.style.marginTop='6px';el.style.fontWeight='600';el.style.color=failed?'#b91c1c':'#166534'}}catch(_){}}
function uploadError(input,message){uploadStatus(input,message,true);try{if(typeof window.alert==='function')window.alert(message);else if(typeof alert==='function')alert(message)}catch(_){}return false}
function requestMustLink(a){return !!q(a&&(a.linkedShipmentId||a.shipmentId))||/^(?:shipment|sendung|from.shipment)$/i.test(q(a&&(a.source||a.createdFrom||a.mode)))}

function install(){var api=window.ExportHUBRC626;if(api&&api.__rc1550AbdUploadBridge)return true;if(!api||typeof api.uploadCompletedAbd!=='function')return false;var base=api.uploadCompletedAbd;function uploadCompletedAbd(id,input){var a=requestById(id),file=input&&input.files&&input.files[0];if(!a||!file)return base.apply(api,arguments);if(!/\.pdf$/i.test(q(file.name))&&low(file.type).indexOf('pdf')<0)return base.apply(api,arguments);var sh=shipmentForRequest(a),upload=window.rc524UploadFile;if(sh){var live=Array.isArray(state().shipments)?state().shipments:[];sh=live.find(function(x){return sameShipment(x,a)&&((idOf(sh)&&idOf(x)===idOf(sh))||(refOf(sh)&&refOf(x)===refOf(sh)))})||null}if(!sh){if(requestMustLink(a))return uploadError(input,uploadMsg('abd.completedUpload.shipmentMissing',null,'Linked shipment could not be identified. Open the shipment overview and retry.'));return base.apply(api,arguments)}if(typeof upload!=='function')return uploadError(input,uploadMsg('abd.completedUpload.runtimeMissing',null,'Secure ABD upload is not available. Reload and retry; the document was not saved.'));if(typeof window.canWrite==='function'&&!window.canWrite('abd'))return uploadError(input,uploadMsg('abd.completedUpload.forbidden',null,'No permission to upload ABD documents.'));if(!input.dataset)input.dataset={};input.dataset.id=idOf(sh)||refOf(sh);try{return upload(input,'abdFiles')}catch(error){return uploadError(input,uploadMsg('abd.completedUpload.failed',{message:q(error&&error.message||error)},'ABD upload failed: '+q(error&&error.message||error)))}}
var wrapped=Object.freeze(Object.assign({},api,{uploadCompletedAbd:uploadCompletedAbd,__rc1550AbdUploadBridge:true,__base1550:api}));window.ExportHUBRC626=wrapped;return true}
function refreshAbdAfterVerifiedUpload(e){var d=e&&e.detail||{};if(low(d.kind)!=='abd'||d.azureVerified!==true)return;var s=state();if(q(s.view)!=='abd')return;setTimeout(function(){var api=window.ExportHUBRC626;if(api&&typeof api.renderAbd==='function')api.renderAbd()},0)}
/* RC1582: RC626 is loaded lazily on the first ABD view. Its file input may appear long after the initial retry timers. Install the verified-upload bridge during capture, before the input's inline onchange handler runs. */
function installOnFileChange(event){var input=event&&event.target;if(!input||typeof input.matches!=='function'||!input.matches('input[type="file"]'))return;var handler=q(input.getAttribute&&input.getAttribute('onchange'));if(handler.indexOf('ExportHUBRC626.uploadCompletedAbd')<0)return;if(install())return;try{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}catch(_){}uploadError(input,uploadMsg('abd.completedUpload.runtimeMissing',null,'Secure ABD upload is not available. Reload and retry; the document was not saved.'))}
/* RC1584: Catch missing shipment IDs and unavailable upload functions before the inline handler can silently fall back to an empty shipment draft. Never mutate shipment data here. */
var centralPending=[];
function blockAbdChange(event,input,message){try{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}catch(_){}return uploadError(input,message)}
function captureCentralAbdChange(event){
 var input=event&&event.target;
 if(!input||typeof input.matches!=='function'||!input.matches('input[type="file"]'))return;
 var handler=q(input.getAttribute&&input.getAttribute('onchange'));
 if(!/rc524UploadFile\s*\(\s*this\s*,\s*['"]abdFiles['"]/.test(handler))return;
 var file=input.files&&input.files[0];
 if(!file)return;
 var requested=q(input.dataset&&input.dataset.id),s=state(),list=Array.isArray(s.shipments)?s.shipments:[],
     hits=list.filter(function(sh){return !!requested&&(idOf(sh)===requested||refOf(sh)===requested.toUpperCase())}),first=hits[0];
 if(!first||!refOf(first)||hits.some(function(sh){return idOf(sh)!==idOf(first)})){
  return blockAbdChange(event,input,uploadMsg('abd.completedUpload.noMatchingShipment',{reference:requested||'?'},'ABD upload not started: shipment '+(requested||'?')+' could not be uniquely identified. Reload shipment overview.'));
 }
 if(typeof window.rc524UploadFile!=='function')return blockAbdChange(event,input,uploadMsg('abd.completedUpload.runtimeMissing',null,'Secure ABD upload is not available. Reload and retry; the document was not saved.'));
 if(typeof window.canWrite==='function'&&!window.canWrite('abd'))return blockAbdChange(event,input,uploadMsg('abd.completedUpload.forbidden',null,'No permission to upload ABD documents.'));
 centralPending.forEach(function(p){if(p.input===input)p.done=true});
 var entry={input:input,id:idOf(first),ref:refOf(first),done:false};
 centralPending.push(entry);
 uploadStatus(input,uploadMsg('abd.completedUpload.processing',null,'ABD document is being processed. Waiting for storage confirmation.'),false);
 setTimeout(function(){
  if(entry.done)return;
  entry.done=true;
  uploadStatus(input,uploadMsg('abd.completedUpload.unconfirmed',null,'No confirmed ABD storage response. Check the shipment documents before retrying.'),true);
  centralPending=centralPending.filter(function(p){return !p.done});
 },90000);
}
function centralAbdUploaded(e){
 var d=e&&e.detail||{};
 if(low(d.kind)!=='abd'||d.azureVerified!==true)return;
 centralPending.forEach(function(p){
  if(p.done)return;
  if(q(d.shipmentId)!==p.id&&refOf({ref:d.reference})!==p.ref)return;
  p.done=true;
  uploadStatus(p.input,uploadMsg('abd.completedUpload.success',{reference:p.ref},'ABD document saved for shipment '+p.ref+'.'),false);
 });
 centralPending=centralPending.filter(function(p){return !p.done});
}
if(document&&typeof document.addEventListener==='function')document.addEventListener('change',captureCentralAbdChange,true);
if(typeof window.addEventListener==='function')window.addEventListener('exporthub:shipment-document-uploaded',centralAbdUploaded);
if(document&&typeof document.addEventListener==='function')document.addEventListener('change',installOnFileChange,true);
function boot(){install();setTimeout(install,0);setTimeout(install,250);setTimeout(install,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(n){window.addEventListener(n,function(){setTimeout(install,0)})});
window.addEventListener('exporthub:shipment-document-uploaded',refreshAbdAfterVerifiedUpload);
window.ExportHUBRC1550AbdUploadBridge=Object.freeze({version:'RC1550',install:install});
})();
/* RC1550: FERTIGES ABD UEBER ZENTRALEN UPLOAD END */
