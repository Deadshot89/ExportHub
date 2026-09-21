(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1203_COVER_PRINT__)return;
w.__EXPORTHUB_RC1203_COVER_PRINT__=true;
var pendingMode='',originalOpen=null,installed=false;

function q(v){return String(v==null?'':v).trim()}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?(w.__EXPORTHUB_GET_STATE__()||{}):{}}catch(_){return{}}}
function activeShipment(){
  var s=state();
  if(s&&s.shipment&&typeof s.shipment==='object')return s.shipment;
  try{var a=typeof w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'?w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__():null;if(a&&typeof a==='object')return a}catch(_){}
  return s.currentShipment||s.selectedShipment||null
}
function shipmentRemark(){
  var sh=activeShipment()||{};
  return q(sh.remark||sh.bemerkung||sh.remarks||sh.comments||sh.note||sh.notes)
}
function findPrintAll(){
  return d.querySelector('[data-index352-action="print-all"]')||
    Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return /Gesamtausgabe\s*drucken|Gesamtdruck/i.test(q(el.textContent))})||null
}
function shipmentCreateVisible(){
  var s=state(),view=q(s&&(s.view||s.currentView)).toLowerCase();
  if(view==='shipment'||view==='shipmentview')return true;
  return !!d.querySelector('#rc573ShipmentShell,#rc363FixedShipmentLayout,[data-exporthub-rendered-view="shipment"]')
}
function documentsViewVisible(){
  var s=state(),view=q(s&&(s.view||s.currentView)).toLowerCase();
  if(view==='documents'||view==='cmr')return true;
  var content=d.querySelector('#content');
  return !!(content&&/Ladeliste\s*&\s*CMR|Dokumente\s*&\s*CMR|Gesamtausgabe\s*drucken/i.test(q(content.textContent)))
}
function actionHost(){
  return d.querySelector('#rc363FixedShipmentLayout .actions,#rc573ShipmentShell .actions,#rc363BlockCustomer')||d.querySelector('#content')
}
function renderButton(){
  var old=d.querySelector('[data-rc1203-print-cover-only]');
  if(!shipmentCreateVisible()){if(old)old.remove();return false}
  if(old)return true;
  var host=actionHost();if(!host)return false;
  var btn=d.createElement('button');btn.type='button';btn.setAttribute('data-rc1203-print-cover-only','1');btn.className='rc1203-cover-only-btn';
  btn.textContent='Nur Deckblatt drucken';btn.title='Druckt ausschließlich das Deckblatt der aktuellen Sendung';host.appendChild(btn);return true
}
function renderCmrButton(){
  var old=d.querySelector('[data-rc1203-print-cmr-only]');
  if(!documentsViewVisible()){if(old)old.remove();return false}
  if(old)return true;
  var printAll=findPrintAll();if(!printAll||!printAll.parentNode)return false;
  var btn=d.createElement('button');btn.type='button';btn.setAttribute('data-rc1203-print-cmr-only','1');btn.className='rc1203-cmr-only-btn';
  btn.textContent='Nur CMR drucken';btn.title='Druckt ausschließlich den CMR der ausgewählten Sendung';printAll.parentNode.insertBefore(btn,printAll.nextSibling);return true
}
function applyCoverDesign(doc){
  try{
    var cover=doc&&doc.querySelector&&doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;
    cover.setAttribute('data-rc1203-high-visibility','1');
    var st=cover.style;
    st.setProperty('background','linear-gradient(180deg,#08245d 0%,#1d4ed8 32%,#2563eb 62%,#60a5fa 82%,#dbeafe 100%)','important');
    st.setProperty('border','14mm solid #061a3a','important');
    st.setProperty('border-top-width','24mm','important');
    st.setProperty('outline','3mm solid #facc15','important');
    st.setProperty('outline-offset','-4mm','important');
    st.setProperty('box-shadow','inset 0 0 0 4mm #93c5fd','important');
    st.setProperty('-webkit-print-color-adjust','exact','important');
    st.setProperty('print-color-adjust','exact','important');
    var ref=cover.querySelector('.rc352-cover-ref,.rc390-cover-ref,[data-cover-reference]');
    if(ref){ref.style.setProperty('background','#facc15','important');ref.style.setProperty('color','#111827','important');ref.style.setProperty('border','3mm solid #111827','important')}
    return true
  }catch(_){return false}
}
function emphasizeRecipientAddress(doc){
  try{
    var cover=doc&&doc.querySelector&&doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;
    var nodes=Array.from(cover.querySelectorAll('div,section,article,td,li,address'));
    var target=nodes.filter(function(node){var txt=q(node.textContent);return txt.length>0&&txt.length<700&&/(Empfänger(?:adresse)?|Lieferadresse|Recipient|Delivery address)/i.test(txt)}).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
    if(!target)return false;
    target.setAttribute('data-rc1203-recipient-highlight','1');
    target.style.setProperty('font-size','17pt','important');target.style.setProperty('line-height','1.22','important');target.style.setProperty('font-weight','800','important');
    target.style.setProperty('padding','5mm','important');target.style.setProperty('border','2.5mm solid #061a3a','important');target.style.setProperty('background','#fff','important');target.style.setProperty('color','#061a3a','important');
    Array.from(target.querySelectorAll('strong,b')).forEach(function(n){n.style.setProperty('font-size','22pt','important');n.style.setProperty('font-weight','900','important')});
    Array.from(target.querySelectorAll('p,address,.address,[data-address]')).forEach(function(n){n.style.setProperty('font-size','19pt','important');n.style.setProperty('line-height','1.25','important');n.style.setProperty('font-weight','800','important')});
    return true
  }catch(_){return false}
}
function addRemarkToCover(doc){
  try{
    var remark=shipmentRemark();if(!remark)return false;
    var cover=doc&&doc.querySelector&&doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;
    var existing=cover.querySelector('[data-rc1203-cover-remark]');if(existing){existing.querySelector('[data-value]').textContent=remark;return true}
    var box=doc.createElement('section');box.setAttribute('data-rc1203-cover-remark','1');
    box.style.setProperty('margin','5mm 0 0','important');box.style.setProperty('padding','4mm 5mm','important');box.style.setProperty('background','#fff7cc','important');
    box.style.setProperty('border','2mm solid #facc15','important');box.style.setProperty('color','#111827','important');box.style.setProperty('font-size','16pt','important');box.style.setProperty('line-height','1.25','important');
    var title=doc.createElement('strong');title.textContent='Bemerkung';title.style.setProperty('display','block','important');title.style.setProperty('font-size','18pt','important');title.style.setProperty('margin-bottom','2mm','important');
    var value=doc.createElement('div');value.setAttribute('data-value','1');value.textContent=remark;value.style.setProperty('font-weight','700','important');value.style.setProperty('white-space','pre-wrap','important');
    box.appendChild(title);box.appendChild(value);cover.appendChild(box);return true
  }catch(_){return false}
}
function replacePrintBody(doc,nodes,extraCss){
  if(!doc||!nodes||!nodes.length)return false;
  var clones=nodes.map(function(node){return node.cloneNode(true)});doc.body.innerHTML='';clones.forEach(function(node){doc.body.appendChild(node)});
  var style=doc.createElement('style');style.textContent='@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+(extraCss||'');doc.head.appendChild(style);return true
}
function isolateCoverInPrintWindow(child){try{var doc=child&&child.document;if(!doc)return false;applyCoverDesign(doc);emphasizeRecipientAddress(doc);addRemarkToCover(doc);var cover=doc.querySelector('.rc390-cover,.rc352-cover');if(!cover)return false;return replacePrintBody(doc,[cover],'.rc390-cover,.rc352-cover{display:block!important;position:relative!important;width:210mm!important;min-height:297mm!important;margin:0!important;box-sizing:border-box!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}')}catch(_){return false}}
function cmrPages(doc){if(!doc)return[];var direct=Array.from(doc.querySelectorAll('.rc352-cmr,.rc390-cmr,[data-document-type="cmr"],[data-print-document="cmr"]'));if(direct.length)return direct;var pages=Array.from(doc.querySelectorAll('.rc390-page,.rc352-page,.print-page,.page,section'));var exact=pages.filter(function(node){var txt=q(node.textContent);return /\bCMR\b/i.test(txt)&&!/Deckblatt|Ladeliste/i.test(txt)});return exact.length?exact:pages.filter(function(node){return /\bCMR\b/i.test(q(node.textContent))})}
function isolateCmrInPrintWindow(child){try{var doc=child&&child.document,pages=cmrPages(doc);if(!pages.length)return false;return replacePrintBody(doc,pages,'.rc390-page,.rc352-page,.print-page,.page,section{break-after:page;page-break-after:always}.rc390-page:last-child,.rc352-page:last-child,.print-page:last-child,.page:last-child,section:last-child{break-after:auto;page-break-after:auto}')}catch(_){return false}}
function wrapChildPrint(child){if(!child||child.__rc1203PrintWrapped)return child;try{var nativePrint=child.print&&child.print.bind(child);if(typeof nativePrint!=='function')return child;child.__rc1203PrintWrapped=true;child.print=function(){if(pendingMode==='cover')isolateCoverInPrintWindow(child);else{applyCoverDesign(child.document);emphasizeRecipientAddress(child.document);addRemarkToCover(child.document);if(pendingMode==='cmr')isolateCmrInPrintWindow(child)}pendingMode='';return nativePrint()}}catch(_){}return child}
function installOpenGuard(){if(installed)return;installed=true;try{originalOpen=w.open&&w.open.bind(w);if(typeof originalOpen==='function')w.open=function(){return wrapChildPrint(originalOpen.apply(w,arguments))}}catch(_){}}
function triggerMode(mode){var printAll=findPrintAll();if(!printAll){try{w.alert('Der Einzeldruck ist erst verfügbar, sobald die Sendungsdokumente geladen sind.')}catch(_){}return false}pendingMode=mode;installOpenGuard();try{printAll.click();(w.setTimeout||setTimeout)(function(){if(pendingMode===mode)pendingMode=''},15000);return true}catch(_){pendingMode='';return false}}
function onClick(e){var cover=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1203-print-cover-only]');if(cover){e.preventDefault();triggerMode('cover');return}var cmr=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1203-print-cmr-only]');if(cmr){e.preventDefault();triggerMode('cmr')}}
function schedule(){(w.setTimeout||setTimeout)(function(){renderButton();renderCmrButton()},0)}
installOpenGuard();d.addEventListener('click',onClick,true);if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(typeof MutationObserver!=='undefined'){try{new MutationObserver(function(){renderButton();renderCmrButton()}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}}
w.ExportHUBRC1203CoverPrint=Object.freeze({version:'RC1203',documentsViewVisible:documentsViewVisible,applyCoverDesign:applyCoverDesign,addRemarkToCover:addRemarkToCover,renderButton:renderButton,renderCmrButton:renderCmrButton,isolateCoverInPrintWindow:isolateCoverInPrintWindow,isolateCmrInPrintWindow:isolateCmrInPrintWindow});
})(window,document);
