(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1114_SHIPPING_NEUTRAL__)return;
w.__EXPORTHUB_RC1114_SHIPPING_NEUTRAL__=true;

var VERSION='RC1114.1',scheduled=0,observer=null;

function q(v){return String(v==null?'':v)}
function normalized(v){return q(v).replace(/\s+/g,' ').trim()}
function replaceText(value){
 var s=q(value);
 var pairs=[
  [/Pakete über UPS und Paletten über Gate41\./g,'Pakete über UPS und Paletten über die Paletten-/Mautberechnung.'],
  [/Paletten\s*[–-]\s*Gate41/g,'Paletten / Maut'],
  [/Gate41-Ergebnis/g,'Paletten-/Maut-Ergebnis'],
  [/Gate41-Grundtarife Deutschland/g,'Paletten-Grundtarife Deutschland'],
  [/Gate41-Stammdaten Deutschland/g,'Paletten- und Maut-Stammdaten Deutschland'],
  [/Gate41-Stammdaten speichern/g,'Paletten-/Maut-Stammdaten speichern'],
  [/Nur echte Gate41-Werte pflegen\./g,'Nur freigegebene Paletten- und Mautwerte pflegen.'],
  [/zentraler Gate41-Dieselpreis/g,'zentraler Dieselpreis'],
  [/Laufzeit laut Gate41/g,'Standard-Laufzeit'],
  [/gemäß aktueller Gate41-Vorgabe/g,'gemäß aktueller Versandvorgabe'],
  [/Gate41-Grundtarif/g,'Paletten-Grundtarif'],
  [/Gate41-Tabelle/g,'Palettentarif'],
  [/Gate41-Tarif/g,'Palettentarif'],
  [/Gate41-Preis/g,'Palettenpreis'],
  [/Gate41-Berechnung/g,'Paletten-/Mautberechnung'],
  [/Gate41-Sendungsdaten/g,'Paletten-/Mautdaten'],
  [/Gate41:/g,'Paletten / Maut:'],
  [/Gate41/g,'Paletten / Maut']
 ];
 for(var i=0;i<pairs.length;i++)s=s.replace(pairs[i][0],pairs[i][1]);
 return s
}
function shouldSuppressNotice(value){
 var s=normalized(value);
 if(!s)return false;
 if(/^Aus geöffneter Sendung:\s+.+/i.test(s)&&s.length<=320)return true;
 if(/^(?:Gate41|Paletten\s*\/\s*Maut):\s*Start- und Zielort müssen vollständig angegeben sein, bevor ein belastbarer Preis angezeigt werden kann\.?$/i.test(s))return true;
 return false
}
function suppressNotices(root){
 if(!root||!root.querySelectorAll)return 0;
 var count=0,nodes=Array.prototype.slice.call(root.querySelectorAll('div,p,section,aside,small,span,li'));
 nodes.forEach(function(el){
  var hidden=el.getAttribute&&el.getAttribute('data-rc1114-hidden-notice')==='1';
  var suppress=shouldSuppressNotice(el.textContent);
  if(suppress){
   if(el.style)el.style.display='none';
   if(el.setAttribute)el.setAttribute('data-rc1114-hidden-notice','1');
   count++;
  }else if(hidden){
   if(el.style)el.style.display='';
   if(el.removeAttribute)el.removeAttribute('data-rc1114-hidden-notice');
  }
 });
 return count
}
function neutralizeText(root){
 if(!root)return 0;
 var count=0,walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  var node=walker.currentNode,old=q(node.nodeValue),next=replaceText(old);
  if(next!==old){node.nodeValue=next;count++}
 }
 return count
}
function neutralizeAttrs(root){
 if(!root||!root.querySelectorAll)return 0;
 var count=0,nodes=[root].concat(Array.prototype.slice.call(root.querySelectorAll('[title],[aria-label],[placeholder],[data-label]')));
 nodes.forEach(function(el){
  ['title','aria-label','placeholder','data-label'].forEach(function(name){
   if(!el.getAttribute)return;var old=el.getAttribute(name);if(old==null)return;var next=replaceText(old);
   if(next!==old){el.setAttribute(name,next);count++}
  })
 });
 return count
}
function normalizeHistory(root){
 if(!root||!root.querySelectorAll)return;
 Array.prototype.forEach.call(root.querySelectorAll('.rc501-history .rc626-item'),function(item){
  neutralizeText(item);neutralizeAttrs(item)
 })
}
function run(){
 scheduled=0;
 var root=d.getElementById('rc626Shipping');if(!root)return false;
 neutralizeText(root);neutralizeAttrs(root);normalizeHistory(root);suppressNotices(root);
 root.setAttribute('data-rc1114-shipping-neutral','1');
 return true
}
function schedule(){
 if(scheduled)return;
 scheduled=w.requestAnimationFrame?w.requestAnimationFrame(run):w.setTimeout(run,0)
}
function installObserver(){
 if(observer||!w.MutationObserver||!d.documentElement)return;
 observer=new MutationObserver(function(records){
  for(var i=0;i<records.length;i++){
   var r=records[i],target=r.target&&r.target.nodeType===3?r.target.parentElement:r.target;
   if(target&&target.closest&&target.closest('#rc626Shipping')){schedule();return}
   if(r.addedNodes&&r.addedNodes.length){
    for(var j=0;j<r.addedNodes.length;j++){
     var n=r.addedNodes[j];
     if(n&&n.nodeType===1&&(n.id==='rc626Shipping'||n.querySelector&&n.querySelector('#rc626Shipping'))){schedule();return}
    }
   }
  }
 });
 observer.observe(d.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','data-label']})
}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved'].forEach(function(name){w.addEventListener&&w.addEventListener(name,schedule)});
d.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('[data-view="shippingcosts"],[data-action*="shipping"],#rc626Shipping'))setTimeout(schedule,20)},true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){installObserver();schedule()},{once:true});else{installObserver();schedule()}

w.ExportHUBRC1114ShippingNeutral=Object.freeze({version:VERSION,replaceText:replaceText,shouldSuppressNotice:shouldSuppressNotice,run:run});
})(window,document);