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
function safeSignatureSource(v){v=q(v);return /^data:image\//i.test(v)||/^\/api\/pickup-pod\?/i.test(v)?v:''}
function customsSignatureUrl(driverUrl){var url=safeSignatureSource(driverUrl);if(!/^\/api\/pickup-pod\?/i.test(url))return'';try{var parsed=new URL(url,w.location&&w.location.origin||'http://localhost');parsed.searchParams.delete('signature');parsed.searchParams.set('customsSignature','1');return parsed.pathname+parsed.search}catch(_){return''}}
function lastPickup(sh){var h=arr(sh&&sh.pickupHistory);return h.length?h[h.length-1]||{}:{}}
function value(sh,last,keys){for(var i=0;i<keys.length;i++){var k=keys[i],v=last&&last[k];if(v!=null&&q(v))return q(v);v=sh&&sh[k];if(v!=null&&q(v))return q(v)}return''}
function formatDate(v){var raw=q(v);if(!raw)return tr('loadingListPrint.notRecorded');try{var dt=new Date(raw);if(!isNaN(dt.getTime()))return dt.toLocaleString(locale(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){}return raw}
function isPicked(sh,last){var status=q(sh&&(sh.processStatus||sh.status||sh.pickupStatus)).toLowerCase();return !!(sh&&(sh.pickupComplete===true||sh.pickedUp===true||sh.pickupConfirmed===true)||last&&last.complete===true||last&&last.confirmedAt&&Number(last.remainingAfter)===0||/abgeholt|pod vorhanden|abgeschlossen|confirmed|completed/.test(status))}
function hasAbd(sh,last){if(last&&last.abdPresent===true||sh&&sh.abdPresent===true)return true;var lists=[sh&&sh.abdFiles,sh&&sh.abds,sh&&sh.abdDocuments];if(lists.some(function(x){return Array.isArray(x)&&x.length>0}))return true;if(q(sh&&(sh.abdFile||sh.abdRef||sh.abdReference||sh.abdMrn||sh.mrn)))return true;var docs=[].concat(arr(sh&&sh.documents),arr(sh&&sh.generatedDocuments));if(docs.some(function(item){var kind=q(item&&(item.type||item.category||item.group||item.documentType||item.kind)),name=fileName(item);return /(^|\b)abd(\b|$)|ausfuhrbegleitdokument/i.test(kind+' '+name)}))return true;var status=q(sh&&sh.abdStatus).toLowerCase();return /vorhanden|fertig|erledigt|completed|done|available|erstellt|created|abgeschlossen/.test(status)&&!/wartet|offen|pending|angefordert|requested/.test(status)}
function findLabel(root,re){return Array.from(root.querySelectorAll('.rc390-label,.rc352-label,[class*="label"],strong,b')).find(function(el){var t=q(el.textContent);return t&&re.test(t)})||null}
function cardFor(el,root){if(!el)return null;var n=el;for(var i=0;i<6&&n&&n!==root;i++,n=n.parentElement){if(n.nodeType===1&&/(?:card|field|sign|box|cell|pickup)/i.test(q(n.className)))return n}return el.parentElement&&el.parentElement!==root?el.parentElement:el}
function findCard(root,re){return cardFor(findLabel(root,re),root)}
function innermost(root,re){var all=Array.from(root.querySelectorAll('div,span'));return all.find(function(el){var t=q(el.textContent);if(!t||!re.test(t))return false;return !Array.from(el.children||[]).some(function(ch){return re.test(q(ch.textContent))})})||null}
function existingFiles(body){var raw=q(body&&body.textContent),hits=raw.match(/[A-Za-z0-9][A-Za-z0-9_.() -]*?\.pdf/gi)||[],out=[],seen={};hits.forEach(function(name){name=q(name);var key=name.toLowerCase();if(!key||seen[key])return;seen[key]=1;out.push(name)});return out}
function splitPdfNames(v){var raw=fileName(v),hits=raw.match(/[A-Za-z0-9][A-Za-z0-9_.() -]*?\.pdf/gi)||[];return hits.length?hits.map(q):(raw?[raw]:[])}
function deliveryFiles(sh){var fields=['deliveryFiles','deliveryNotesFiles','deliveryNoteFiles','deliveryNotes','lieferscheine'],out=[],seen={};function add(v){splitPdfNames(v).forEach(function(name){var key=name.toLowerCase();if(!key||seen[key])return;seen[key]=1;out.push(name)})}fields.forEach(function(field){arr(sh&&sh[field]).forEach(function(item){add(item);if(item&&typeof item==='object')arr(item.files).forEach(add)})});if(!out.length)arr(sh&&sh.documents).forEach(function(item){var kind=q(item&&(item.type||item.category||item.group||item.documentType)).toLowerCase();if(kind&&!/delivery|lieferschein|dnc/.test(kind))return;add(item)});return out}
function shrinkInlineFonts(root,deltaPt){
 if(!root||!deltaPt)return;
 Array.from(root.querySelectorAll('[style*="font-size"]')).forEach(function(el){
  var raw=q(el.style&&el.style.fontSize),m=raw.match(/^([0-9]+(?:\.[0-9]+)?)pt$/i);
  if(m){var n=Math.max(5,Number(m[1])-Number(deltaPt));el.style.setProperty('font-size',String(Math.round(n*10)/10)+'pt','important');return}
  m=raw.match(/^([0-9]+(?:\.[0-9]+)?)px$/i);
  if(m){var px=Math.max(7,Number(m[1])-Number(deltaPt)*1.3333);el.style.setProperty('font-size',String(Math.round(px*10)/10)+'px','important')}
 });
 root.setAttribute('data-rc1326-font-reduced',String(deltaPt));
}
function enhanceDocuments(root,sh){
 var label=findLabel(root,/lieferscheine|delivery\s*notes|\bdncs?\b/i);if(!label)return false;
 var card=cardFor(label,root);if(!card)return false;var body=card.querySelector('.rc390-txt,.rc352-txt,[class*="txt"]')||label.nextElementSibling;
 var files=deliveryFiles(sh);var fallback=existingFiles(body);fallback.forEach(function(name){if(!files.some(function(x){return x.toLowerCase()===name.toLowerCase()}))files.push(name)});
 card.setAttribute('data-rc1305-documents','1');
 var density=files.length>24?'ultra':(files.length>15?'dense':'normal');card.setAttribute('data-rc1363-document-density',density);
 var metrics=density==='ultra'?{gap:'.1mm',pad:'.1mm .3mm',font:'4.2pt',line:'.9',border:'.2mm'}:(density==='dense'?{gap:'.18mm',pad:'.15mm .35mm',font:'4.6pt',line:'.95',border:'.25mm'}:{gap:'.35mm',pad:'.3mm .5mm',font:'5.2pt',line:'1',border:'.3mm'});
 var grid=body||d.createElement('div');if(body)grid.removeAttribute('style');
 grid.classList.add('rc1305-document-grid','rc1293-packing-slip-grid');grid.setAttribute('data-rc1305-document-grid','1');grid.setAttribute('data-rc1293-packing-slip-grid','1');grid.setAttribute('data-rc1363-document-density',density);grid.style.cssText='display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-auto-flow:row!important;gap:'+metrics.gap+'!important;align-items:stretch!important;min-width:0!important;width:100%!important;max-width:100%!important;overflow:visible!important;box-sizing:border-box!important';grid.innerHTML='';
 function appendDoc(name,emptyState){var item=d.createElement('span');item.className=(emptyState?'rc1305-document-empty':'rc1305-document-item')+' rc1293-packing-slip';item.setAttribute('data-rc1293-packing-slip','1');item.style.cssText='display:flex!important;align-items:center!important;min-width:0!important;max-width:100%!important;padding:'+metrics.pad+'!important;border:'+metrics.border+' solid #2563eb!important;border-radius:1.2mm!important;background:#eff6ff!important;color:#0f2942!important;font-size:'+metrics.font+'!important;line-height:'+metrics.line+'!important;font-weight:650!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important;box-sizing:border-box!important';item.textContent=name;grid.appendChild(item)}
 if(files.length)files.forEach(function(name){appendDoc(name,false)});
 else appendDoc(tr('loadingListPrint.noDeliveryNotes'),true);
 if(!body)card.appendChild(grid);
 return true
}
function enhanceRecipient(root){
 var label=findLabel(root,/^(?:empf[aä]nger|recipient|consignee)$/i);if(!label)return false;
 var card=cardFor(label,root);if(!card)return false;
 card.setAttribute('data-rc1342-recipient','1');
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
function ensureCustomsSignatureField(root,sh){
 var last=lastPickup(sh);if(!hasAbd(sh,last)||isPicked(sh,last)||root.querySelector('[data-rc1327-customs-signature-field]'))return false;
 var driverCard=findCard(root,/unterschrift.*fahrer|fahrer.*unterschrift|driver.*signature|signature/i);if(!driverCard||!driverCard.parentNode)return false;
 var card=d.createElement(driverCard.tagName&&driverCard.tagName.toLowerCase()||'div');card.className=q(driverCard.className)+' rc1327-customs-signature-field';card.setAttribute('data-rc1327-customs-signature-field','1');
 card.innerHTML='<div class="rc390-label rc352-label">Zolldokumente erhalten</div><div class="rc1327-customs-signature-line"></div><div class="rc1327-customs-signature-hint">Unterschrift Fahrer / Customs documents received</div>';
 driverCard.parentNode.insertBefore(card,driverCard.nextSibling);return true
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
 var signature=safeSignatureSource(value(sh,last,['driverSignature','signature','signatureData','driverSignatureUrl','pickupDriverSignatureUrl']));
 var signatureStored=!!(signature||value(sh,last,['signatureBlobName','signatureStoredAt'])||last&&last.signatureStored===true||sh&&sh.signatureAvailable===true);
 var customsSignature=safeSignatureSource(value(sh,last,['customsDocumentsSignature','abdHandoverSignature','customsSignatureData','customsDocumentsSignatureUrl']))||customsSignatureUrl(value(sh,last,['driverSignatureUrl','pickupDriverSignatureUrl']));
 var customsSignatureStored=!!(customsSignature||value(sh,last,['customsDocumentsSignatureBlobName','customsDocumentsSignatureStoredAt'])||last&&last.customsDocumentsSignatureStored===true||sh&&sh.customsDocumentsSignatureStored===true);
 var customsRequired=hasAbd(sh,last);
 var out=palletOut(sh),returned=Math.max(0,Math.round(Number(last&&last.returnedEuroPallets||sh&&sh.returnedEuroPallets||sh&&sh.palletIn)||0));
 var section=d.createElement('section');section.className='rc1305-pickup-summary';section.setAttribute('data-rc1305-pickup-summary','1');section.setAttribute('data-rc1315-customs-required',customsRequired?'1':'0');section.style.gridColumn='1 / -1';
 var driverLabel=tr('pickup.driver'),plateLabel=tr('history.field.licensePlate'),loaderLabel=tr('history.field.loader'),carrierLabel=tr('shipment.carrier'),signatureLabel=tr('loadingListPrint.driverSignature'),customsLabel=tr('loadingListPrint.customsDocumentsReceived'),palletLabel=tr('pallet.euroPallet');
 var signHtml=signature?'<img class="rc1305-signature-image" alt="'+esc(signatureLabel)+'" src="'+esc(signature)+'">':esc(signatureStored?tr('loadingListPrint.signatureStored'):tr('loadingListPrint.notRecorded'));
 var customsSignHtml=customsSignature?'<img class="rc1305-signature-image" alt="'+esc(customsLabel)+'" src="'+esc(customsSignature)+'">':esc(customsSignatureStored?(tr('loadingListPrint.driverSignature')+' · '+tr('loadingListPrint.signatureStored')):tr('loadingListPrint.notRecorded'));
 section.innerHTML='<div class="rc1305-pickup-banner"><span>✓ '+esc(tr('loadingListPrint.pickedUp'))+'</span><strong>'+esc(formatDate(confirmed))+'</strong></div>'+
 '<div class="rc1305-pickup-grid">'+
 '<div class="rc1305-pickup-item rc1305-pickup-meta rc1305-meta-driver"><span>'+esc(driverLabel)+'</span><strong>'+esc(driver)+'</strong></div>'+
 '<div class="rc1305-pickup-item rc1305-pickup-meta"><span>'+esc(plateLabel)+'</span><strong>'+esc(plate)+'</strong></div>'+
 '<div class="rc1305-pickup-item rc1305-pickup-meta"><span>'+esc(loaderLabel)+'</span><strong>'+esc(loader)+'</strong></div>'+
 (carrier?'<div class="rc1305-pickup-item rc1305-pickup-meta"><span>'+esc(carrierLabel)+'</span><strong>'+esc(carrier)+'</strong></div>':'')+
 '<div class="rc1305-pickup-item rc1305-pickup-meta"><span>'+esc(palletLabel)+'</span><strong>'+esc(tr('loadingListPrint.palletMovement',{out:out,returned:returned}))+'</strong></div>'+
 '<div class="rc1305-pickup-item rc1305-pickup-signature rc1305-signature-primary"><span>'+esc(signatureLabel)+'</span><strong>'+signHtml+'</strong></div>'+
 (customsRequired?'<div class="rc1305-pickup-item rc1305-pickup-signature rc1305-signature-customs" data-rc1315-customs-signature="1"><span>'+esc(customsLabel)+'</span><strong>'+customsSignHtml+'</strong></div>':'')+
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
 var payload='EHPRINT:'+ref,section=d.createElement('section');section.className='rc1315-print-qr rc1361-print-qr-top-right';section.setAttribute('data-rc1315-print-qr','1');section.setAttribute('data-rc1315-payload',payload);
 section.innerHTML='<div class="rc1315-print-qr-code">'+rc1315QrSvg(payload)+'</div><div class="rc1315-print-qr-copy"><strong>Druck</strong></div>';
 function important(node,name,val){try{node.style.setProperty(name,val,'important')}catch(_){}}
 important(root,'position','relative');important(section,'box-sizing','border-box');important(section,'position','absolute');important(section,'top','8mm');important(section,'right','8mm');important(section,'left','auto');important(section,'bottom','auto');important(section,'transform','none');important(section,'display','flex');important(section,'align-items','center');important(section,'gap','1mm');important(section,'width','22mm');important(section,'max-width','22mm');important(section,'min-height','10mm');important(section,'margin','0');important(section,'padding','.5mm');important(section,'border','.35mm solid #2563eb');important(section,'border-radius','1.6mm');important(section,'background','#fff');important(section,'color','#0f2942');important(section,'z-index','4');
 var code=section.querySelector('.rc1315-print-qr-code'),svg=section.querySelector('.rc1315-qr-svg'),copy=section.querySelector('.rc1315-print-qr-copy'),strong=section.querySelector('.rc1315-print-qr-copy strong');if(copy){important(copy,'display','block');important(copy,'min-width','0');important(copy,'margin','0')}if(strong){important(strong,'font-size','5.4pt');important(strong,'line-height','1');important(strong,'font-weight','800')}if(code){important(code,'flex','0 0 8mm');important(code,'width','8mm');important(code,'min-width','8mm');important(code,'max-width','8mm');important(code,'height','8mm');important(code,'min-height','8mm');important(code,'max-height','8mm')}if(svg){important(svg,'display','block');important(svg,'width','8mm');important(svg,'max-width','8mm');important(svg,'height','8mm');important(svg,'max-height','8mm')}
 root.appendChild(section);root.setAttribute('data-rc1361-print-qr-top-right','1');root.removeAttribute('data-rc1361-print-qr-bottom');root.removeAttribute('data-rc1360-print-qr-top-right');root.removeAttribute('data-rc1359-print-qr-bottom-center');root.removeAttribute('data-rc1327-quick-print-qr-bottom');return true
}

function enhance(html,sh,withQr){
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var root=tpl.content.querySelector('.rc390-load,.rc352-load,.rc390-page,.rc352-page')||tpl.content.firstElementChild;if(!root)return html;
  root.setAttribute('data-rc1305-loading-list','1');shrinkInlineFonts(root,1);enhanceRecipient(root);enhanceDocuments(root,sh||{});enhanceRemark(root,sh||{});ensureCustomsSignatureField(root,sh||{});pickupSummary(root,sh||{});
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1305 Ladelisten-Darstellung',e)}catch(_){}return html}
}
function formatDay(v){var raw=q(v);if(!raw)return'';try{var dt=new Date(raw);if(!isNaN(dt.getTime()))return dt.toLocaleDateString(locale(),{day:'2-digit',month:'2-digit',year:'numeric'})}catch(_){}return raw}
function ensureCoverPickupDate(root,sh){
 var last=lastPickup(sh),raw=value(sh,last,['actualPickupAt','pickupConfirmedAt','confirmedAt','plannedPickupDate','pickupPlannedDate','pickupDate','collectionDate','abholdatum']);if(!raw)return false;
 var label=findLabel(root,/sendungsdaten|shipment\s*data/i),card=cardFor(label,root);if(!card||card.querySelector('[data-rc1341-pickup-date]'))return false;
 var line=d.createElement('div');line.setAttribute('data-rc1341-pickup-date','1');line.className='rc1341-cover-pickup-date';line.innerHTML='<strong>'+esc(tr('pickup.date'))+':</strong> '+esc(formatDay(raw));var body=card.querySelector('.rc390-txt,.rc352-txt,[class*="txt"]')||card;body.appendChild(line);return true
}
function enhanceCover(html,sh){
 try{
  var tpl=d.createElement('template');tpl.innerHTML=html;var root=tpl.content.querySelector('.rc390-cover,.rc352-cover,[data-rc1203-cover-enhanced]')||tpl.content.firstElementChild;if(!root)return html;
  root.setAttribute('data-rc1327-print-cover','1');shrinkInlineFonts(root,2);Array.from(root.querySelectorAll('[data-rc1315-print-qr],.rc1315-print-qr')).forEach(function(el){el.remove()});root.removeAttribute('data-rc1315-quick-print-qr');enhanceDocuments(root,sh||{});ensureCoverPickupDate(root,sh||{});addQuickPrintQr(root,sh||{},true)
  return tpl.innerHTML
 }catch(e){try{console.warn('RC1316 Deckblatt-Druck-QR',e)}catch(_){}return html}
}
function style(){
 if(d.getElementById('exporthub-rc1305-loading-list-style'))return;
 var st=d.createElement('style');st.id='exporthub-rc1305-loading-list-style';st.textContent=
 '.rc390-load[data-rc1305-loading-list],.rc352-load[data-rc1305-loading-list]{box-sizing:border-box!important}'+
 '[data-rc1342-recipient]{background:#eaf2ff!important;border-color:#93b4e8!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
 '[data-rc1342-recipient] .rc390-label,[data-rc1342-recipient] .rc352-label,[data-rc1342-recipient] [class*="label"]{color:#163b67!important}'+
 '[data-rc1305-documents]{min-height:0!important;height:auto!important;overflow:visible!important}'+
 '.rc1305-document-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-auto-flow:row!important;gap:.35mm!important;align-items:stretch!important;min-width:0!important;max-width:100%!important;overflow:visible!important}'+
 '.rc1305-document-item,.rc1305-document-empty{display:flex!important;align-items:center!important;min-width:0!important;max-width:100%!important;padding:.3mm .5mm!important;border:.3mm solid #2563eb!important;border-radius:1.2mm!important;background:#eff6ff!important;color:#0f2942!important;font-size:5.2pt!important;line-height:1!important;font-weight:650!important;overflow-wrap:anywhere!important;word-break:break-word!important;break-inside:avoid!important;page-break-inside:avoid!important}'+
 '[data-rc1305-remark]{min-height:0!important;height:auto!important;max-height:none!important;overflow:visible!important;padding-bottom:2mm!important}'+
 '[data-rc1305-remark][data-rc1305-empty="1"]{min-height:0!important}'+
 '[data-rc1305-remark][data-rc1305-empty="1"] .rc390-txt,[data-rc1305-remark][data-rc1305-empty="1"] .rc352-txt{color:#64748b!important;font-weight:600!important}'+
 '.rc1305-pickup-summary{box-sizing:border-box!important;width:100%!important;margin:2.5mm 0 0!important;border:.45mm solid #94a3b8!important;border-radius:2.6mm!important;background:#fff!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
 '.rc1305-pickup-banner{display:flex!important;justify-content:space-between!important;gap:3mm!important;align-items:center!important;padding:2.2mm 3mm!important;border-bottom:.4mm solid #86efac!important;background:#ecfdf5!important;color:#166534!important;font-size:9pt!important;font-weight:850!important}'+
 '.rc1305-pickup-grid{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;grid-auto-flow:row!important;gap:1mm!important;padding:1.6mm!important;align-items:stretch!important}'+
 '.rc1305-pickup-item{box-sizing:border-box!important;min-width:0!important;margin:0!important;padding:1.15mm 1.35mm!important;border:.35mm solid #cbd5e1!important;border-radius:1.5mm!important;background:#f8fafc!important;overflow:hidden!important}'+
 '.rc1305-pickup-meta{height:12.5mm!important;min-height:12.5mm!important}.rc1305-meta-driver{grid-column:span 2!important}'+
 '.rc1305-pickup-item>span{display:block!important;margin:0 0 .45mm!important;color:#64748b!important;font-size:6.6pt!important;line-height:1.05!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.08mm!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}'+
 '.rc1305-pickup-item>strong{display:block!important;min-width:0!important;color:#0f2942!important;font-size:8.2pt!important;line-height:1.12!important;font-weight:800!important;overflow-wrap:anywhere!important}'+
 '.rc1305-pickup-meta>strong{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;max-height:6.8mm!important;overflow:hidden!important}'+
 '.rc1305-pickup-signature{grid-column:span 3!important;height:18mm!important;min-height:18mm!important;padding:1mm 1.35mm!important;overflow:hidden!important}.rc1305-pickup-summary[data-rc1315-customs-required="0"] .rc1305-signature-primary{grid-column:1 / -1!important}'+
 '.rc1305-pickup-signature>strong{display:flex!important;align-items:center!important;justify-content:flex-start!important;height:11.2mm!important;max-height:11.2mm!important;overflow:hidden!important}'+
 '.rc1305-signature-image{display:block!important;width:auto!important;max-width:100%!important;height:auto!important;max-height:10.5mm!important;object-fit:contain!important;object-position:left center!important}'+
 '.rc1327-customs-signature-field{box-sizing:border-box!important;min-width:0!important;break-inside:avoid!important;page-break-inside:avoid!important}.rc1327-customs-signature-line{height:9mm!important;border-bottom:.45mm solid #334155!important;margin:2mm 0 1mm!important}.rc1327-customs-signature-hint{font-size:6.4pt!important;line-height:1.1!important;color:#64748b!important;font-weight:650!important}'+
 '@media(max-width:640px){.rc1305-document-grid,.rc1305-pickup-grid{grid-template-columns:1fr!important}.rc1305-pickup-meta,.rc1305-meta-driver,.rc1305-pickup-signature,.rc1305-pickup-summary[data-rc1315-customs-required] .rc1305-signature-primary{grid-column:auto!important;height:auto!important;min-height:0!important}.rc1305-pickup-signature>strong{height:auto!important;min-height:11.2mm!important}}'+
 '.rc1315-print-qr{box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:1mm!important;width:22mm!important;max-width:22mm!important;min-height:14mm!important;padding:.7mm!important;border:.45mm solid #0f2942!important;border-radius:2.2mm!important;background:#fff!important;color:#0f2942!important;break-inside:avoid!important;page-break-inside:avoid!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+
 '.rc1315-print-qr-code{flex:0 0 12mm!important;width:12mm!important;height:12mm!important}.rc1315-qr-svg{display:block!important;width:12mm!important;height:12mm!important}'+
 '.rc1315-print-qr-copy{display:flex!important;min-width:0!important;flex-direction:column!important;gap:.6mm!important}.rc1315-print-qr-copy strong{font-size:9pt!important;text-transform:uppercase!important}.rc1315-print-qr-copy span{font-size:8.5pt!important;font-weight:800!important}.rc1315-print-qr-copy small{font-size:6.8pt!important;line-height:1.2!important;font-weight:700!important;color:#475569!important}'+
  '.rc1341-cover-pickup-date{margin-top:1mm!important;font-size:8.5pt!important;line-height:1.15!important;color:#0f2942!important}'+
 '.rc1327-cover-qr-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;align-items:end!important;gap:4mm!important}.rc1327-cover-qr-row>*{min-width:0!important}'+
 '.rc1359-print-qr-center{position:absolute!important;left:50%!important;right:auto!important;bottom:14mm!important;transform:translateX(-50%)!important;width:22mm!important;max-width:22mm!important;min-height:10mm!important;padding:.5mm!important;margin:0!important;border:.35mm solid #2563eb!important;border-radius:1.6mm!important;background:#fff!important;z-index:4!important}.rc1359-print-qr-center .rc1315-print-qr-code,.rc1359-print-qr-center .rc1315-qr-svg{width:8mm!important;min-width:8mm!important;max-width:8mm!important;height:8mm!important;min-height:8mm!important;max-height:8mm!important;flex:0 0 8mm!important}.rc1359-print-qr-center .rc1315-print-qr-copy{display:block!important;margin:0!important}.rc1359-print-qr-center .rc1315-print-qr-copy strong{font-size:5.4pt!important;line-height:1!important}.rc390-cover [data-rc1305-document-grid],.rc352-cover [data-rc1305-document-grid]{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:.5mm!important}.rc390-cover [data-rc1305-document-grid] [data-rc1293-packing-slip],.rc352-cover [data-rc1305-document-grid] [data-rc1293-packing-slip]{font-size:5.2pt!important;line-height:1!important;padding:.3mm .5mm!important;min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:break-word!important}'+
 '@media print{.rc1305-pickup-summary{margin-top:1.6mm!important}.rc1305-pickup-banner{padding:1.5mm 2.2mm!important;font-size:8.2pt!important}.rc1305-pickup-grid{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:.8mm!important;padding:1.2mm!important}.rc1305-pickup-meta{height:11.5mm!important;min-height:11.5mm!important}.rc1305-pickup-signature{grid-column:span 3!important;height:16.5mm!important;min-height:16.5mm!important}.rc1305-pickup-summary[data-rc1315-customs-required="0"] .rc1305-signature-primary{grid-column:1 / -1!important}.rc1305-pickup-signature>strong{height:10.1mm!important;max-height:10.1mm!important}.rc1305-signature-image{max-height:9.5mm!important}.rc1305-document-grid,.rc1305-pickup-summary,.rc1305-pickup-grid,.rc1305-pickup-item,.rc1315-print-qr{break-inside:avoid!important;page-break-inside:avoid!important}}';
 (d.head||d.documentElement).appendChild(st)
}
style();
w.ExportHUBRC1305LoadingListPrint=Object.freeze({version:'RC1363',enhance:enhance,enhanceCover:enhanceCover,isPicked:isPicked,deliveryFiles:deliveryFiles,printRef:printRef,qrSvg:rc1315QrSvg,addQuickPrintQr:addQuickPrintQr,style:style});
})(window,document);
