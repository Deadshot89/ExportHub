(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1203_DECKBLATT__)return;
w.__EXPORTHUB_RC1203_DECKBLATT__=true;

var pendingMode='',originalOpen=null,installed=false;
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?(w.__EXPORTHUB_GET_STATE__()||{}):{}}catch(_){return{}}}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
function allShipments(){
  var s=state(),out=[];
  [s.shipment,s.currentShipment,s.selectedShipment].forEach(function(x){if(obj(x)&&out.indexOf(x)<0)out.push(x)});
  try{var active=typeof w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null;if(obj(active)&&out.indexOf(active)<0)out.unshift(active)}catch(_){}
  arr(s.shipments).forEach(function(x){if(obj(x)&&out.indexOf(x)<0)out.push(x)});
  return out
}
function shipmentForDocument(doc){
  var ref='';
  try{
    var node=doc&&doc.querySelector&&doc.querySelector('[data-shipment-ref]');
    ref=q(node&&node.getAttribute&&node.getAttribute('data-shipment-ref')).toUpperCase()
  }catch(_){}
  var list=allShipments();
  if(ref){for(var i=0;i<list.length;i++)if(refOf(list[i])===ref)return list[i]}
  return list[0]||null
}
function remarkValue(sh){
  var values=sh?[sh.remark,sh.remarks,sh.bemerkung,sh.comments,sh.comment,sh.note,sh.notes,sh.shipmentRemark]:[];
  for(var i=0;i<values.length;i++){var v=q(values[i]);if(v)return v}
  try{
    var field=d.querySelector('[data-rc896-field="remark"] textarea,[data-rc896-field="remark"] input,textarea[name="remark"],textarea[name="comments"]');
    var fallback=q(field&&field.value);if(fallback)return fallback
  }catch(_){}
  return ''
}
function findPrintAll(){
  return d.querySelector('[data-index352-action="print-all"]')||
    Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return /Gesamtausgabe\s*drucken|Gesamtdruck/i.test(q(el.textContent))})||null
}
function shipmentCreateVisible(){
  var s=state(),view=q(s&&(s.view||s.currentView)).toLowerCase();
  if(view==='shipment'||view==='shipmentview')return true;
  if(view&&view!=='shipment'&&view!=='shipmentview')return false;
  return !!d.querySelector('#rc573ShipmentShell,#rc363FixedShipmentLayout,[data-exporthub-rendered-view="shipment"]')
}
function documentsViewVisible(){
  if(d.querySelector('#loadListDoc,[data-exporthub-rendered-view="documents"],[data-index352-action="print-all"]'))return true;
  var s=state(),view=q(s&&(s.view||s.currentView)).toLowerCase();
  return /^(?:documents?|cmr|loadlist|loadinglist)$/.test(view)
}
function actionHost(){
  return d.querySelector('#rc363FixedShipmentLayout .actions,#rc573ShipmentShell .actions,#rc363BlockCustomer')||d.querySelector('#content')
}
function renderCoverButton(){
  var all=d.querySelectorAll('[data-rc1203-print-cover-only]');
  for(var i=1;i<all.length;i++)all[i].remove();
  if(!shipmentCreateVisible())return false;
  if(d.querySelector('[data-rc1203-print-cover-only]'))return true;
  var host=actionHost();if(!host)return false;
  var btn=d.createElement('button');
  btn.type='button';btn.className='rc1203-cover-only-btn';
  btn.setAttribute('data-rc1203-print-cover-only','1');
  btn.textContent='Nur Deckblatt drucken';
  btn.title='Druckt ausschließlich das farbige Deckblatt der aktuellen Sendung';
  host.appendChild(btn);return true
}
function renderCmrButton(){
  var old=d.querySelector('[data-rc1203-print-cmr-only]');
  if(!documentsViewVisible()){if(old)old.remove();return false}
  if(old)return true;
  var printAll=findPrintAll();if(!printAll||!printAll.parentNode)return false;
  var btn=d.createElement('button');
  btn.type='button';btn.className='rc1203-cmr-only-btn';
  btn.setAttribute('data-rc1203-print-cmr-only','1');
  btn.textContent='Nur CMR drucken';
  btn.title='Druckt ausschließlich den CMR der ausgewählten Sendung';
  printAll.parentNode.insertBefore(btn,printAll.nextSibling);return true
}
function markRecipient(cover){
  if(!cover||!cover.querySelectorAll)return false;
  var nodes=Array.from(cover.querySelectorAll('div,section,article,td,li,p,address'));
  var target=nodes.filter(function(node){
    var txt=q(node.textContent);
    return txt.length>0&&txt.length<900&&/(Empfänger(?:adresse)?|Lieferadresse|Recipient|Delivery address)/i.test(txt)
  }).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
  if(!target)return false;
  target.setAttribute('data-rc1203-recipient-highlight','1');
  target.style.fontSize='16pt';
  target.style.lineHeight='1.24';
  target.style.fontWeight='800';
  target.style.padding='4mm';
  target.style.border='1mm solid #94a3b8';
  target.style.background='#ffffff';
  target.style.color='#1f2937';
  var strong=target.querySelectorAll('strong,b');
  for(var i=0;i<strong.length;i++){strong[i].style.fontSize='19pt';strong[i].style.fontWeight='800'}
  return true
}
function ensureRemark(cover,remark){
  if(!cover||!cover.ownerDocument)return false;
  var value=q(remark)||'—';
  var old=cover.querySelector('[data-rc1203-cover-remark]');
  if(old&&q(old.getAttribute('data-rc1203-remark-value'))===value)return true;
  if(!old){
    old=cover.ownerDocument.createElement('section');
    old.setAttribute('data-rc1203-cover-remark','1');
    cover.appendChild(old)
  }
  old.setAttribute('data-rc1203-remark-value',value);
  old.innerHTML='';
  var title=cover.ownerDocument.createElement('div');
  title.textContent='Bemerkung';
  title.style.fontSize='11pt';title.style.fontWeight='800';title.style.textTransform='uppercase';title.style.letterSpacing='.25mm';
  var body=cover.ownerDocument.createElement('div');
  body.textContent=value;
  body.style.fontSize='12pt';body.style.fontWeight='700';body.style.lineHeight='1.25';body.style.marginTop='1.5mm';body.style.whiteSpace='pre-wrap';
  old.appendChild(title);old.appendChild(body);
  old.style.display='block';old.style.marginTop='4mm';old.style.padding='3.5mm 4mm';old.style.minHeight='18mm';old.style.maxHeight='28mm';old.style.overflow='hidden';
  old.style.border='1mm solid #cbd5e1';old.style.borderLeft='3mm solid #e5b51d';
  old.style.background='#fffdf5';old.style.color='#1f2937';
  old.style.breakInside='avoid';old.style.pageBreakInside='avoid';
  return true
}
function emphasizeReference(cover){
  if(!cover||!cover.querySelectorAll)return false;
  var nodes=Array.from(cover.querySelectorAll('div,section,article,td,p'));
  var target=nodes.filter(function(node){
    var txt=q(node.textContent);
    return txt.length>0&&txt.length<260&&/(Referenz|Reference)/i.test(txt)
  }).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
  if(!target)return false;
  target.setAttribute('data-rc1203-reference-highlight','1');
  target.style.background='#fff6cc';target.style.color='#1f2937';
  target.style.border='1.2mm solid #d4a514';target.style.padding='4mm';
  target.style.fontWeight='900';
  return true
}
function decorateCover(doc){
  try{
    if(!doc||!doc.querySelectorAll)return false;
    var covers=Array.from(doc.querySelectorAll('.rc390-cover,.rc352-cover'));
    if(!covers.length)return false;
    var sh=shipmentForDocument(doc),remark=remarkValue(sh);
    covers.forEach(function(cover){
      cover.setAttribute('data-rc1203-cover-enhanced','1');
      cover.style.boxSizing='border-box';
      cover.style.border='3mm solid #334155';
      cover.style.borderTopWidth='5mm';
      cover.style.outline='0';
      cover.style.outlineOffset='0';
      cover.style.background='#f8fafc';
      cover.style.backgroundImage='none';
      cover.style.color='#1f2937';
      cover.style.boxShadow='inset 0 0 0 1mm #dbe4ee';
      cover.style.webkitPrintColorAdjust='exact';
      cover.style.printColorAdjust='exact';
      cover.style.padding='8mm';
      markRecipient(cover);
      emphasizeReference(cover);
      ensureRemark(cover,remark)
    });
    var style=doc.getElementById&&doc.getElementById('rc1203DeckblattPrintStyle');
    if(!style&&doc.head){
      style=doc.createElement('style');style.id='rc1203DeckblattPrintStyle';
      style.textContent='@media print{.rc390-cover,.rc352-cover{border:3mm solid #334155!important;border-top-width:5mm!important;outline:0!important;background:#f8fafc!important;background-image:none!important;box-shadow:inset 0 0 0 1mm #dbe4ee!important;padding:8mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.rc390-cover-ref,[data-rc1203-reference-highlight]{background:#fff6cc!important;border:1.2mm solid #d4a514!important;color:#1f2937!important}[data-rc1203-cover-remark]{display:block!important;border:1mm solid #cbd5e1!important;border-left:3mm solid #e5b51d!important;background:#fffdf5!important;color:#1f2937!important;min-height:18mm!important;max-height:28mm!important;overflow:hidden!important;margin-bottom:5mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.rc390-cover-qr{margin-top:5mm!important;position:relative!important;clear:both!important}}';
      doc.head.appendChild(style)
    }
    return true
  }catch(_){return false}
}
function replacePrintBody(doc,nodes){
  if(!doc||!nodes||!nodes.length)return false;
  var clones=nodes.map(function(node){return node.cloneNode(true)});
  doc.body.innerHTML='';clones.forEach(function(node){doc.body.appendChild(node)});
  return true
}
function isolateCover(child){
  try{var doc=child&&child.document,cover=doc&&doc.querySelector&&doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;return replacePrintBody(doc,[cover])}catch(_){return false}
}
function cmrPages(doc){
  if(!doc)return[];
  var direct=Array.from(doc.querySelectorAll('.rc390-cmr,.rc352-cmr,[data-document-type="cmr"],[data-print-document="cmr"]'));
  if(direct.length)return direct;
  var pages=Array.from(doc.querySelectorAll('.rc390-page,.rc352-page,.print-page,.page,section'));
  var exact=pages.filter(function(node){var txt=q(node.textContent);return /\bCMR\b/i.test(txt)&&!/Deckblatt|Ladeliste/i.test(txt)});
  return exact.length?exact:pages.filter(function(node){return /\bCMR\b/i.test(q(node.textContent))})
}
function isolateCmr(child){
  try{var doc=child&&child.document,pages=cmrPages(doc);if(!pages.length)return false;return replacePrintBody(doc,pages)}catch(_){return false}
}
function wrapChildPrint(child){
  if(!child||child.__rc1203PrintWrapped)return child;
  try{
    var nativePrint=child.print&&child.print.bind(child);if(typeof nativePrint!=='function')return child;
    child.__rc1203PrintWrapped=true;
    child.print=function(){
      decorateCover(child.document);
      if(pendingMode==='cover')isolateCover(child);
      if(pendingMode==='cmr')isolateCmr(child);
      pendingMode='';
      return nativePrint()
    }
  }catch(_){}
  return child
}
function installOpenGuard(){
  if(installed)return;installed=true;
  try{
    originalOpen=w.open&&w.open.bind(w);
    if(typeof originalOpen==='function'){
      w.open=function(){var child=originalOpen.apply(w,arguments);wrapChildPrint(child);return child}
    }
  }catch(_){}
}
function triggerMode(mode){
  var printAll=findPrintAll();
  if(!printAll){try{w.alert('Der Einzeldruck ist erst verfügbar, sobald die Sendungsdokumente geladen sind.')}catch(_){}return false}
  pendingMode=mode;installOpenGuard();
  try{printAll.click();(w.setTimeout||setTimeout)(function(){if(pendingMode===mode)pendingMode=''},15000);return true}catch(_){pendingMode='';return false}
}
function onClick(e){
  var cover=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1203-print-cover-only]');
  if(cover){e.preventDefault();triggerMode('cover');return}
  var cmr=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1203-print-cmr-only]');
  if(cmr){e.preventDefault();triggerMode('cmr')}
}
function schedule(){(w.setTimeout||setTimeout)(function(){renderCoverButton();renderCmrButton();decorateCover(d)},0)}
installOpenGuard();
d.addEventListener('click',onClick,true);
try{w.addEventListener('beforeprint',function(){decorateCover(d)})}catch(_){}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(typeof MutationObserver!=='undefined'){try{new MutationObserver(function(){renderCoverButton();renderCmrButton();decorateCover(d)}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}}
w.ExportHUBRC1203Deckblatt=Object.freeze({version:'RC1203',decorateCover:decorateCover,remarkValue:remarkValue,renderCoverButton:renderCoverButton,renderCmrButton:renderCmrButton,triggerCoverOnly:function(){return triggerMode('cover')},triggerCmrOnly:function(){return triggerMode('cmr')}});
})(window,document);
