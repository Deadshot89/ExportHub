(function(){
'use strict';
if(window.__EXPORTHUB_RC534_QR_SECURITY__)return;window.__EXPORTHUB_RC534_QR_SECURITY__=true;
var inflight={},installed=false,baseRender=null,patchTimer=0,observer=null;
function nativeTimeout(fn,ms){var n=window.ExportHUBClean&&window.ExportHUBClean.native;return (n&&n.setTimeout?n.setTimeout:window.setTimeout)(fn,ms)}
function nativeClear(id){var n=window.ExportHUBClean&&window.ExportHUBClean.native;try{return (n&&n.clearTimeout?n.clearTimeout:window.clearTimeout)(id)}catch(e){}}
function S(){try{return window.__EXPORTHUB_GET_STATE__?window.__EXPORTHUB_GET_STATE__():(window.state||state||{})}catch(e){return window.state||(window.state={})}}
function A(v){return Array.isArray(v)?v:[]}
function Q(v){return String(v==null?'':v).trim()}
function E(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function now(){return new Date().toISOString()}
function randomHex(bytes){try{var a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}catch(e){var s='';while(s.length<bytes*2)s+=Math.random().toString(16).slice(2);return s.slice(0,bytes*2)}}
function randomPin(){try{var a=new Uint32Array(1);crypto.getRandomValues(a);return String(10000+(a[0]%90000))}catch(e){return String(10000+Math.floor(Math.random()*90000))}}
function key(sh){return Q(sh&&(sh.id||sh.shipmentId||sh.ref)).toUpperCase()}
function same(a,b){return !!(a&&b&&key(a)&&key(a)===key(b))}
function used(sh){return !!(sh&&(sh.pickupQrUsed||sh.podScanConfirmed||sh.pickedUpAt||Q(sh.pickupStatus)==='abgeholt'))}
function pinTaken(sh,pin){pin=Q(pin);return !!pin&&A(S().shipments).some(function(x){return !same(x,sh)&&!used(x)&&Q(x.pickupPin)===pin})}
function uniquePin(sh){var pin='',tries=0;do{pin=randomPin();tries++}while(pinTaken(sh,pin)&&tries<200);return pin}
function current(){var s=S(),id=Q(s.activeShipmentId);if(id&&id!=='current'){var x=A(s.shipments).find(function(v){return Q(v.id)===id||Q(v.ref)===id});if(x)return x}return s.shipment||{}}
function saved(sh){return A(S().shipments).find(function(x){return same(x,sh)})||null}
function credentialVersion(sh){return Math.max(0,Number(sh&&(sh.pickupCredentialVersion||sh.credentialVersion)||0)||0)}
function credentialLocked(sh){return !!(sh&&(sh.pickupQrRegistered||sh.pickupPinLocked||sh.pickupQrActivating||credentialVersion(sh)>0))}
function copyCredentials(target,source){if(!target||!source)return;Object.assign(target,{pickupToken:source.pickupToken,pickupPin:source.pickupPin,qrPin:source.pickupPin,pickupQrVersion:7,pickupQrRegistered:!!source.pickupQrRegistered,pickupQrActivating:!!source.pickupQrActivating,pickupPinLocked:!!source.pickupPinLocked,pickupCredentialVersion:credentialVersion(source),pickupPinRevision:Number(source.pickupPinRevision||0),pickupQrPinRotatedAt:source.pickupQrPinRotatedAt||'',pickupQrError:source.pickupQrError||''})}
function ensure(sh,forceRotate){
  if(!sh)return sh;
  var changed=false,locked=credentialLocked(sh),rotate=!!forceRotate&&!used(sh)&&!sh.pickupQrActivating;
  if(!/^[a-f0-9]{48}$/i.test(Q(sh.pickupToken))){
    if(locked&&!rotate){sh.pickupQrError='Registriertes QR-Token fehlt. Bitte QR-Zugang ausdrücklich neu erzeugen.';return sh}
    sh.pickupToken=randomHex(24);sh.pickupQrCreatedAt=now();sh.pickupQrRegistered=false;sh.pickupPinLocked=false;changed=true;
  }
  if(!used(sh)){
    var valid=/^\d{5}$/.test(Q(sh.pickupPin))&&Q(sh.pickupPin)!=='25846';
    if(rotate){sh.pickupPin=uniquePin(sh);sh.pickupQrRegistered=false;sh.pickupPinLocked=false;sh.pickupQrPinRotatedAt=now();sh.pickupQrError='';changed=true}
    else if(!locked&&(!valid||pinTaken(sh,Q(sh.pickupPin)))){sh.pickupPin=uniquePin(sh);sh.pickupQrRegistered=false;sh.pickupPinLocked=false;sh.pickupQrPinRotatedAt=now();sh.pickupQrError='';changed=true}
    else if(locked&&!valid){sh.pickupQrError='Die registrierte interne PIN fehlt. Bitte QR-Zugang ausdrücklich neu erzeugen.'}
  }
  sh.qrPin=Q(sh.pickupPin);sh.pickupQrVersion=7;
  var copy=saved(sh);if(copy&&copy!==sh)copyCredentials(copy,sh);
  return sh
}
function migrate(){
  var s=S(),changed=false,map={};
  A(s.shipments).forEach(function(sh){var before=[sh.pickupToken,sh.pickupPin,sh.pickupQrRegistered,sh.pickupPinLocked,credentialVersion(sh)].join('|');ensure(sh,false);map[key(sh)]=sh;if(before!==[sh.pickupToken,sh.pickupPin,sh.pickupQrRegistered,sh.pickupPinLocked,credentialVersion(sh)].join('|'))changed=true});
  if(s.shipment){var k=key(s.shipment),match=map[k];if(match&&match!==s.shipment)copyCredentials(s.shipment,match);else{var before=[s.shipment.pickupToken,s.shipment.pickupPin,s.shipment.pickupQrRegistered,s.shipment.pickupPinLocked,credentialVersion(s.shipment)].join('|');ensure(s.shipment,false);if(before!==[s.shipment.pickupToken,s.shipment.pickupPin,s.shipment.pickupQrRegistered,s.shipment.pickupPinLocked,credentialVersion(s.shipment)].join('|'))changed=true}}
  if(changed)save('RC534 QR-Zugangsdaten abgeglichen');return changed
}
function customer(sh){var c=sh&&sh.customer||{},id=Q(sh&&sh.customerId),name=Q(sh&&sh.customerName);return A(S().customers).find(function(x){return (id&&[x.id,x.account,x.customerNumber].some(function(v){return Q(v)===id}))||(name&&Q(x.name)===name)})||c||{}}
function pickupUrl(sh){var u=new URL('pickup.html',document.baseURI||location.href);u.search='?token='+encodeURIComponent(Q(sh.pickupToken));return u.href}
function save(reason){try{if(window.ExportHUBClean&&window.ExportHUBClean.queueSave)window.ExportHUBClean.queueSave(reason||'RC534 QR');else if(typeof window.save==='function')window.save()}catch(e){console.error(e)}}
function api(path,opt){opt=opt||{};opt.credentials='same-origin';opt.headers=Object.assign({'Content-Type':'application/json','Accept':'application/json'},opt.headers||{});return fetch('/api'+path,opt).then(async function(r){var b={};try{b=await r.json()}catch(e){}if(!r.ok){var er=new Error(b.message||b.error||('HTTP '+r.status));er.status=r.status;er.body=b;throw er}return b})}
function register(sh,forceRotate){
  sh=ensure(sh,!!forceRotate);
  if(!sh||!Q(sh.ref))return Promise.reject(new Error('Sendungsreferenz fehlt.'));
  if(used(sh))return Promise.resolve(false);
  var token=Q(sh.pickupToken),pin=Q(sh.pickupPin),expectedVersion=credentialVersion(sh);
  if(!/^[a-f0-9]{48}$/i.test(token))return Promise.reject(new Error('QR-Token ist ungültig.'));
  if(!/^\d{5}$/.test(pin))return Promise.reject(new Error('Interne QR-PIN fehlt oder ist ungültig.'));
  if(inflight[token])return inflight[token];
  sh.pickupQrActivating=true;sh.pickupQrError='';patch();
  var c=customer(sh),baseBody={token:token,pin:'0'+pin,shipmentId:Q(sh.id||sh.shipmentId||sh.ref),reference:Q(sh.ref),customer:Q(c.name||sh.customerName),recipient:Q(sh.recipientName||c.name||sh.customerName),expiresDays:180};
  function postRegistration(rotate,version){var body=Object.assign({},baseBody,{rotate:!!rotate,expectedCredentialVersion:Number(version||0)});return api('/pickup-init',{method:'POST',body:JSON.stringify(body)})}
  function recoverConflict(error){
    var code=Q(error&&error.body&&error.body.code);
    if(code!=='PIN_CONFLICT'&&code!=='CREDENTIAL_VERSION_CONFLICT')throw error;
    return api('/pickup-status?token='+encodeURIComponent(token),{method:'GET',headers:{}}).then(function(st){return postRegistration(true,Number(st.credentialVersion||expectedVersion||1))})
  }
  inflight[token]=postRegistration(!!forceRotate,expectedVersion).catch(recoverConflict).then(function(r){
    if(Q(sh.pickupToken)!==token||Q(sh.pickupPin)!==pin){sh.pickupToken=token;sh.pickupPin=pin;sh.qrPin=pin;sh.pickupQrError='Lokale PIN-Abweichung wurde auf die serverseitig registrierte PIN zurückgesetzt.'}
    sh.pickupQrRegistered=true;sh.pickupQrActivating=false;sh.pickupPinLocked=true;sh.pickupQrRegisteredAt=now();sh.pickupQrServerStatus=r.status||'open';sh.pickupCredentialVersion=Number(r.credentialVersion||expectedVersion||1);sh.pickupPinRevision=Number(r.pinRevision||1);if(!sh.pickupQrError)sh.pickupQrError='';
    var cp=saved(sh);if(cp&&cp!==sh)copyCredentials(cp,sh);
    save('RC534 QR servergebunden aktiviert');patch();return true
  }).catch(function(e){sh.pickupQrActivating=false;sh.pickupQrError=e.status===401?'Microsoft-Anmeldung erforderlich':Q(e.message||e);save('RC534 QR Aktivierungsfehler');patch();throw e}).finally(function(){delete inflight[token]});
  return inflight[token]
}
function qrHtml(sh){if(used(sh))return '<div class="rc534-qr-message ok">QR bereits verwendet</div>';if(!sh.pickupQrRegistered)return '<div class="rc534-qr-message '+(sh.pickupQrError?'bad':'')+'">'+E(sh.pickupQrActivating?'QR wird aktiviert …':sh.pickupQrError||'QR noch nicht aktiviert')+'</div>';if(!window.ExportHUBQRCode||typeof window.ExportHUBQRCode.svg!=='function')return '<div class="rc534-qr-message bad">Lokaler QR-Generator fehlt.</div>';return window.ExportHUBQRCode.svg(pickupUrl(sh),{className:'rc534-local-qr',label:'QR-Abholscan'})}
function patchDoc(doc){var sh=ensure(current(),false);if(!sh||!Q(sh.ref)||!doc)return;var p1=doc.getElementById('rc420Load1')||doc.querySelector('.rc420-load[data-rc420-load="1"]')||doc.querySelector('.rc390-load');if(p1){var ref=p1.querySelector('.rc420-load-ref,.rc390-load-ref,.rc355-ref')||p1,qr=p1.querySelector('.rc420-qr,.rc390-qr,.rc355-qr,.rc344-qr-only'),sig=[key(sh),Q(sh.pickupToken),!!sh.pickupQrRegistered,!!sh.pickupQrActivating,Q(sh.pickupQrError),used(sh)].join('|');if(!qr){qr=doc.createElement('div');qr.className='rc420-qr rc534-qr-slot'}if(qr.parentNode!==ref)ref.appendChild(qr);qr.classList.remove('empty');qr.setAttribute('data-rc534-secure','1');if(qr.getAttribute('data-rc534-state')!==sig){qr.setAttribute('data-rc534-state',sig);qr.innerHTML=qrHtml(sh)}if(!used(sh)&&!sh.pickupQrRegistered&&!sh.pickupQrActivating&&!Q(sh.pickupQrError))nativeTimeout(function(){register(sh,false).catch(function(){})},0)}var p2=doc.getElementById('rc420Load2')||doc.querySelector('.rc420-load[data-rc420-load="2"]')||doc.querySelectorAll('.rc390-load')[1];if(p2)Array.from(p2.querySelectorAll('.rc420-qr,.rc390-qr,.rc355-qr,.rc344-qr-only,[data-rc534-secure]')).forEach(function(q){q.remove()})}
function panelSig(sh){return [key(sh),Q(sh.pickupPin),!!sh.pickupQrRegistered,!!sh.pickupQrActivating,!!sh.pickupPinLocked,credentialVersion(sh),Number(sh.pickupPinRevision||0),Q(sh.pickupQrError),used(sh)].join('|')}
function panelHtml(sh){var isUsed=used(sh),active=!!sh.pickupQrRegistered&&!isUsed,status=isUsed?'bereits verwendet':sh.pickupQrActivating?'Aktivierung läuft':active?'aktiv':sh.pickupQrError?'Fehler':'noch nicht aktiviert',cls=isUsed||active?'green':sh.pickupQrError?'red':'orange',pin=isUsed?'—':Q(sh.pickupPin)||'—',sig=E(panelSig(sh));return '<section id="rc534QrSecurityPanel" data-rc534-state="'+sig+'" class="rc534-qr-security no-print"><div><span class="rc534-kicker">Sicherer Abholscan</span><h3>QR-Code &amp; interne PIN</h3><p>Die PIN ist nur intern sichtbar. Sie steht nicht auf Ladeliste, PDF oder im QR-Link.</p></div><div class="rc534-qr-security-grid"><div><span>Status</span><strong class="'+cls+'">'+E(status)+'</strong></div><div><span>Interne PIN</span><strong class="rc534-pin">'+E(pin)+'</strong></div><div><span>Einmalnutzung</span><strong>'+(isUsed?'verbraucht':'aktiv')+'</strong></div></div><div class="toolbar"><button type="button" class="btn" onclick="return rc534ActivateQr()" '+(isUsed||sh.pickupQrActivating?'disabled':'')+'>'+(active?'QR neu registrieren':'QR aktivieren')+'</button><button type="button" class="ghost" onclick="return rc534CopyPin()" '+(isUsed?'disabled':'')+'>PIN kopieren</button><button type="button" class="ghost" onclick="return rc534CheckQrStatus()">Status prüfen</button></div>'+(sh.pickupQrError?'<div class="badbox">'+E(sh.pickupQrError)+'</div>':'')+'</section>'}
function insertPanel(){var sh=ensure(current(),false),old=document.getElementById('rc534QrSecurityPanel');if(!sh||!Q(sh.ref)){if(old)old.remove();return}var sig=panelSig(sh);if(old&&old.getAttribute('data-rc534-state')===sig)return;var html=panelHtml(sh);if(old){old.outerHTML=html;return}var host=document.getElementById('rc532ProcessActions')||document.getElementById('rc534ProcessActions');if(host)host.insertAdjacentHTML('afterend',html);else if(Q(S().view)==='cmr'){var r=document.getElementById('content'),bundle=r&&r.querySelector('.rc390-docview,.rc390-bundle,#rc420DocumentPage');if(bundle)bundle.insertAdjacentHTML('beforebegin',html)}}
function hookRender(){var fn=window.render;if(typeof fn!=='function'||fn.__rc534Qr)return;baseRender=fn;var w=function(){var out=baseRender.apply(this,arguments);schedule(0);return out};w.__rc534Qr=true;window.render=w;try{render=w}catch(e){}}
function schedule(ms){nativeClear(patchTimer);patchTimer=nativeTimeout(patch,Number(ms)||40)}
function patch(){try{hookRender();migrate();patchDoc(document);var f=document.getElementById('rc420PrintFrame');if(f&&f.contentDocument)patchDoc(f.contentDocument);insertPanel()}catch(e){window.__rc534QrPatchError=Q(e&&e.message||e)}}
function syncStatus(sh){sh=ensure(sh||current(),false);if(!/^[a-f0-9]{48}$/i.test(Q(sh.pickupToken)))return Promise.resolve(false);return api('/pickup-status?token='+encodeURIComponent(Q(sh.pickupToken)),{method:'GET',headers:{}}).then(function(st){sh.pickupCredentialVersion=Number(st.credentialVersion||credentialVersion(sh)||0);sh.pickupPinRevision=Number(st.pinRevision||sh.pickupPinRevision||0);sh.pickupPinLocked=st.pinLocked!==false&&sh.pickupCredentialVersion>0;if(st.confirmedAt){var iso=new Date(st.confirmedAt).toISOString(),day=iso.slice(0,10);sh.actualPickupDate=day;sh.pickedUpAtDate=day;sh.actualPickupTime=new Date(iso).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});sh.pickedUpAt=iso;sh.pickupStatus='abgeholt';sh.status='erledigt';sh.done=true;sh.completedAt=iso;sh.pickupQrUsed=true;sh.pickupQrUsedAt=iso;sh.podScanConfirmed=true;var remote=A(st.podFiles).map(function(f){return {id:'QR-'+Q(f.id),remoteId:Q(f.id),name:Q(f.name)||'POD.pdf',filename:Q(f.name)||'POD.pdf',url:Q(f.url),type:Q(f.type)||'application/pdf',mimeType:Q(f.type)||'application/pdf',size:Number(f.size||0),uploadedAt:Q(f.uploadedAt),added:Q(f.uploadedAt),remote:true,source:'QR',kind:Q(f.kind)}});if(remote.length){var map={};A(sh.podFiles).concat(remote).forEach(function(f){map[Q(f.remoteId)||Q(f.url)||Q(f.id)||Q(f.name)]=f});sh.podFiles=Object.keys(map).map(function(k){return map[k]});sh.podStatus='POD vorhanden';sh.podCount=sh.podFiles.length}var id=Q(sh.id),ref=Q(sh.ref).toUpperCase();A(S().tasks).forEach(function(t){if(Q(t.area).toLowerCase()==='abholtag'&&((id&&Q(t.linkedShipmentId)===id)||(ref&&Q(t.linkedShipmentRef).toUpperCase()===ref))){t.status='erledigt';t.done=true;t.completedAt=iso;t.doneAt=iso}});save('RC534 QR-Status synchronisiert')}patch();try{if(typeof window.render==='function')window.render()}catch(e){}return !!st.confirmedAt})}
window.rc534Patch=patch;window.rc534ActivateQr=function(){var sh=ensure(current(),false);register(sh,false).catch(function(e){alert('QR-Aktivierung fehlgeschlagen: '+Q(e.message||e))});return false};
window.rc534CopyPin=function(){var sh=ensure(current(),false),pin=Q(sh.pickupPin);if(!pin)return false;try{navigator.clipboard.writeText(pin).then(function(){alert('Interne QR-PIN kopiert.')},function(){prompt('Interne QR-PIN:',pin)})}catch(e){prompt('Interne QR-PIN:',pin)}return false};
window.rc534CheckQrStatus=function(){syncStatus(current()).catch(function(e){alert('QR-Status konnte nicht geprüft werden: '+Q(e.message||e))});return false};
window.rc534SyncPickup=function(){return A(S().shipments).reduce(function(p,sh){return p.then(function(){return syncStatus(sh).catch(function(){return false})})},Promise.resolve(false))};
window.ExportHUBPickupQR={version:'RC534',engine:'single-server-bound',ensure:ensure,register:register,syncStatus:syncStatus,diagnostics:function(){return {singleEngine:true,legacyActivationAliases:false,registeredPinLocked:credentialLocked(current()),credentialVersion:credentialVersion(current()),pinRevision:Number(current().pickupPinRevision||0)}}};
function install(){if(installed)return;installed=true;hookRender();migrate();window.addEventListener('exporthub:sync',function(){schedule(0)});document.addEventListener('click',function(){schedule(80)},true);try{observer=new MutationObserver(function(ms){if(ms.some(function(m){return m.addedNodes&&m.addedNodes.length||m.removedNodes&&m.removedNodes.length}))schedule(60)});observer.observe(document.body||document.documentElement,{childList:true,subtree:true})}catch(e){}patch();[100,400,1000].forEach(function(ms){nativeTimeout(patch,ms)})}
if(window.__EXPORTHUB_READY__)install();else window.addEventListener('exporthub:ready',install,{once:true});[0,250,1000,2500].forEach(function(ms){nativeTimeout(function(){if(window.__EXPORTHUB_READY__)install()},ms)});
})();
