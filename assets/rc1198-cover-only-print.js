(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1198_COVER_ONLY__)return;
w.__EXPORTHUB_RC1198_COVER_ONLY__=true;
var pending=false,originalOpen=null,installed=false;

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
function isolateCoverInPrintWindow(child){
  try{
    var doc=child&&child.document;if(!doc)return false;
    var cover=doc.querySelector('.rc352-cover,.rc390-cover');
    if(!cover)return false;
    var clone=cover.cloneNode(true);
    doc.body.innerHTML='';
    doc.body.appendChild(clone);
    var style=doc.createElement('style');
    style.textContent='@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important}.rc352-cover,.rc390-cover{display:block!important;position:relative!important;width:210mm!important;min-height:297mm!important;margin:0!important;box-sizing:border-box!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}';
    doc.head.appendChild(style);
    return true
  }catch(_){return false}
}
function wrapChildPrint(child){
  if(!child||child.__rc1198PrintWrapped)return child;
  try{
    var nativePrint=child.print&&child.print.bind(child);
    if(typeof nativePrint!=='function')return child;
    child.__rc1198PrintWrapped=true;
    child.print=function(){
      if(pending)isolateCoverInPrintWindow(child);
      pending=false;
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
        if(pending)wrapChildPrint(child);
        return child
      }
    }
  }catch(_){}
}
function triggerCoverOnly(){
  var printAll=findPrintAll();
  if(!printAll){
    try{w.alert('Der Deckblattdruck ist erst verfügbar, sobald die Sendungsdokumente geladen sind.')}catch(_){}
    return false
  }
  pending=true;
  installOpenGuard();
  try{
    printAll.click();
    (w.setTimeout||setTimeout)(function(){if(pending)pending=false},15000);
    return true
  }catch(_){pending=false;return false}
}
function onClick(e){
  var btn=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1198-print-cover-only]');
  if(!btn)return;
  e.preventDefault();
  triggerCoverOnly()
}
function schedule(){(w.setTimeout||setTimeout)(renderButton,0)}
installOpenGuard();
d.addEventListener('click',onClick,true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(typeof MutationObserver!=='undefined'){
  try{new MutationObserver(function(){renderButton()}).observe(d.documentElement||d.body,{childList:true,subtree:true})}catch(_){}
}
w.ExportHUBRC1198CoverOnly=Object.freeze({version:'RC1198',renderButton:renderButton,triggerCoverOnly:triggerCoverOnly,isolateCoverInPrintWindow:isolateCoverInPrintWindow});
})(window,document);
