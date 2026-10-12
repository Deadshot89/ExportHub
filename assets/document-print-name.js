(function(w,d){
'use strict';
if(!w)return;
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function printName(value){
 var name=q(value);
 return /^(?:DNC|SIDE)[0-9]{6,20}\.pdf$/i.test(name)?name.replace(/\.pdf$/i,''):name
}
function cloneFile(value){
 if(typeof value==='string')return printName(value);
 if(!value||typeof value!=='object')return value;
 var out=Object.assign({},value);
 for(var i=0;i<['name','fileName','filename','originalName','title'].length;i++){
  var key=['name','fileName','filename','originalName','title'][i];
  if(typeof out[key]==='string'&&out[key].trim()){
   out[key]=printName(out[key]);
   break;
  }
 }
 if(Array.isArray(value.files))out.files=value.files.map(cloneFile);
 return out
}
function printShipment(sh){
 if(!sh||typeof sh!=='object')return sh||{};
 var out=Object.assign({},sh),fields=['deliveryFiles','deliveryNotesFiles','deliveryNoteFiles','deliveryNotes','lieferscheine','documents'];
 fields.forEach(function(field){if(Array.isArray(sh[field]))out[field]=sh[field].map(cloneFile)});
 return out
}
function lastPickup(sh){var h=arr(sh&&sh.pickupHistory);return h.length?h[h.length-1]||{}:{}}
function value(sh,last,keys){for(var i=0;i<keys.length;i++){var k=keys[i],v=last&&last[k];if(v!=null&&q(v))return q(v);v=sh&&sh[k];if(v!=null&&q(v))return q(v)}return''}
function locale(){var lang=q(d&&d.documentElement&&d.documentElement.lang);try{if(!lang&&w.navigator)lang=q(w.navigator.language)}catch(_){}return lang||undefined}
function formatDate(v){var raw=q(v);if(!raw)return'Nicht erfasst';try{var dt=new Date(raw);if(!isNaN(dt.getTime()))return dt.toLocaleString(locale(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){}return raw}
function safeSignatureSource(v){v=q(v);return /^data:image\//i.test(v)||/^\/api\/pickup-pod\?/i.test(v)?v:''}
function findLabel(root,re){return Array.from(root.querySelectorAll('.rc390-label,.rc352-label,[class*="label"],strong,b')).find(function(el){var t=q(el.textContent);return t&&re.test(t)})||null}
function cardFor(el,root){if(!el)return null;var n=el;for(var i=0;i<6&&n&&n!==root;i++,n=n.parentElement){if(n.nodeType===1&&/(?:card|field|sign|box|cell|pickup)/i.test(q(n.className)))return n}return el.parentElement&&el.parentElement!==root?el.parentElement:el}
function findCard(root,re){return cardFor(findLabel(root,re),root)}
function palletOut(sh){try{if(typeof w.rc1095LoadPalletCount==='function'){var rs=typeof w.rows==='function'?w.rows(sh):[];return Math.max(0,Math.round(Number(w.rc1095LoadPalletCount(sh,rs))||0))}}catch(_){}return Math.max(0,Math.round(Number(sh&&(sh.palletOut||sh.euroPallets||sh.euroPalletCount))||0))}
function notRecorded(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var t=w.ExportHUBI18n.t('loadingListPrint.notRecorded');if(t&&t!=='loadingListPrint.notRecorded')return t}}catch(_){}return'Nicht erfasst'}
function palletMovement(out,returned){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var t=w.ExportHUBI18n.t('loadingListPrint.palletMovement',{out:out,returned:returned});if(t&&t!=='loadingListPrint.palletMovement')return t}}catch(_){}return'Ausgang: '+out+' · Eingang/Rückgabe: '+returned}
function ensureImage4Style(){
 if(!d||!d.createElement||!d.getElementById||d.getElementById('exporthub-rc1503-loading-list-fields'))return;
 var st=d.createElement('style');st.id='exporthub-rc1503-loading-list-fields';st.textContent=
  '[data-rc1503-pickup-field]{display:block!important}'+
  '.rc1503-pickup-value{box-sizing:border-box!important;display:block!important;width:100%!important;min-width:0!important;margin:1.1mm 0 .4mm!important;color:#0f2942!important;font-size:8.1pt!important;line-height:1.1!important;font-weight:800!important;overflow-wrap:anywhere!important;word-break:break-word!important}'+
  '.rc1503-signature-value{display:flex!important;align-items:center!important;justify-content:flex-start!important;min-height:12mm!important;max-height:22mm!important;margin-top:.6mm!important;overflow:hidden!important}'+
  '.rc1503-signature-value .rc1305-signature-image{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:20mm!important;object-fit:contain!important;object-position:left center!important}'+
  '@media print{[data-rc1503-pickup-field],.rc1503-pickup-value,.rc1503-signature-value{break-inside:avoid!important;page-break-inside:avoid!important}}';
 (d.head||d.documentElement).appendChild(st)
}
function putValue(card,text,className){
 if(!card)return false;
 card.style.removeProperty('display');card.removeAttribute('data-rc1305-replaced-pickup-field');card.setAttribute('data-rc1503-pickup-field','1');
 if(className)card.classList.add(className);
 Array.from(card.querySelectorAll('[data-rc1503-pickup-value]')).forEach(function(node){node.remove()});
 var node=d.createElement('div');node.className='rc1503-pickup-value';node.setAttribute('data-rc1503-pickup-value','1');node.textContent=q(text)||notRecorded();card.appendChild(node);return true
}
function putSignature(card,source,stored){
 if(!card)return false;
 card.style.removeProperty('display');card.removeAttribute('data-rc1305-replaced-pickup-field');card.setAttribute('data-rc1503-pickup-field','1');card.classList.add('rc1305-signature-primary');
 Array.from(card.querySelectorAll('[data-rc1503-pickup-value]')).forEach(function(node){node.remove()});
 var node=d.createElement('div');node.className='rc1503-pickup-value rc1503-signature-value rc1305-pickup-signature';node.setAttribute('data-rc1503-pickup-value','1');
 if(source){var img=d.createElement('img');img.className='rc1305-signature-image';img.alt='Fahrerunterschrift';img.src=source;node.appendChild(img)}
 else node.textContent=stored?'Digital gespeichert':notRecorded();
 card.appendChild(node);return true
}
function restorePickupFields(html,sh){
 if(!d||!d.createElement||typeof html!=='string')return html;
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var root=tpl.content&&tpl.content.querySelector?tpl.content.querySelector('.rc390-load,.rc352-load,.rc390-page,.rc352-page'):null;if(!root)return html;
  var summary=root.querySelector('[data-rc1305-pickup-summary]');if(!summary)return html;
  ensureImage4Style();
  summary.innerHTML='';summary.setAttribute('aria-hidden','true');summary.setAttribute('data-rc1503-legacy-summary-hidden','1');summary.style.setProperty('display','none','important');
  Array.from(root.querySelectorAll('[data-rc1305-replaced-pickup-field]')).forEach(function(card){card.style.removeProperty('display');card.removeAttribute('data-rc1305-replaced-pickup-field')});
  var last=lastPickup(sh||{}),missing=notRecorded();
  var driver=value(sh,last,['driverName','pickupDriverName','fahrerName'])||missing;
  var plate=value(sh,last,['licensePlate','pickupLicensePlate','vehicleRegistration','vehiclePlate','kennzeichen'])||missing;
  var loader=value(sh,last,['loaderName','pickupLoaderName','loadedBy','warehouseLoader','loader','verlader'])||missing;
  var confirmed=value(sh,last,['confirmedAt','pickupConfirmedAt','pickedUpAt','actualPickupAt']);
  var signature=safeSignatureSource(value(sh,last,['driverSignature','signature','signatureData','driverSignatureUrl','pickupDriverSignatureUrl']));
  var signatureStored=!!(signature||value(sh,last,['signatureBlobName','signatureStoredAt'])||last&&last.signatureStored===true||sh&&sh.signatureAvailable===true);
  var out=palletOut(sh||{}),returned=Math.max(0,Math.round(Number(last&&last.returnedEuroPallets||sh&&sh.returnedEuroPallets||sh&&sh.palletIn)||0));
  putSignature(findCard(root,/unterschrift.*fahrer|fahrer.*unterschrift|driver.*signature|signature/i),signature,signatureStored);
  putValue(findCard(root,/^fahrername$|^fahrer$|driver\s*name/i),driver,'rc1305-meta-driver');
  putValue(findCard(root,/datum\s*\/\s*uhrzeit|date\s*\/\s*time/i),formatDate(confirmed),'rc1503-pickup-date');
  putValue(findCard(root,/kennzeichen|license\s*plate|vehicle\s*registration/i),plate,'rc1305-meta-plate');
  putValue(findCard(root,/^verlader$|^loader$/i),loader,'rc1305-meta-loader');
  putValue(findCard(root,/europaletten.*ausgang|euro\s*pallet/i),palletMovement(out,returned),'rc1305-meta-pallet');
  root.setAttribute('data-rc1503-image4-pickup-layout','1');
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1503 Ladelisten-Felder',e)}catch(_){}return html}
}
function install(){
 var base=w.ExportHUBRC1305LoadingListPrint;
 if(!base||typeof base.enhance!=='function'||base.__dncSidePrintNames===true)return !!base;
 var wrapped={};Object.keys(base).forEach(function(key){wrapped[key]=base[key]});
 wrapped.__dncSidePrintNames=true;wrapped.__image4PickupFields=true;wrapped.version='RC1503';
 wrapped.deliveryFiles=function(sh){return typeof base.deliveryFiles==='function'?base.deliveryFiles(printShipment(sh)):[]};
 wrapped.enhance=function(html,sh,withQr){var safe=printShipment(sh);return restorePickupFields(base.enhance(html,safe,withQr),safe)};
 wrapped.enhanceCover=function(html,sh){return typeof base.enhanceCover==='function'?base.enhanceCover(html,printShipment(sh)):html};
 w.ExportHUBRC1305LoadingListPrint=Object.freeze(wrapped);
 return true
}
w.ExportHUBDocumentPrintNames=Object.freeze({printName:printName,printShipment:printShipment,restorePickupFields:restorePickupFields,install:install});
if(!install()){
 if(d&&d.readyState==='loading'&&typeof d.addEventListener==='function')d.addEventListener('DOMContentLoaded',install,{once:true});
 if(typeof w.setTimeout==='function')w.setTimeout(install,0)
}
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
