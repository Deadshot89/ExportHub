(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1198_COVER_ONLY__)return;
w.__EXPORTHUB_RC1198_COVER_ONLY__=true;
var pendingMode='',originalOpen=null,installed=false;

function q(v){return String(v==null?'':v).trim()}
function findPrintAll(){
  return d.querySelector('[data-index352-action="print-all"]')||
    Array.from(d.querySelectorAll('button,a,[role="button"]')).find(function(el){return /Gesamtausgabe\s*drucken|Gesamtdruck/i.test(q(el.textContent))})||null
}
function shipmentCreateVisible(){
  var s=null;
  try{s=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__():null}catch(_){}
  var view=q(s&&(s.view||s.currentView)).toLowerCase();
  if(view==='shipment'||view==='shipmentview')return true;
  return !!d.querySelector('#rc573ShipmentShell,#rc363FixedShipmentLayout,[data-exporthub-rendered-view="shipment"]')
}
function actionHost(){
  return d.querySelector('#rc363FixedShipmentLayout .actions,#rc573ShipmentShell .actions,#rc363BlockCustomer')||
    d.querySelector('#content')
}
function cleanupButtonDuplicates(){
  var all=d.querySelectorAll('[data-rc1198-print-cover-only]');
  for(var i=1;i<all.length;i++)all[i].remove()
}
function renderButton(){
  cleanupButtonDuplicates();
  if(!shipmentCreateVisible())return false;
  if(d.querySelector('[data-rc1198-print-cover-only]'))return true;
  var host=actionHost();if(!host)return false;
  var btn=d.createElement('button');
  btn.type='button';
  btn.setAttribute('data-rc1198-print-cover-only','1');
  btn.className='rc1198-cover-only-btn';
  btn.textContent='Nur Deckblatt drucken';
  btn.title='Druckt ausschließlich das farbige Deckblatt der aktuellen Sendung';
  host.appendChild(btn);
  return true
}
function emphasizeRecipientAddress(doc){
  try{
    var cover=doc&&doc.querySelector&&doc.querySelector('.rc352-cover,.rc390-cover');if(!cover)return false;
    var nodes=Array.from(cover.querySelectorAll('div,section,article,td,li'));
    var target=nodes.filter(function(node){
      var txt=q(node.textContent);
      return txt.length>0&&txt.length<700&&/(Empfänger(?:adresse)?|Lieferadresse|Recipient|Delivery address)/i.test(txt)
    }).sort(function(a,b){return q(a.textContent).length-q(b.textContent).length})[0];
    if(!target)return false;
    target.setAttribute('data-rc1198-recipient-highlight','1');
    target.style.fontSize='17pt';
    target.style.lineHeight='1.22';
    target.style.fontWeight='800';
    target.style.padding='5mm';
    target.style.border='2.5mm solid #061a3a';
    target.style.background='#ffffff';
    target.style.color='#061a3a';
    var strong=target.querySelectorAll('strong,b');
    for(var i=0;i<strong.length;i++){
      strong[i].style.fontSize='22pt';
      strong[i].style.lineHeight='1.18';
      strong[i].style.fontWeight='900'
    }
    var addressParts=target.querySelectorAll('p,address,.address,[data-address]');
    for(var j=0;j<addressParts.length;j++){
      addressParts[j].style.fontSize='19pt';
      addressParts[j].style.lineHeight='1.25';
      addressParts[j].style.fontWeight='800'
    }
    return true
  }catch(_){return false}
}
function replacePrintBody(doc,nodes,extraCss){
  if(!doc||!nodes||!nodes.length)return false;
  var clones=nodes.map(function(node){return node.cloneNode(true)});
  doc.body.innerHTML='';
  clones.forEach(function(node){doc.body.appendChild(node)});
  var style=doc.createElement('style');
  style.textContent='@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}'+(extraCss||'');
  doc.head.appendChild(style);
  return true
}
function isolateCoverInPrintWindow(child){
  try{
    var doc=child&&child.document;if(!doc)return false;
    var cover=doc.querySelector('.rc352-cover,.rc390-cover');
    if(!cover)return false;
    return replacePrintBody(doc,[cover],'.rc352-cover,.rc390-cover{display:block!important;position:relative!important;width:210mm!important;min-height:297mm!important;margin:0!important;box-sizing:border-box!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}')
  }catch(_){return false}
}
function cmrPages(doc){
  if(!doc)return[];
  var direct=Array.from(doc.querySelectorAll('.rc352-cmr,.rc390-cmr,[data-document-type="cmr"],[data-print-document="cmr"]'));
  if(direct.length)return direct;
  var pages=Array.from(doc.querySelectorAll('.rc390-page,.rc352-page,.print-page,.page,section'));
  var exact=pages.filter(function(node){
    var txt=q(node.textContent);
    return /\bCMR\b/i.test(txt)&&!/Deckblatt|Ladeliste/i.test(txt)
  });
  if(exact.length)return exact;
  return pages.filter(function(node){return /\bCMR\b/i.test(q(node.textContent))})
}
function isolateCmrInPrintWindow(child){
  try{
    var doc=child&&child.document,pages=cmrPages(doc);if(!pages.length)return false;
    return replacePrintBody(doc,pages,'.rc390-page,.rc352-page,.print-page,.page,section{break-after:page;page-break-after:always}.rc390-page:last-child,.rc352-page:last-child,.print-page:last-child,.page:last-child,section:last-child{break-after:auto;page-break-after:auto}')
  }catch(_){return false}
}
function wrapChildPrint(child){
  if(!child||child.__rc1198PrintWrapped)return child;
  try{
    var nativePrint=child.print&&child.print.bind(child);
    if(typeof nativePrint!=='function')return child;
    child.__rc1198PrintWrapped=true;
    child.print=function(){
      if(pendingMode==='cover')isolateCoverInPrintWindow(child);
      if(pendingMode==='cmr')isolateCmrInPrintWindow(child);
      emphasizeRecipientAddress(child.document);
      pendingMode='';
      return nativePrint()
    }
  }catch(_){}
  return child
}
function installOpenGuard(){
  if(installed)return;
  installed=true;
  try{
    originalOpen=w.open&&w.open.bind(w);
    if(typeof originalOpen==='function'){
      w.open=function(){
        var child=originalOpen.apply(w,arguments);
        wrapChildPrint(child);
        return child
      }
    }
  }catch(_){}
}
function triggerMode(mode){
  var printAll=findPrintAll();
  if(!printAll){
    try{w.alert('Der Einzeldruck ist erst verfügbar, sobald die Sendungsdokumente geladen sind.')}catch(_){}
    return false
  }
  pendingMode=mode;
  installOpenGuard();
  try{
    printAll.click();
    (w.setTimeout||setTimeout)(function(){if(pendingMode===mode)pendingMode=''},15000);
    return true
  }catch(_){pendingMode='';return false}
}
function triggerCoverOnly(){return triggerMode('cover')}
function triggerCmrOnly(){return triggerMode('cmr')}
function renderCmrButton(){
  var old=d.querySelector('[data-rc1198-print-cmr-only]');
  if(!documentsViewVisible()){if(old)old.remove();return false}
  if(old)return true;
  var printAll=findPrintAll();if(!printAll||!printAll.parentNode)return false;
  var btn=d.createElement('button');
  btn.type='button';
  btn.setAttribute('data-rc1198-print-cmr-only','1');
  btn.className='rc1198-cmr-only-btn';
  btn.textContent='Nur CMR drucken';
  btn.title='Druckt ausschließlich den CMR der ausgewählten Sendung';
  printAll.parentNode.insertBefore(btn,printAll.nextSibling);
  return true
}
function onClick(e){
  var cover=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1198-print-cover-only]');
  if(cover){e.preventDefault();triggerCoverOnly();return}
  var cmr=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1198-print-cmr-only]');
  if(cmr){e.preventDefault();triggerCmrOnly()}
}
function schedule(){(w.setTimeout||setTimeout)(function(){renderButton();renderCmrButton()},0)}
installOpenGuard();
d.addEventListener('click',onClick,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(typeof MutationObserver!=='undefined'){
  try{new MutationObserver(function(){renderButton();renderCmrButton()}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}
}
w.ExportHUBRC1198CoverOnly=Object.freeze({version:'RC1198',renderButton:renderButton,renderCmrButton:renderCmrButton,triggerCoverOnly:triggerCoverOnly,triggerCmrOnly:triggerCmrOnly,isolateCoverInPrintWindow:isolateCoverInPrintWindow,isolateCmrInPrintWindow:isolateCmrInPrintWindow,emphasizeRecipientAddress:emphasizeRecipientAddress});
})(window,document);
