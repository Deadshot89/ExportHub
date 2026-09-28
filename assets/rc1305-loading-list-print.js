(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1305_LOADING_LIST_PRINT__)return;
w.__EXPORTHUB_RC1305_LOADING_LIST_PRINT__=true;
function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var out=w.ExportHUBI18n.t(key,vars);if(out&&out!==key)return out}}catch(_){}return key}
function locale(){var lang=q(d.documentElement&&d.documentElement.lang);try{if(!lang&&w.navigator)lang=q(w.navigator.language)}catch(_){}return lang||undefined}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fileName(v){if(!v)return'';if(typeof v==='string')return q(v);return q(v.name||v.fileName||v.filename||v.originalName||v.title||v.file&&v.file.name)}
function lastPickup(sh){var h=arr(sh&&sh.pickupHistory);return h.length?h[h.length-1]||{}:{}}
function value(sh,last,keys){for(var i=0;i<keys.length;i++){var k=keys[i],v=last&&last[k];if(v!=null&&q(v))return q(v);v=sh&&sh[k];if(v!=null&&q(v))return q(v)}return''}
function formatDate(v){var raw=q(v);if(!raw)return tr('loadingListPrint.notRecorded');try{var dt=new Date(raw);if(!isNaN(dt.getTime()))return dt.toLocaleString(locale(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){}return raw}
function isPicked(sh,last){var status=q(sh&&(sh.processStatus||sh.status||sh.pickupStatus)).toLowerCase();return !!(sh&&(sh.pickupComplete===true||sh.pickedUp===true||sh.pickupConfirmed===true)||last&&last.complete===true||last&&last.confirmedAt&&Number(last.remainingAfter)===0||/abgeholt|pod vorhanden|abgeschlossen|confirmed|completed/.test(status))}
function findLabel(root,re){return Array.from(root.querySelectorAll('.rc390-label,.rc352-label,[class*="label"],strong,b')).find(function(el){var t=q(el.textContent);return t&&re.test(t)})||null}
function cardFor(el,root){if(!el)return null;var n=el;for(var i=0;i<6&&n&&n!==root;i++,n=n.parentElement){if(n.nodeType===1&&/(?:card|field|sign|box|cell|pickup)/i.test(q(n.className)))return n}return el.parentElement&&el.parentElement!==root?el.parentElement:el}
function findCard(root,re){return cardFor(findLabel(root,re),root)}
function innermost(root,re){var all=Array.from(root.querySelectorAll('div,span'));return all.find(function(el){var t=q(el.textContent);if(!t||!re.test(t))return false;return !Array.from(el.children||[]).some(function(ch){return re.test(q(ch.textContent))})})||null}
function existingFiles(body){var raw=q(body&&body.textContent),hits=raw.match(/[A-Za-z0-9][A-Za-z0-9_.() -]*?\.pdf/gi)||[],out=[],seen={};hits.forEach(function(name){name=q(name);var key=name.toLowerCase();if(!key||seen[key])return;seen[key]=1;out.push(name)});return out}
function deliveryFiles(sh){var fields=['deliveryFiles','deliveryNotesFiles','deliveryNoteFiles','deliveryNotes','lieferscheine'],out=[],seen={};fields.forEach(function(field){arr(sh&&sh[field]).forEach(function(item){var name=fileName(item);if(name&&!seen[name.toLowerCase()]){seen[name.toLowerCase()]=1;out.push(name)}if(item&&typeof item==='object')arr(item.files).forEach(function(f){var nested=fileName(f);if(nested&&!seen[nested.toLowerCase()]){seen[nested.toLowerCase()]=1;out.push(nested)}})})});if(!out.length)arr(sh&&sh.documents).forEach(function(item){var kind=q(item&&(item.type||item.category||item.group||item.documentType)).toLowerCase();if(kind&&!/delivery|lieferschein|dnc/.test(kind))return;var name=fileName(item);if(name&&!seen[name.toLowerCase()]){seen[name.toLowerCase()]=1;out.push(name)}});return out}
function enhanceDocuments(root,sh){
 var label=findLabel(root,/lieferscheine|delivery\s*notes|\bdncs?\b/i);if(!label)return false;
 var card=cardFor(label,root);if(!card)return false;var body=card.querySelector('.rc390-txt,.rc352-txt,[class*="txt"]')||label.nextElementSibling;
 var files=deliveryFiles(sh);if(!files.length)files=existingFiles(body);
 card.setAttribute('data-rc1305-documents','1');
 var grid=d.createElement('div');grid.className='rc1305-document-grid';grid.setAttribute('data-rc1305-document-grid','1');
 if(files.length)files.forEach(function(name){var item=d.createElement('span');item.className='rc1305-document-item';item.textContent=name;grid.appendChild(item)});
 else{var empty=d.createElement('span');empty.className='rc1305-document-empty';empty.textContent=tr('loadingListPrint.noDeliveryNotes');grid.appendChild(empty)}
 if(body){body.innerHTML='';body.appendChild(grid)}else card.appendChild(grid);
 return true
}
function enhanceRemark(root,sh){
 var label=findLabel(root,/^(?:bemerkung|remark|remarks|remarque|nota|observación)$/i);if(!label)return false;
 var card=cardFor(label,root);if(!card)return false;var body=card.querySelector('.rc390-txt,.rc352-txt,[class*="txt"]')||label.nextElementSibling;
 var remark=value(sh,{},['remark','remarks','bemerkung','comment','comments','note','notes','shipmentRemark','pickupRemark']);
 card.setAttribute('data-rc1305-remark','1');if(!remark)card.setAttribute('data-rc1305-empty','1');
 if(body)body.textContent=remark||tr('loadingListPrint.noRemark');
 return true
}
function palletOut(sh){
 try{if(typeof w.rc1095LoadPalletCount==='function'){var rs=typeof w.rows==='function'?w.rows(sh):[];return Math.max(0,Math.round(Number(w.rc1095LoadPalletCount(sh,rs))||0))}}catch(_){}
 return Math.max(0,Math.round(Number(sh&&(sh.palletOut||sh.euroPallets||sh.euroPalletCount))||0))
}
function pickupSummary(root,sh){
 var last=lastPickup(sh);if(!isPicked(sh,last))return false;
 var cards=[
  findCard(root,/unterschrift.*fahrer|fahrer.*unterschrift|driver.*signature|signature/i),
  findCard(root,/^fahrername$|^fahrer$|driver\s*name/i),
  findCard(root,/datum\s*\/\s*uhrzeit|date\s*\/\s*time/i),
  findCard(root,/kennzeichen|license\s*plate|vehicle\s*registration/i),
  findCard(root,/^verlader$|^loader$/i),
  findCard(root,/europaletten.*ausgang|euro\s*pallet/i)
 ].filter(Boolean);
 var legend=innermost(root,/gr[uü]n\s*=\s*abholung|green\s*=\s*pickup/i),legendCard=cardFor(legend,root);if(legendCard)cards.unshift(legendCard);
 cards=cards.filter(function(card,index){return cards.indexOf(card)===index});
 if(!cards.length)return false;
 var driver=value(sh,last,['driverName','pickupDriverName','fahrerName'])||tr('loadingListPrint.notRecorded');
 var plate=value(sh,last,['licensePlate','pickupLicensePlate','vehicleRegistration','vehiclePlate','kennzeichen'])||tr('loadingListPrint.notRecorded');
 var loader=value(sh,last,['loaderName','pickupLoaderName','loadedBy','warehouseLoader','loader'])||tr('loadingListPrint.notRecorded');
 var confirmed=value(sh,last,['confirmedAt','pickupConfirmedAt','pickedUpAt','actualPickupAt']);
 var carrier=value(sh,last,['carrierName','pickupCarrierName','carrier','spedition']);
 var signature=value(sh,last,['driverSignature','signature','signatureData']);
 var signatureStored=!!(signature||value(sh,last,['signatureBlobName','signatureStoredAt']));
 var out=palletOut(sh),returned=Math.max(0,Math.round(Number(last&&last.returnedEuroPallets||sh&&sh.returnedEuroPallets||sh&&sh.palletIn)||0));
 var section=d.createElement('section');section.className='rc1305-pickup-summary';section.setAttribute('data-rc1305-pickup-summary','1');section.style.gridColumn='1 / -1';
 var driverLabel=tr('pickup.driver'),plateLabel=tr('history.field.licensePlate'),loaderLabel=tr('history.field.loader'),carrierLabel=tr('shipment.carrier'),signatureLabel=tr('loadingListPrint.driverSignature'),palletLabel=tr('pallet.euroPallet');
 var signHtml=signature&&/^data:image\//i.test(signature)?'<img class="rc1305-signature-image" alt="'+esc(signatureLabel)+'" src="'+esc(signature)+'">':esc(signatureStored?tr('loadingListPrint.signatureStored'):tr('loadingListPrint.notRecorded'));
 section.innerHTML='<div class="rc1305-pickup-banner"><span>✓ '+esc(tr('loadingListPrint.pickedUp'))+'</span><strong>'+esc(formatDate(confirmed))+'</strong></div>'+
 '<div class="rc1305-pickup-grid">'+
 '<div class="rc1305-pickup-item"><span>'+esc(driverLabel)+'</span><strong>'+esc(driver)+'</strong></div>'+
 '<div class="rc1305-pickup-item"><span>'+esc(plateLabel)+'</span><strong>'+esc(plate)+'</strong></div>'+
 '<div class="rc1305-pickup-item"><span>'+esc(loaderLabel)+'</span><strong>'+esc(loader)+'</strong></div>'+
 (carrier?'<div class="rc1305-pickup-item"><span>'+esc(carrierLabel)+'</span><strong>'+esc(carrier)+'</strong></div>':'')+
 '<div class="rc1305-pickup-item rc1305-pickup-signature"><span>'+esc(signatureLabel)+'</span><strong>'+signHtml+'</strong></div>'+
 '<div class="rc1305-pickup-item"><span>'+esc(palletLabel)+'</span><strong>'+esc(tr('loadingListPrint.palletMovement',{out:out,returned:returned}))+'</strong></div>'+
 '</div>';
 var anchor=cards[0],parent=anchor&&anchor.parentNode;if(parent)parent.insertBefore(section,anchor);else root.appendChild(section);
 cards.forEach(function(card){card.setAttribute('data-rc1305-replaced-pickup-field','1');card.style.setProperty('display','none','important')});
 return true
}
function enhance(html,sh){
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var root=tpl.content.querySelector('.rc390-load,.rc352-load,.rc390-page,.rc352-page')||tpl.content.firstElementChild;if(!root)return html;
  root.setAttribute('data-rc1305-loading-list','1');enhanceDocuments(root,sh||{});enhanceRemark(root,sh||{});pickupSummary(root,sh||{});
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1305 Ladelisten-Darstellung',e)}catch(_){}return html}
}
function style(){
 if(d.getElementById('exporthub-rc1305-loading-list-style'))return;
 var st=d.createElement('style');st.id='exporthub-rc1305-loading-list-style';st.textContent=
 '.rc390-load[data-rc1305-loading-list],.rc352-load[data-rc1305-loading-list]{box-sizing:border-box!important}'+
 '[data-rc1305-documents]{min-height:0!important;height:auto!important;overflow:visible!important}'+
 '.rc1305-document-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:1.4mm!important;align-items:stretch!important;min-width:0!important}'+
 '.rc1305-document-item,.rc1305-document-empty{display:flex!important;align-items:center!important;min-width:0!important;padding:1.5mm 2mm!important;border:.4mm solid #cbd5e1!important;border-radius:2mm!important;background:#fff!important;color:#0f2942!important;font-size:10.5pt!important;line-height:1.2!important;font-weight:750!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important}'+
 '[data-rc1305-remark]{min-height:0!important;height:auto!important;max-height:none!important;overflow:visible!important;padding-bottom:2mm!important}'+
 '[data-rc1305-remark][data-rc1305-empty="1"]{min-height:0!important}'+
 '[data-rc1305-remark][data-rc1305-empty="1"] .rc390-txt,[data-rc1305-remark][data-rc1305-empty="1"] .rc352-txt{color:#64748b!important;font-weight:600!important}'+
 '.rc1305-pickup-summary{box-sizing:border-box!important;width:100%!important;margin:2.5mm 0 0!important;border:.45mm solid #94a3b8!important;border-radius:2.6mm!important;background:#fff!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
 '.rc1305-pickup-banner{display:flex!important;justify-content:space-between!important;gap:3mm!important;align-items:center!important;padding:2.2mm 3mm!important;border-bottom:.4mm solid #86efac!important;background:#ecfdf5!important;color:#166534!important;font-size:9pt!important;font-weight:850!important}'+
 '.rc1305-pickup-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:1.6mm!important;padding:2.5mm!important}'+
 '.rc1305-pickup-item{box-sizing:border-box!important;min-width:0!important;min-height:12mm!important;padding:1.7mm 2mm!important;border:.35mm solid #cbd5e1!important;border-radius:1.7mm!important;background:#f8fafc!important}'+
 '.rc1305-pickup-item>span{display:block!important;margin-bottom:.8mm!important;color:#64748b!important;font-size:7.2pt!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.12mm!important}'+
 '.rc1305-pickup-item>strong{display:block!important;color:#0f2942!important;font-size:9pt!important;line-height:1.18!important;font-weight:800!important;overflow-wrap:anywhere!important}'+
 '.rc1305-pickup-signature{grid-column:span 2!important}.rc1305-signature-image{display:block!important;max-width:100%!important;max-height:14mm!important;object-fit:contain!important}'+
 '@media(max-width:640px){.rc1305-document-grid,.rc1305-pickup-grid{grid-template-columns:1fr!important}.rc1305-pickup-signature{grid-column:auto!important}}'+
 '@media print{.rc1305-document-grid,.rc1305-pickup-summary,.rc1305-pickup-grid,.rc1305-pickup-item{break-inside:avoid!important;page-break-inside:avoid!important}}';
 (d.head||d.documentElement).appendChild(st)
}
style();
w.ExportHUBRC1305LoadingListPrint=Object.freeze({version:'RC1305',enhance:enhance,isPicked:isPicked,deliveryFiles:deliveryFiles,style:style});
})(window,document);
