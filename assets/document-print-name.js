(function(w,d){
'use strict';
if(!w)return;
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function low(v){return q(v).toLocaleLowerCase()}
function printName(value){
 var name=q(value);
 return /^(?:DNC|SIDE)[0-9]{6,20}\.pdf$/i.test(name)?name.replace(/\.pdf$/i,''):name
}
function canonicalDeliveryKey(value){
 var name=q(value).replace(/[?#].*$/,'').replace(/^.*[\\/]/,'').trim();
 return printName(name).toLocaleLowerCase()
}
function documentColumnCount(count){return Math.max(0,Number(count)||0)>=6?2:1}
function documentGridCss(){return '[data-rc1504-document-columns]{display:flex!important;flex-direction:column!important;align-items:flex-start!important}'+
 '@media print{[data-rc1504-document-columns="1"]{display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:start!important}'+
 '[data-rc1504-document-columns="2"]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:start!important}'+
 '[data-rc1504-document-columns] [data-rc1293-packing-slip]{justify-self:start!important;max-width:100%!important}}'}
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
function state(){
 try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var live=w.__EXPORTHUB_GET_STATE__();if(live&&typeof live==='object')return live}}catch(_){}
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state)return w.ExportHUBClean.runtime.state}catch(_){}
 return{}
}
function isDhlFreight(value){var n=low(value).replace(/[^a-z0-9]/g,'');return n==='dhlfreight'||n==='dhlfreightgmbh'||n==='customerdhlfreight'||n==='carrierdhlfreight'||n==='speditiondhlfreight'}
function shipmentCustomer(sh){
 sh=sh||{};var s=state(),customers=arr(s.customers),id=low(sh.customerId),account=low(sh.customerAccount||sh.customerNumber),name=low(sh.customerName||sh.customerDisplay||sh.customerSearch);
 var found=customers.find(function(c){return !!((id&&low(c&&(c.id||c.customerId))===id)||(account&&low(c&&(c.account||c.customerNumber||c.kundennummer))===account)||(name&&low(c&&(c.name||c.customerName))===name))});
 return found||(sh.customer&&typeof sh.customer==='object'?sh.customer:{})
}
function palletPartyForShipment(sh){
 sh=sh||{};var c=shipmentCustomer(sh),own=q(c.name||c.customerName||c.account||c.customerNumber||sh.customerName),carrier=q(c.carrier||c.spedition||c.carrierName||sh.carrier||sh.spedition||sh.carrierName||sh.speditionName);
 if(isDhlFreight(own))carrier='DHL Freight';
 if(carrier)return{type:'carrier',key:'carrier:'+low(carrier),name:carrier};
 var id=q(c.id||c.customerId||c.account||c.customerNumber||c.kundennummer||sh.customerId||sh.customerAccount||sh.customerNumber),name=q(c.name||c.customerName||sh.customerName||sh.customerDisplay||sh.customerSearch);
 return{type:'customer',key:'customer:'+low(id||name),name:name||id||'Kunde'}
}
function palletBalanceForShipment(sh){
 var ledger=w.ExportHUBPalletLedger,party=palletPartyForShipment(sh);if(!ledger||!party.key)return null;
 var account=null;
 try{if(typeof ledger.balanceFor==='function')account=ledger.balanceFor(party.key)||null}catch(_){}
 if(!account){try{if(typeof ledger.accounts==='function'){var list=arr(ledger.accounts());account=list.find(function(x){return low(x&&x.key)===low(party.key)})||list.find(function(x){return low(x&&x.name)===low(party.name)&&(!x.type||low(x.type)===low(party.type))})||null}}catch(_){}}
 if(!account||!Number.isFinite(Number(account.balance)))return null;
 return Object.assign({},account,{key:q(account.key)||party.key,type:q(account.type)||party.type,name:q(account.name)||party.name,balance:Math.round(Number(account.balance))})
}
function palletBalanceText(account){
 if(!account||!Number.isFinite(Number(account.balance)))return'Kontostand nicht erfasst / Balance not recorded';
 var balance=Math.round(Number(account.balance)),amount=Math.abs(balance),name=q(account.name)||'Kunde / customer';
 if(balance>0)return'Zu Gunsten Essentra: '+amount+' Europaletten / In favour of Essentra: '+amount+' EUR pallets';
 if(balance<0)return'Zu Gunsten '+name+': '+amount+' Europaletten / In favour of '+name+': '+amount+' EUR pallets';
 return'Ausgeglichen: 0 Europaletten / Balanced: 0 EUR pallets'
}
function palletBalanceCacheKey(sh){var account=palletBalanceForShipment(sh);return account?q(account.key)+'|'+String(account.balance)+'|'+q(account.name):'pallet-balance-not-recorded'}
function notRecorded(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var t=w.ExportHUBI18n.t('loadingListPrint.notRecorded');if(t&&t!=='loadingListPrint.notRecorded')return t}}catch(_){}return'Nicht erfasst'}
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
function putPalletBalance(card,account){
 if(!card)return false;
 var label=findLabel(card,/europaletten.*ausgang|euro\s*pallet/i);if(label)label.textContent='Europaletten-Kontostand / EUR pallet balance';
 Array.from(card.querySelectorAll('strong')).forEach(function(node){if(/(?:ausgang|outgoing).*?(?:europalette|eur\s*pallet)/i.test(q(node.textContent)))node.remove()});
 card.setAttribute('data-rc1543-pallet-balance','1');card.classList.add('rc1543-pallet-balance');
 return putValue(card,palletBalanceText(account),'rc1305-meta-pallet')
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
function normalizeDeliveryGrid(html){
 if(!d||!d.createElement||typeof html!=='string')return html;
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var scope=tpl.content&&tpl.content.querySelectorAll?tpl.content:null;if(!scope)return html;
  var grids=Array.from(scope.querySelectorAll('[data-rc1305-document-grid],.rc1305-document-grid'));if(!grids.length)return html;
  var style=scope.querySelector&&scope.querySelector('[data-rc1504-document-print-style]');
  if(!style){style=d.createElement('style');style.setAttribute('data-rc1504-document-print-style','1');style.textContent=documentGridCss();var parent=grids[0].parentNode;if(parent&&parent.insertBefore)parent.insertBefore(style,grids[0])}
  grids.forEach(function(grid){
   var items=Array.from(grid.querySelectorAll('[data-rc1293-packing-slip],.rc1305-document-item')),seen={},kept=0;
   items.forEach(function(item){
    if(item.classList&&item.classList.contains('rc1305-document-empty')){kept++;return}
    var shown=printName(q(item.textContent)),key=canonicalDeliveryKey(shown);
    if(key&&seen[key]){item.remove();return}
    if(key)seen[key]=1;
    if(shown!==q(item.textContent))item.textContent=shown;
    kept++
   });
   var columns=documentColumnCount(kept);
   if(grid.style&&grid.style.removeProperty){grid.style.removeProperty('display');grid.style.removeProperty('flex-direction');grid.style.removeProperty('align-items')}
   grid.setAttribute('data-rc1504-document-columns',String(columns))
  });
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1504 Ladelisten-Dokumentraster',e)}catch(_){}return html}
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
  var palletCard=findCard(root,/europaletten.*ausgang|euro\s*pallet|palettenkonto/i),palletAccount=palletBalanceForShipment(sh||{});
  putSignature(findCard(root,/unterschrift.*fahrer|fahrer.*unterschrift|driver.*signature|signature/i),signature,signatureStored);
  putValue(findCard(root,/^fahrername$|^fahrer$|driver\s*name/i),driver,'rc1305-meta-driver');
  putValue(findCard(root,/datum\s*\/\s*uhrzeit|date\s*\/\s*time/i),formatDate(confirmed),'rc1503-pickup-date');
  putValue(findCard(root,/kennzeichen|license\s*plate|vehicle\s*registration/i),plate,'rc1305-meta-plate');
  putValue(findCard(root,/^verlader$|^loader$/i),loader,'rc1305-meta-loader');
  putPalletBalance(palletCard,palletAccount);
  root.setAttribute('data-rc1503-image4-pickup-layout','1');
  root.setAttribute('data-rc1543-pallet-balance','1');
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1543 Ladelisten-Palettenkontostand',e)}catch(_){}return html}
}
function install(){
 var base=w.ExportHUBRC1305LoadingListPrint;
 if(!base||typeof base.enhance!=='function'||base.__dncSidePrintNames===true)return !!base;
 var wrapped={};Object.keys(base).forEach(function(key){wrapped[key]=base[key]});
 wrapped.__dncSidePrintNames=true;wrapped.__image4PickupFields=true;wrapped.__documentGridRC1504=true;wrapped.__palletBalanceRC1543=true;wrapped.version='RC1504';
 wrapped.deliveryFiles=function(sh){return typeof base.deliveryFiles==='function'?base.deliveryFiles(printShipment(sh)):[]};
 wrapped.enhance=function(html,sh,withQr){var safe=printShipment(sh);return restorePickupFields(normalizeDeliveryGrid(base.enhance(html,safe,withQr)),safe)};
 wrapped.enhanceCover=function(html,sh){return typeof base.enhanceCover==='function'?base.enhanceCover(html,printShipment(sh)):html};
 w.ExportHUBRC1305LoadingListPrint=Object.freeze(wrapped);
 return true
}
w.ExportHUBDocumentPrintNames=Object.freeze({printName:printName,canonicalDeliveryKey:canonicalDeliveryKey,documentColumnCount:documentColumnCount,printShipment:printShipment,normalizeDeliveryGrid:normalizeDeliveryGrid,restorePickupFields:restorePickupFields,palletPartyForShipment:palletPartyForShipment,palletBalanceForShipment:palletBalanceForShipment,palletBalanceText:palletBalanceText,palletBalanceCacheKey:palletBalanceCacheKey,install:install});
if(!install()){
 if(d&&d.readyState==='loading'&&typeof d.addEventListener==='function')d.addEventListener('DOMContentLoaded',install,{once:true});
 if(typeof w.setTimeout==='function')w.setTimeout(install,0)
}
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
