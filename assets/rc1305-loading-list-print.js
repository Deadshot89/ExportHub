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
 var files=existingFiles(body);if(!files.length)files=deliveryFiles(sh);
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

function printRef(sh){var ref=q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase();return /^[A-Z0-9]{6}$/.test(ref)?ref:''}
function rc1315GfMul(x,y){var z=0;while(y){if(y&1)z^=x;y>>>=1;x<<=1;if(x&0x100)x^=0x11D}return z}
function rc1315QrSvg(text){
 var chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:',raw=q(text).toUpperCase();if(!raw||raw.length>25)return'';for(var z=0;z<raw.length;z++)if(chars.indexOf(raw.charAt(z))<0)return'';
 var bits=[];function add(v,n){for(var i=n-1;i>=0;i--)bits.push((v>>>i)&1)}
 add(2,4);add(raw.length,9);
 for(var i=0;i+1<raw.length;i+=2)add(chars.indexOf(raw.charAt(i))*45+chars.indexOf(raw.charAt(i+1)),11);
 if(raw.length%2)add(chars.indexOf(raw.charAt(raw.length-1)),6);
 var cap=152,term=Math.min(4,cap-bits.length);while(term-->0)bits.push(0);while(bits.length%8)bits.push(0);
 var pads=[0xEC,0x11],pi=0;while(bits.length<cap)add(pads[pi++%2],8);
 var data=[];for(i=0;i<bits.length;i+=8){var b=0;for(var j=0;j<8;j++)b=(b<<1)|bits[i+j];data.push(b)}
 var gen=[1],root=1;for(i=0;i<7;i++){var next=new Array(gen.length+1).fill(0);for(j=0;j<gen.length;j++){next[j]^=gen[j];next[j+1]^=rc1315GfMul(gen[j],root)}gen=next;root=rc1315GfMul(root,2)}
 var rem=new Array(7).fill(0);data.forEach(function(byte){var factor=byte^rem[0];rem.shift();rem.push(0);for(var k=0;k<7;k++)rem[k]^=rc1315GfMul(gen[k+1],factor)});
 var code=data.concat(rem),size=21,mods=Array.from({length:size},function(){return new Array(size).fill(false)}),fn=Array.from({length:size},function(){return new Array(size).fill(false)});
 function setf(x,y,dark){if(x<0||x>=size||y<0||y>=size)return;mods[y][x]=!!dark;fn[y][x]=true}
 for(i=0;i<size;i++){setf(6,i,i%2===0);setf(i,6,i%2===0)}
 function finder(cx,cy){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size){var dist=Math.max(Math.abs(dx),Math.abs(dy));setf(x,y,dist!==2&&dist!==4)}}}
 finder(3,3);finder(size-4,3);finder(3,size-4);setf(8,size-8,true);
 function fmt(mask){var val=(1<<3)|mask,r=val;for(var n=0;n<10;n++)r=(r<<1)^(((r>>>9)&1)*0x537);var fb=((val<<10)|r)^0x5412;function bit(pos){return((fb>>>pos)&1)!==0}for(var a=0;a<6;a++)setf(8,a,bit(a));setf(8,7,bit(6));setf(8,8,bit(7));setf(7,8,bit(8));for(a=9;a<15;a++)setf(14-a,8,bit(a));for(a=0;a<8;a++)setf(size-1-a,8,bit(a));for(a=8;a<15;a++)setf(8,size-15+a,bit(a));setf(8,size-8,true)}
 fmt(0);
 var idx=0;for(var right=size-1;right>=1;right-=2){if(right===6)right=5;for(var vert=0;vert<size;vert++){var up=((right+1)&2)===0,y=up?size-1-vert:vert;for(j=0;j<2;j++){var x=right-j;if(!fn[y][x]&&idx<code.length*8){mods[y][x]=((code[idx>>>3]>>>(7-(idx&7)))&1)!==0;idx++}}}}
 for(var yy=0;yy<size;yy++)for(var xx=0;xx<size;xx++)if(!fn[yy][xx]&&((xx+yy)%2===0))mods[yy][xx]=!mods[yy][xx];fmt(0);
 var path='',quiet=4;for(yy=0;yy<size;yy++)for(xx=0;xx<size;xx++)if(mods[yy][xx])path+='M'+(xx+quiet)+' '+(yy+quiet)+'h1v1h-1z';
 return '<svg class="rc1315-qr-svg" viewBox="0 0 '+(size+quiet*2)+' '+(size+quiet*2)+'" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true"><rect width="100%" height="100%" fill="#fff"/><path d="'+path+'" fill="#000"/></svg>'
}
function addQuickPrintQr(root,sh,withQr){
 if(!withQr||!root||root.querySelector('[data-rc1315-print-qr]'))return false;var ref=printRef(sh);if(!ref)return false;
 var payload='EHPRINT:'+ref,section=d.createElement('section');section.className='rc1315-print-qr';section.setAttribute('data-rc1315-print-qr','1');section.setAttribute('data-rc1315-payload',payload);
 section.innerHTML='<div class="rc1315-print-qr-code">'+rc1315QrSvg(payload)+'</div><div class="rc1315-print-qr-copy"><strong>Druck-QR</strong><span>REF '+esc(ref)+'</span><small>In „Ladeliste“ scannen → Gesamtdruck</small></div>';
 var anchor=root.querySelector('[data-rc995-print-qr="pickup"],.index351-qr-box,.rc352-qr-slot,.rc390-qr-slot,[class*="qr-box"],[class*="qr-slot"]');
 if(anchor&&anchor.parentNode){anchor.parentNode.insertBefore(section,anchor.nextSibling)}else{section.setAttribute('data-rc1315-fallback','1');root.appendChild(section)}
 root.setAttribute('data-rc1315-quick-print-qr','1');return true
}

function enhance(html,sh,withQr){
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var root=tpl.content.querySelector('.rc390-load,.rc352-load,.rc390-page,.rc352-page')||tpl.content.firstElementChild;if(!root)return html;
  root.setAttribute('data-rc1305-loading-list','1');enhanceDocuments(root,sh||{});enhanceRemark(root,sh||{});pickupSummary(root,sh||{});addQuickPrintQr(root,sh||{},withQr===true);
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1305 Ladelisten-Darstellung',e)}catch(_){}return html}
}
function style(){
 if(d.getElementById('exporthub-rc1305-loading-list-style'))return;
 var st=d.createElement('style');st.id='exporthub-rc1305-loading-list-style';st.textContent=
 '.rc390-load[data-rc1305-loading-list],.rc352-load[data-rc1305-loading-list]{box-sizing:border-box!important}'+
 '[data-rc1305-documents]{min-height:0!important;height:auto!important;overflow:visible!important}'+
 '.rc1305-document-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:1.4mm!important;align-items:stretch!important;min-width:0!important}'+
 '.rc1305-document-item,.rc1305-document-empty{display:flex!important;align-items:center!important;min-width:0!important;padding:1.2mm 1.6mm!important;border:.35mm solid #cbd5e1!important;border-radius:1.6mm!important;background:#f8fafc!important;color:#0f2942!important;font-size:8.4pt!important;line-height:1.15!important;font-weight:700!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important}'+
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
 '.rc1315-print-qr{box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:2.4mm!important;width:58mm!important;max-width:58mm!important;min-height:29mm!important;padding:1.5mm 2mm!important;border:.45mm solid #0f2942!important;border-radius:2.2mm!important;background:#fff!important;color:#0f2942!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
 '.rc1315-print-qr-code{flex:0 0 25mm!important;width:25mm!important;height:25mm!important}.rc1315-qr-svg{display:block!important;width:25mm!important;height:25mm!important}'+
 '.rc1315-print-qr-copy{display:flex!important;min-width:0!important;flex-direction:column!important;gap:.6mm!important}.rc1315-print-qr-copy strong{font-size:9pt!important;text-transform:uppercase!important}.rc1315-print-qr-copy span{font-size:8.5pt!important;font-weight:800!important}.rc1315-print-qr-copy small{font-size:6.8pt!important;line-height:1.2!important;font-weight:700!important;color:#475569!important}'+
 '[data-rc1315-fallback="1"]{margin:2mm 0 0 auto!important}'+
 '@media print{.rc1305-document-grid,.rc1305-pickup-summary,.rc1305-pickup-grid,.rc1305-pickup-item,.rc1315-print-qr{break-inside:avoid!important;page-break-inside:avoid!important}}';
 (d.head||d.documentElement).appendChild(st)
}
style();
w.ExportHUBRC1305LoadingListPrint=Object.freeze({version:'RC1315',enhance:enhance,isPicked:isPicked,deliveryFiles:deliveryFiles,printRef:printRef,qrSvg:rc1315QrSvg,addQuickPrintQr:addQuickPrintQr,style:style});
})(window,document);
