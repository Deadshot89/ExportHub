(function(w,d){
'use strict';
// RC1253 P0: production rollout marker for the privileged MFA enrollment UI.
w.__EXPORTHUB_RC1253_MFA_ENROLLMENT_UI__=true;
if(w.__EXPORTHUB_RC1074_LOGIN_CLEAN__)return;
w.__EXPORTHUB_RC1074_LOGIN_CLEAN__=true;
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function isTechnicalLoginProgress(v){var t=q(v);return /^(?:Anmeldekonfiguration wird geprüft|TESTSERVICE\s*·\s*(?:Auth-Backend wird geprüft|Zugangsdaten eingeben))(?:\s*(?:…|\.{3}|\.))?$/i.test(t)}
function isStatusNode(el){if(!el||el.nodeType!==1)return false;var id=q(el.id).toLowerCase(),cls=q(el.className).toLowerCase();return /status|message|notice|alert|hint/.test(id+' '+cls)||el.hasAttribute('role')&&q(el.getAttribute('role')).toLowerCase()==='status'||el.hasAttribute('aria-live')}
function hideNode(el){if(el.getAttribute('data-rc1074-login-progress-hidden')==='true'&&el.hidden&&el.style.display==='none')return;el.hidden=true;el.style.display='none';el.setAttribute('data-rc1074-login-progress-hidden','true')}
function showNode(el){if(el.getAttribute('data-rc1074-login-progress-hidden')!=='true')return;el.hidden=false;el.style.removeProperty('display');el.removeAttribute('data-rc1074-login-progress-hidden')}
function cleanLoginStatus(){var login=d.getElementById('login');if(!login)return;var nodes=login.querySelectorAll('*');for(var i=0;i<nodes.length;i++){var el=nodes[i],t=q(el.textContent);if(isTechnicalLoginProgress(t)){el.textContent='';hideNode(el);continue}if(isStatusNode(el)&&!t){hideNode(el);continue}if(t&&!isTechnicalLoginProgress(t))showNode(el)}}

var rc1252NativeFetch=typeof w.fetch==='function'?w.fetch.bind(w):null,rc1252Mfa=null;
function rc1252LoginBody(init){if(!init||typeof init.body!=='string')return null;try{var v=JSON.parse(init.body);return v&&typeof v==='object'?v:null}catch(_){return null}}
function rc1252IsLoginRequest(input,body){var url='';try{url=typeof input==='string'?input:String(input&&input.url||'')}catch(_){}return /\/api\/exporthub-auth(?:[?#]|$)/i.test(url)&&body&&q(body.action).toLowerCase()==='login'}
function rc1252Code(){var el=d.getElementById('rc1252MfaCode');return q(el&&el.value).replace(/\s+/g,'')}
function rc1252Clear(){rc1252Mfa=null;var n=d.getElementById('rc1252MfaPanel');if(n&&n.parentNode)n.parentNode.removeChild(n)}
function rc1252Text(tag,textValue){var n=d.createElement(tag);n.textContent=textValue;return n}
function rc1252RenderMfa(){
 var login=d.getElementById('login');if(!login)return;
 var old=d.getElementById('rc1252MfaPanel');if(!rc1252Mfa){if(old&&old.parentNode)old.parentNode.removeChild(old);return}
 var target=login.querySelector&&login.querySelector('form')||login;
 if(old&&old.parentNode!==target){old.parentNode.removeChild(old);old=null}
 if(!old){
  old=d.createElement('div');old.id='rc1252MfaPanel';old.setAttribute('data-rc1252-mfa','1');
  old.style.cssText='margin-top:14px;padding:14px;border:1px solid #93c5fd;border-radius:12px;background:#eff6ff;color:#0f172a;text-align:left';
  target.appendChild(old)
 }
 while(old.firstChild)old.removeChild(old.firstChild);
 var title=rc1252Text('strong',rc1252Mfa.mode==='enroll'?'Zweiten Faktor einrichten':'Zweiten Faktor bestätigen');title.style.display='block';title.style.marginBottom='8px';old.appendChild(title);
 if(rc1252Mfa.mode==='enroll'){
  var info=rc1252Text('div','Öffnen Sie Ihre Authenticator-App und fügen Sie ExportHUB mit diesem Schlüssel hinzu:');info.style.marginBottom='6px';old.appendChild(info);
  var key=rc1252Text('code',q(rc1252Mfa.secret));key.style.cssText='display:block;padding:8px;background:#fff;border-radius:8px;word-break:break-all;font-size:14px;margin-bottom:8px';old.appendChild(key);
  if(rc1252Mfa.uri){var link=d.createElement('a');link.href=rc1252Mfa.uri;link.textContent='In Authenticator-App öffnen';link.style.cssText='display:inline-block;margin-bottom:8px';old.appendChild(link)}
 }
 var label=d.createElement('label');label.setAttribute('for','rc1252MfaCode');label.textContent='6-stelliger Authenticator-Code';label.style.cssText='display:block;font-weight:600;margin:6px 0';old.appendChild(label);
 var input=d.getElementById('rc1252MfaCode')||d.createElement('input');input.id='rc1252MfaCode';input.type='text';input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.pattern='[0-9]{6}';input.placeholder='123456';input.setAttribute('aria-label','6-stelliger Authenticator-Code');input.style.cssText='width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #94a3b8;border-radius:8px;font-size:16px;letter-spacing:.18em';old.appendChild(input);
 var hint=rc1252Text('div','Danach erneut auf Anmelden klicken.');hint.style.cssText='margin-top:7px;font-size:12px;color:#475569';old.appendChild(hint)
}
function rc1252Capture(data){
 if(!data||data.mfaRequired!==true)return false;
 rc1252Mfa={mode:q(data.mfaMode)==='enroll'?'enroll':'verify',challenge:q(data.mfaChallenge),secret:q(data.mfaEnrollmentSecret),uri:q(data.mfaEnrollmentUri)};
 rc1252RenderMfa();return true
}
function rc1252Prepare(body){
 var next=Object.assign({},body||{});
 if(rc1252Mfa&&rc1252Mfa.challenge){var code=rc1252Code();if(code){next.mfaChallenge=rc1252Mfa.challenge;next.mfaCode=code}}
 return next
}
function rc1252HandleError(error){var data=error&&error.data;return !!(data&&data.mfaRequired===true&&rc1252Capture(data))}
function rc1252InstallFetch(){
 if(!rc1252NativeFetch||w.__EXPORTHUB_RC1252_FETCH__)return;
 w.__EXPORTHUB_RC1252_FETCH__=true;
 w.fetch=function(input,init){
  var body=rc1252LoginBody(init),isLogin=rc1252IsLoginRequest(input,body),nextInit=init;
  if(isLogin&&rc1252Mfa&&rc1252Mfa.challenge){
   var code=rc1252Code();
   if(code){
    var nextBody=Object.assign({},body,{mfaChallenge:rc1252Mfa.challenge,mfaCode:code});
    nextInit=Object.assign({},init,{body:JSON.stringify(nextBody)})
   }
  }
  return rc1252NativeFetch(input,nextInit).then(function(response){
   if(!isLogin||!response||typeof response.clone!=='function')return response;
   return response.clone().json().then(function(data){
    if(data&&data.mfaRequired===true)rc1252Capture(data);
    else if(response.ok&&data&&data.ok===true)rc1252Clear();
    return response
   }).catch(function(){return response})
  })
 }
}

/* RC1109: ABD-Anfragen behalten und zeigen ihren Kunden. */
var rc1109SaveBusy=false,rc1109SaveTimer=0,rc1109RenderTimer=0;
function rc1109Arr(v){return Array.isArray(v)?v:[]}
function rc1109State(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||null}catch(_){ }return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||null}
function rc1109Same(a,b){return !!q(a)&&q(a).toLowerCase()===q(b).toLowerCase()}
function rc1109Ref(v){return q(v&&(v.ref||v.reference||v.shipmentRef||v.linkedShipmentRef||v.sourceRef))}
function rc1109Shipment(s,a){var id=q(a&&(a.linkedShipmentId||a.shipmentId||a.sourceId)),ref=rc1109Ref(a),all=rc1109Arr(s&&s.shipments).concat(rc1109Arr(s&&s.savedShipments),rc1109Arr(s&&s.archive));return all.find(function(sh){return sh&&((id&&rc1109Same(sh.id,id))||(ref&&rc1109Same(rc1109Ref(sh),ref)))})||null}
function rc1109CustomerMaster(s,p){return rc1109Arr(s&&s.customers).find(function(c){return c&&(rc1109Same(c.id,p.customerId)||rc1109Same(c.account||c.customerNumber,p.customerNumber)||rc1109Same(c.name||c.customerName,p.customerName))})||null}
function rc1109ResolveCustomer(s,a){var sh=rc1109Shipment(s,a)||{},p={customerId:q(a&&a.customerId||sh.customerId||sh.linkedCustomerId),customerNumber:q(a&&a.customerNumber||a&&a.customerAccount||sh.customerNumber||sh.customerAccount),customerName:q(a&&a.customerName||a&&a.customer||sh.customerName||sh.customer)},c=rc1109CustomerMaster(s,p)||{};return{customerId:p.customerId||q(c.id),customerNumber:p.customerNumber||q(c.account||c.customerNumber),customerName:p.customerName||q(c.name||c.customerName)}}
function rc1109EnrichRequests(s){s=s||rc1109State();var changed=false,requests=rc1109Arr(s&&s.abdRequests);requests.forEach(function(a){if(!a||typeof a!=='object')return;var c=rc1109ResolveCustomer(s,a);if(!q(a.customerName)&&c.customerName){a.customerName=c.customerName;changed=true}if(!q(a.customerNumber)&&c.customerNumber){a.customerNumber=c.customerNumber;changed=true}if(!q(a.customerId)&&c.customerId){a.customerId=c.customerId;changed=true}});return{changed:changed,requests:requests}}
async function rc1109Persist(){var s=rc1109State(),r=rc1109EnrichRequests(s),clean=w.ExportHUBClean;if(!r.changed||rc1109SaveBusy||!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')return r.changed;rc1109SaveBusy=true;try{await Promise.resolve(clean.queueSave('RC1109 ABD-Kundendaten ergänzt'));await Promise.resolve(clean.flushSave('RC1109 ABD-Kundendaten ergänzt'));return true}catch(e){try{w.console&&w.console.warn&&w.console.warn('RC1109 ABD-Kundendaten konnten noch nicht gespeichert werden',e)}catch(_){ }return false}finally{rc1109SaveBusy=false}}
function rc1109RequestForCard(s,card){var text=q(card&&card.textContent),data=card&&card.dataset||{},keys=[data.sourceRef,data.ref,data.reference,data.taskId,data.sourceId].map(q).filter(Boolean);return rc1109Arr(s&&s.abdRequests).find(function(a){var ref=rc1109Ref(a),id=q(a&&a.id);return keys.some(function(k){return rc1109Same(k,ref)||rc1109Same(k,id)})||(ref&&text.indexOf(ref)>=0)})||null}
function rc1109EnhanceDashboard(){var s=rc1109State();if(!s||!d||typeof d.querySelectorAll!=='function')return 0;rc1109EnrichRequests(s);var count=0,cards=Array.from(d.querySelectorAll('.rc229-task-card.rc628-unified-task, .task-card, [data-task-id], [data-source-ref]'));cards.forEach(function(card){if(!/\bABD\b/i.test(q(card&&card.textContent)))return;var a=rc1109RequestForCard(s,card);if(!a)return;var c=rc1109ResolveCustomer(s,a),name=q(c.customerName);if(!name)return;var el=card.querySelector&&card.querySelector('[data-rc1109-abd-customer]');if(!el){el=d.createElement('div');el.setAttribute('data-rc1109-abd-customer','1');el.className='rc1109-abd-customer';if(typeof card.appendChild==='function')card.appendChild(el)}el.textContent='Kunde: '+name+(c.customerNumber?' · '+c.customerNumber:'');count++});return count}
function rc1109Schedule(){if(rc1109RenderTimer&&w.clearTimeout)w.clearTimeout(rc1109RenderTimer);rc1109RenderTimer=w.setTimeout(function(){rc1109RenderTimer=0;rc1109EnhanceDashboard()},0);if(rc1109SaveTimer&&w.clearTimeout)w.clearTimeout(rc1109SaveTimer);rc1109SaveTimer=w.setTimeout(function(){rc1109SaveTimer=0;rc1109Persist()},250)}
function install(){cleanLoginStatus();rc1252InstallFetch();rc1252RenderMfa();rc1109Schedule();if(!d.documentElement||w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__)return;w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__=new MutationObserver(function(){cleanLoginStatus();rc1252RenderMfa();rc1109Schedule()});w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__.observe(d.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','style']})}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
w.addEventListener('exporthub:ready',cleanLoginStatus);['exporthub:rendered','exporthub:viewchange','exporthub:tasks-updated'].forEach(function(n){w.addEventListener(n,rc1109Schedule)});
w.ExportHUBRC1252Mfa=Object.freeze({version:'RC1254',render:rc1252RenderMfa,clear:rc1252Clear,capture:rc1252Capture,prepare:rc1252Prepare,handleError:rc1252HandleError});
w.ExportHUBRC1109AbdDashboardCustomer=Object.freeze({resolveCustomer:rc1109ResolveCustomer,enrichRequests:rc1109EnrichRequests,enhanceDashboard:rc1109EnhanceDashboard,persistEnrichment:rc1109Persist});
})(window,document);
