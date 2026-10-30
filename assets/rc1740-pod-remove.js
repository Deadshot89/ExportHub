/* ExportHUB360 RC1740 – remove a POD from a shipment and upload a new one.
   The POD section of the shipment overview card used to offer only "POD öffnen", so a wrong POD could not be
   replaced. This script lists the signed loading list from the QR pickup and every uploaded POD file there, each
   with a "POD entfernen" button (shipment creator, document admin or global admin; a reason is required).
   - Uploaded file: a tombstone (status "deleted", no content, hidden from the customer portal) stays in podFiles,
     because the server merges podFiles additively (api/shared/merge.js mergePodFilesProtected) and would otherwise
     bring the file back. The full file goes to documentHistory.
   - QR POD: the QR files get tombstones and shipment.qrPodRemoval marks the removal. The driver signature stays
     as pickup evidence; the pickup sync (index.html applyStatus) and the POD-evidence checks ask qrRemoved() and
     no longer count it as POD. A new QR pickup after the removal counts again.
   Status: picked up without POD = "Abgeholt", otherwise "Erstellt"; then "POD hochladen" stores a new POD the
   normal way, and "POD als PDF" opens that uploaded POD. Texts live in assets/i18n/rc1740-pod-remove.js. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBPodRemove1740)return;
var VERSION='RC1740',QR_KEY='qr-pickup',STYLE_ID='rc1740-pod-remove-style',LIST_CLASS='rc1740-pod-files';
var timer=0,observer=null,started=false,busy={};

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function packs(){var p=w.ExportHUBPodRemove1740I18n;return(p&&p.packs)||{}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),s=(all[lang()]||{})[key];if(s==null)s=(all.de||{})[key];s=String(s==null?key:s);Object.keys(vars||{}).forEach(function(k){s=s.split('{{'+k+'}}').join(String(vars[k]))});return s}
function setT(fn,ms){var n=w.ExportHUBClean&&w.ExportHUBClean.native;return(n&&n.setTimeout?n.setTimeout:w.setTimeout)(fn,ms)}
function sleep(ms){return new Promise(function(r){setT(r,ms)})}

function state(){try{return w.__EXPORTHUB_GET_STATE__?w.__EXPORTHUB_GET_STATE__():(w.state||{})}catch(_){return w.state||{}}}
function sid(sh){return q(sh&&(sh.id||sh.shipmentId||sh.savedShipmentId))}
function sref(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.sendungsreferenz)).toUpperCase()}
function sameShipment(a,b){if(!a||!b)return false;if(a===b)return true;var ar=sref(a),br=sref(b);if(ar&&br)return ar===br;var ai=sid(a),bi=sid(b);return!!ai&&ai===bi}
/* Every copy of the shipment in the browser state (list, saved list, open shipment). */
function copies(key){
 var s=state(),out=[],probe=null;
 [].concat(arr(s.shipments),arr(s.savedShipments),[s.shipment,s.currentShipment,s.selectedShipment]).forEach(function(x){
  if(!x||typeof x!=='object')return;
  if(!probe&&(sid(x)===key||sref(x)===q(key).toUpperCase()))probe=x;
 });
 if(!probe)return out;
 [].concat(arr(s.shipments),arr(s.savedShipments),[s.shipment,s.currentShipment,s.selectedShipment]).forEach(function(x){
  if(x&&typeof x==='object'&&out.indexOf(x)<0&&sameShipment(x,probe))out.push(x);
 });
 return out;
}
function primary(list){return list.slice().sort(function(a,b){return arr(b.podFiles).length-arr(a.podFiles).length})[0]||null}

function currentUser(){try{var r=w.ExportHUBClean&&w.ExportHUBClean.runtime;return(r&&r.user)||w.currentUser||null}catch(_){return w.currentUser||null}}
function userKey(u){return low(u&&(u.id||u.userId||u.user||u.login||u.username||u.email||u.name))}
function userName(u){return q(u&&(u.name||u.displayName||u.user||u.username||u.login||u.email))}
function isGlobal(u){var role=low(u&&(u.role||u.rolle));return!!u&&(u.globalAdmin===true||u.isAdmin===true||u.admin===true||role==='admin'||/global.?admin|administrator|vollzugriff/.test(role)||arr(u.permissions).indexOf('*')>=0)}
function isCreator(sh,u){var uk=userKey(u);if(!uk||!sh)return false;return[sh.createdById,sh.createdByUserId,sh.createdBy,sh.creatorId,sh.creator,sh.ownerId,sh.owner,sh.createdByName].map(low).filter(Boolean).indexOf(uk)>=0}
function isDocumentAdmin(){try{return typeof w.canAdmin==='function'&&w.canAdmin('cmr')===true}catch(_){return false}}
function canRemove(sh){var u=currentUser();return isGlobal(u)||isCreator(sh,u)||isDocumentAdmin()}

function inactive(f){return!f||f.placeholder||f.fallback||f.syntheticFallback||/deleted|gelöscht|geloscht|replaced|ersetzt|removed/.test(low(f.status))}
function payload(f){return q(f&&(f.data||f.dataUrl||f.url||f.downloadUrl||f.href||f.contentUrl||f.blobName||f.storageBlobName))}
/* PODs created by the QR pickup (driver signature, pickup store) are removed as one unit under QR_KEY. */
function fromQrPickup(f){return/^QR-/i.test(q(f&&f.id))||f.remote===true||/qr|pickup|signed-loadlist|automatic-pod|unterschrieben|scan-confirmation|abholscan/.test(low([f.source,f.kind,f.docKind].join(' ')))}
function removableFiles(sh){return arr(sh&&sh.podFiles).map(function(f,index){return{file:f,index:index}}).filter(function(x){return!inactive(x.file)&&!fromQrPickup(x.file)&&!!payload(x.file)})}
function fileKey(f){return q(f&&(f.id||f.remoteId||f.blobName||f.storageBlobName||f.name||f.filename||f.fileName))}
function fileName(f){return q(f&&(f.name||f.filename||f.fileName||f.originalName))||'POD.pdf'}
function fileDate(f){var v=q(f&&(f.uploadedAt||f.createdAt||f.addedAt)),dt=new Date(v);if(!v||isNaN(dt.getTime()))return'';var l=lang();try{return dt.toLocaleDateString(l==='en'?'en-GB':l,{day:'2-digit',month:'2-digit',year:'numeric'})}catch(_){return v.slice(0,10)}}

/* A removed QR POD stays removed until a new QR pickup is confirmed after the removal. The driver
   signature itself is kept as pickup evidence; the pickup sync (index.html applyStatus) and every
   POD-evidence check ask qrRemoved() first. */
function qrRemoved(sh){
 var m=sh&&sh.qrPodRemoval;if(!m||typeof m!=='object'||!q(m.at)||q(m.revokedAt))return false;
 var removed=Date.parse(m.at)||0,confirmed=Date.parse(q(sh.pickupConfirmedAt||sh.qrPickupConfirmedAt))||0;
 return!(confirmed&&removed&&confirmed>removed);
}
function hasManualPod(sh){return removableFiles(sh).length>0}
function qrFile(f){return fromQrPickup(f)&&!/scan-confirmation|abholscan/.test(low([f.kind,f.source].join(' ')))}
function signatureEvidence(sh){
 if(qrRemoved(sh))return false;
 var direct=q(sh&&(sh.pickupDriverSignature||sh.driverSignature||sh.signatureDataUrl||sh.pickupSignature||sh.pickupDriverSignatureUrl||sh.driverSignatureUrl||sh.pickupSignatureUrl||sh.signatureUrl));
 return!!direct||!!(sh&&sh.remotePickupStatusLocked===true&&sh.podServerVerified===true)||arr(sh&&sh.podFiles).some(function(f){return!inactive(f)&&qrFile(f)});
}
function pickedUp(sh){return!!(sh&&(sh.pickedUpAt||sh.actualPickupDate||sh.actualPickupAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.pickupQrUsedAt||sh.qrPickupConfirmed===true||sh.pickupQrUsed===true||sh.pickupConfirmed===true||/abgeholt|picked|confirmed|completed/.test(low([sh.pickupStatus,sh.pickupQrServerStatus].join(' ')))))}

/* Marks the POD as removed on one shipment copy. Returns true when the copy had the file. */
function removeFromCopy(sh,key,info){
 var list=arr(sh.podFiles),qr=key===QR_KEY,hit=qr&&signatureEvidence(sh);
 list.forEach(function(f,i){
  if(!f||inactive(f)||(qr?!qrFile(f):fileKey(f)!==key))return;
  hit=true;key=qr?QR_KEY:key;
  var full=clone(f);full.status='deleted';full.deletedAt=info.at;full.deletedBy=info.by;full.deletionReason=info.reason;full.docKind=full.docKind||'pod';full.collectionKey='podFiles';
  sh.documentHistory=arr(sh.documentHistory);
  if(!sh.documentHistory.some(function(h){return fileKey(h)===fileKey(f)&&q(h.deletedAt)===info.at}))sh.documentHistory.push(full);
  /* Tombstone without content: keeps the server merge from restoring the file and hides it everywhere. */
  var stone=clone(f);['data','dataUrl','url','downloadUrl','href','contentUrl','base64','content','fileData'].forEach(function(k){delete stone[k]});
  stone.status='deleted';stone.deletedAt=info.at;stone.deletedBy=info.by;stone.deletionReason=info.reason;stone.customerAvisVisible=false;
  list[i]=stone;
 });
 if(!hit)return false;
 sh.podFiles=list;
 if(qr){
  sh.qrPodRemoval={at:info.at,by:info.by,reason:info.reason,pickupConfirmedAt:q(sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickedUpAt)};
  sh.signatureAvailable=false;sh.driverSignatureAvailable=false;sh.podScanConfirmed=false;sh.podServerVerified=false;sh.podServerVerifiedAt='';sh.podConfirmedAt='';sh.podDocumentType='';sh.podDisplayName='';
 }
 var remaining=removableFiles(sh).length,signed=signatureEvidence(sh);
 if(remaining&&qr){sh.podStatus='POD vorhanden';sh.podAvailable=true;sh.podConfirmed=true}
 sh.podCount=arr(sh.podFiles).filter(function(f){return!inactive(f)}).length;
 if(!remaining&&!signed){
  var picked=pickedUp(sh);
  sh.podStatus='POD fehlt';
  sh.podAvailable=false;sh.podConfirmed=false;sh.hasPod=false;sh.podUploadedAt='';
  /* The status "POD vorhanden"/"Abgeschlossen" itself counts as POD evidence, so it has to move first. */
  if(/pod vorhanden|pod available|abgeschlossen|completed|erledigt/.test(low([sh.status,sh.processStatus,sh.shipmentStatus].join(' ')))){
   var next=picked?'Abgeholt':'Erstellt';
   sh.status=next;sh.processStatus=next;if(sh.shipmentStatus)sh.shipmentStatus=next;
  }
  if(/pod vorhanden/.test(low(sh.pickupStatus)))sh.pickupStatus=picked?'abgeholt':'';
 }
 sh.shipmentHistory=arr(sh.shipmentHistory);
 sh.shipmentHistory.push({id:'RC1740-POD-REMOVED-'+(qr?'QR':key)+'-'+info.at,type:'pod-removed',action:t('history'),label:t('history')+': '+info.name,reason:info.reason,at:info.at,by:info.by,actorName:info.by});
 sh.updatedAt=info.at;sh._syncUpdatedAt=info.at;
 return true;
}
function recalculate(list){
 var api=w.ExportHUBRC543;
 list.forEach(function(sh){try{if(api&&typeof api.recalculateShipmentStatus==='function')api.recalculateShipmentStatus(sh)}catch(_){}});
}
async function persist(reason){
 var clean=w.ExportHUBClean;
 if(!clean||typeof clean.queueSave!=='function'){try{if(typeof w.save==='function'){w.save(reason);return true}}catch(_){}return false}
 await Promise.resolve(clean.queueSave(reason));
 var deadline=Date.now()+60000;
 while(Date.now()<deadline){
  try{if(typeof clean.flushSave==='function'&&await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true})))return true}catch(_){}
  var r=clean.runtime;if(r&&Number(r.lastSavedGeneration||0)>=Number(r.changeGeneration||0)&&!r.saving)return true;
  await sleep(400);
 }
 return false;
}

/* Public action: remove one POD (by file key) from a shipment. Options allow tests to skip dialogs. */
async function removePod(shipmentKey,podKey,opts){
 opts=opts||{};
 var list=copies(shipmentKey),sh=primary(list);
 if(!sh){if(!opts.silent)w.alert(t('notFound'));return{ok:false,code:'SHIPMENT_NOT_FOUND'}}
 if(!canRemove(sh)){if(!opts.silent)w.alert(t('noRight'));return{ok:false,code:'NO_RIGHT'}}
 var qr=q(podKey)===QR_KEY,target=qr?(signatureEvidence(sh)?{}:null):removableFiles(sh).map(function(x){return x.file}).find(function(f){return fileKey(f)===q(podKey)});
 if(!target){if(!opts.silent)w.alert(t('notFound'));return{ok:false,code:'POD_NOT_FOUND'}}
 var name=qr?t('qrName'):fileName(target),ref=sref(sh)||sid(sh);
 if(!opts.skipConfirm&&!w.confirm(t(qr?'confirmQr':'confirm',{name:name,ref:ref})))return{ok:false,code:'CANCELLED'};
 var reason=q(opts.reason!=null?opts.reason:w.prompt(t('reason'),t('reasonDefault')));
 if(!reason){if(!opts.silent)w.alert(t('reasonRequired'));return{ok:false,code:'REASON_REQUIRED'}}
 var info={at:new Date().toISOString(),by:userName(currentUser()),reason:reason,name:name};
 list.forEach(function(x){removeFromCopy(x,q(podKey),info)});
 recalculate(list);
 refreshOverview();
 var saved=await persist('POD entfernt: '+ref);
 refreshOverview();
 if(!saved&&!opts.silent)w.alert(t('saveFailed'));
 return{ok:true,saved:saved,shipment:ref,status:q(sh.status),podStatus:q(sh.podStatus)};
}

function injectStyle(){
 if(d.getElementById(STYLE_ID)||!d.head)return;
 var st=d.createElement('style');st.id=STYLE_ID;
 st.textContent='.'+LIST_CLASS+'{display:grid;gap:6px;margin-top:8px}.'+LIST_CLASS+'>.rc1740-pod-file{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:8px;border:1px dashed var(--pc-line,rgba(120,130,150,.45));border-radius:10px}.'+LIST_CLASS+' .rc1740-pod-name{min-width:0;overflow-wrap:anywhere;font-weight:600}.'+LIST_CLASS+' .rc1740-pod-meta{display:block;font-size:12px;opacity:.75;font-weight:400;white-space:normal}.'+LIST_CLASS+' button{width:100%}';
 d.head.appendChild(st);
}
function podSection(card){return Array.prototype.slice.call(card.querySelectorAll('.rc524-link-columns > section')).find(function(sec){var h=sec.querySelector('h1,h2,h3,h4');return/^pod\b|abliefernachweis/.test(low(h&&h.textContent))})||null}
function qrRowHtml(sh,id){
 if(!signatureEvidence(sh))return'';
 var when=fileDate({uploadedAt:sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickedUpAt}),driver=q(sh.pickupDriverName||sh.driverName),meta=[when,driver].filter(Boolean).join(' · ');
 return'<div class="rc1740-pod-file rc1740-pod-qr"><span class="rc1740-pod-name" title="'+esc(t('qrName'))+'">✍ '+esc(t('qrName'))+(meta?'<small class="rc1740-pod-meta">'+esc(meta)+'</small>':'')+'</span><button type="button" class="ghost danger" data-rc1740-pod-remove="1" data-id="'+esc(id)+'" data-pod="'+QR_KEY+'">'+esc(t('remove'))+'</button></div>';
}
function listHtml(sh,id){
 return qrRowHtml(sh,id)+removableFiles(sh).map(function(x){
  var f=x.file,meta=[fileDate(f),q(f.uploadedBy)?t('uploadedBy')+' '+q(f.uploadedBy):''].filter(Boolean).join(' · ');
  return'<div class="rc1740-pod-file"><span class="rc1740-pod-name" title="'+esc(fileName(f))+'">📎 '+esc(fileName(f))+(meta?'<small class="rc1740-pod-meta">'+esc(meta)+'</small>':'')+'</span><button type="button" class="ghost danger" data-rc1740-pod-remove="1" data-id="'+esc(id)+'" data-pod="'+esc(fileKey(f))+'">'+esc(t('remove'))+'</button></div>';
 }).join('');
}
function patchCard(card){
 var id=q(card.getAttribute('data-shipment')),sh=primary(copies(id)),sec=podSection(card);
 if(!sec)return;
 /* Rows of the legacy renderer that point at a removed file must not offer "Öffnen"/"Löschen" any more. */
 sec.querySelectorAll('.rc524-file-row [data-key="podFiles"][data-index]').forEach(function(b){var f=arr(sh&&sh.podFiles)[Number(b.getAttribute('data-index'))];if(f&&inactive(f)){var row=b.closest('.rc524-file-row');if(row)row.remove()}});
 /* After a removal the section would be empty; show the renderer's normal "no POD yet" hint instead. */
 var listing=!!(sh&&canRemove(sh)&&(signatureEvidence(sh)||hasManualPod(sh)));
 var empty=sec.querySelector('.rc1740-empty'),hasContent=listing||!!sec.querySelector('.rc524-file-row,p.muted:not(.rc1740-empty)');
 /* The renderer's "no signature yet" hint is wrong once an uploaded POD is listed. */
 if(listing)sec.querySelectorAll('p.muted').forEach(function(x){if(/digitale Unterschrift|digital signature/i.test(x.textContent||''))x.remove()});
 if(!removableFiles(sh).length&&!signatureEvidence(sh)&&!sec.querySelector('.rc524-file-row'))sec.classList.remove('rc576-doc-present');
 if(!hasContent&&!empty){empty=d.createElement('p');empty.className='muted rc1740-empty';empty.textContent='Noch keine digitale Unterschrift vorhanden.';sec.appendChild(empty)}
 else if(hasContent&&empty)empty.remove();
 var box=sec.querySelector('.'+LIST_CLASS),html=sh&&canRemove(sh)?listHtml(sh,id):'',lang_=lang();
 if(!html){if(box)box.remove();return}
 var sig=lang_+'|'+html.length+'|'+(signatureEvidence(sh)?'qr,':'')+removableFiles(sh).map(function(x){return fileKey(x.file)}).join(',');
 if(box&&box.getAttribute('data-sig')===sig)return;
 if(!box){box=d.createElement('div');box.className=LIST_CLASS;sec.appendChild(box)}
 box.setAttribute('data-sig',sig);box.setAttribute('aria-label',t('title'));box.innerHTML=html;
}
function patchOverview(){
 var cards=d.querySelectorAll('#content .rc524-shipment-card[data-shipment]');
 if(!cards.length)return false;
 injectStyle();
 cards.forEach(function(card){try{patchCard(card)}catch(e){try{console.warn('[RC1740] POD-Entfernen',e)}catch(_){}}});
 return true;
}
function refreshOverview(){
 try{if(w.ExportHUBRC524&&typeof w.ExportHUBRC524.refresh==='function'&&d.querySelector('#content .rc524-shipment-card'))w.ExportHUBRC524.refresh()}catch(_){}
 schedule(60);
}
function schedule(ms){if(timer)return;timer=setT(function(){timer=0;patchOverview()},ms==null?40:ms)}

function onClick(e){
 var btn=e.target&&e.target.closest&&e.target.closest('[data-rc1740-pod-remove="1"]');
 if(!btn)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 var id=q(btn.getAttribute('data-id')),pod=q(btn.getAttribute('data-pod')),k=id+'|'+pod;
 if(busy[k])return;busy[k]=true;
 var old=btn.textContent;btn.disabled=true;btn.textContent=t('removing');
 removePod(id,pod).then(function(res){if(res&&res.ok&&res.saved)try{w.ExportHUBToast&&typeof w.ExportHUBToast.show==='function'&&w.ExportHUBToast.show(t('done'))}catch(_){}}).catch(function(err){w.alert(q(err&&err.message||err))}).finally(function(){delete busy[k];if(d.contains(btn)){btn.disabled=false;btn.textContent=old}schedule(40)});
}
/* "POD als PDF"/"POD öffnen" normally always load the signed QR POD from the server (RC1602). After the QR POD
   was removed, or when a shipment only has an uploaded POD, they open the uploaded POD instead. */
var OFFICIAL='[data-rc628-official-pod-open="1"],[data-rc628-official-pod-download="1"],[data-index352-action="download-pod"]';
function newestManual(sh){return removableFiles(sh).map(function(x){return x.file}).sort(function(a,b){return q(b.uploadedAt).localeCompare(q(a.uploadedAt))})[0]||null}
function openManual(f,mode){
 var name=fileName(f),helper=w.ExportHUBDocumentBlob1059;
 if(helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(f)){
  if(mode==='open'&&typeof helper.open==='function'){helper.open(f,{name:name}).catch(function(e){w.alert(q(e&&e.message||e))});return}
  if(typeof helper.fetchBlob==='function'){helper.fetchBlob(f).then(function(blob){var u=URL.createObjectURL(blob),a=d.createElement('a');a.href=u;a.download=name;d.body.appendChild(a);a.click();a.remove();setT(function(){try{URL.revokeObjectURL(u)}catch(_){}},120000)}).catch(function(e){w.alert(q(e&&e.message||e))});return}
 }
 var url=q(f.data||f.dataUrl||f.url||f.downloadUrl||f.href||f.contentUrl);if(!url){w.alert(t('noPod'));return}
 var a=d.createElement('a');a.href=url;a.rel='noopener noreferrer';if(mode==='open')a.target='_blank';else a.download=name;d.body.appendChild(a);a.click();a.remove();
}
function onOfficialPod(e){
 var btn=e.target&&e.target.closest&&e.target.closest(OFFICIAL);if(!btn||btn.disabled)return;
 var card=btn.closest&&btn.closest('[data-shipment]'),key=q(btn.getAttribute('data-id')||(card&&card.getAttribute('data-shipment')));
 var sh=key?primary(copies(key)):null;if(!sh){var s=state();sh=s.shipment&&(sid(s.shipment)||sref(s.shipment))?primary(copies(sid(s.shipment)||sref(s.shipment))):null}
 if(!sh)return;
 var removed=qrRemoved(sh),manual=newestManual(sh);
 if(!removed&&(signatureEvidence(sh)||!manual))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 if(!manual){w.alert(t('noPod'));return}
 openManual(manual,btn.matches('[data-rc628-official-pod-open="1"]')?'open':'download');
}
function start(){
 if(started)return;started=true;
 d.addEventListener('click',onClick,true);
 w.addEventListener('click',onOfficialPod,true);
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:languagechange'].forEach(function(n){w.addEventListener(n,function(){schedule(60)})});
 try{
  var host=d.getElementById('content')||d.body;
  if(host&&typeof MutationObserver==='function'){
   observer=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var tg=ms[i].target;if(tg&&tg.closest&&tg.closest('.'+LIST_CLASS))continue;schedule(80);return}});
   observer.observe(host,{childList:true,subtree:true});
  }
 }catch(_){}
 schedule(80);
}
w.ExportHUBPodRemove1740=Object.freeze({version:VERSION,QR_KEY:QR_KEY,removePod:removePod,removableFiles:removableFiles,canRemove:canRemove,qrRemoved:qrRemoved,hasManualPod:hasManualPod,signatureEvidence:signatureEvidence,patchOverview:patchOverview,_removeFromCopy:removeFromCopy});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
