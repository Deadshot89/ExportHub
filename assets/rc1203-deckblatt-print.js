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
  target.style.fontSize='18pt';
  target.style.lineHeight='1.24';
  target.style.fontWeight='800';
  target.style.padding='5mm';
  target.style.border='2.5mm solid #0b1f44';
  target.style.background='#ffffff';
  target.style.color='#0b1f44';
  var strong=target.querySelectorAll('strong,b');
  for(var i=0;i<strong.length;i++){strong[i].style.fontSize='22pt';strong[i].style.fontWeight='900'}
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
  title.style.fontSize='13pt';title.style.fontWeight='900';title.style.textTransform='uppercase';title.style.letterSpacing='.4mm';
  var body=cover.ownerDocument.createElement('div');
  body.textContent=value;
  body.style.fontSize='16pt';body.style.fontWeight='800';body.style.lineHeight='1.3';body.style.marginTop='2mm';body.style.whiteSpace='pre-wrap';
  old.appendChild(title);old.appendChild(body);
  old.style.display='block';old.style.marginTop='5mm';old.style.padding='5mm';
  old.style.border='2.5mm solid #0b1f44';old.style.borderLeft='7mm solid #facc15';
  old.style.background='#fff7cc';old.style.color='#0b1f44';
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
  target.style.background='#facc15';target.style.color='#111827';
  target.style.border='3mm solid #111827';target.style.padding='5mm';
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
      cover.style.border='12mm solid #0b1f44';
      cover.style.borderTopWidth='20mm';
      cover.style.outline='3mm solid #facc15';
      cover.style.outlineOffset='-4mm';
      cover.style.background='#dbeafe';
      cover.style.backgroundImage='linear-gradient(180deg,#93c5fd 0,#dbeafe 42%,#eff6ff 100%)';
      cover.style.color='#0b1f44';
      cover.style.boxShadow='inset 0 0 0 4mm #2563eb';
      cover.style.webkitPrintColorAdjust='exact';
      cover.style.printColorAdjust='exact';
      cover.style.padding='6mm';
      markRecipient(cover);
      emphasizeReference(cover);
      ensureRemark(cover,remark)
    });
    var style=doc.getElementById&&doc.getElementById('rc1203DeckblattPrintStyle');
    if(!style&&doc.head){
      style=doc.createElement('style');style.id='rc1203DeckblattPrintStyle';
      style.textContent='@media print{.rc390-cover,.rc352-cover{border:12mm solid #0b1f44!important;border-top-width:20mm!important;outline:3mm solid #facc15!important;outline-offset:-4mm!important;background:#dbeafe!important;background-image:linear-gradient(180deg,#93c5fd 0,#dbeafe 42%,#eff6ff 100%)!important;box-shadow:inset 0 0 0 4mm #2563eb!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}[data-rc1203-cover-remark]{display:block!important;border:2.5mm solid #0b1f44!important;border-left:7mm solid #facc15!important;background:#fff7cc!important;color:#0b1f44!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}';
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
      if(pendingMode==='cover')decorateCover(child.document);
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
