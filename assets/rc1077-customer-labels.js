// ExportHUB RC1077 – Kundenübersicht: "Standorte" statt irreführendem "Firma"-Titel und saubere Überschriften.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1077_CUSTOMER_LABELS__)return;
w.__EXPORTHUB_RC1077_CUSTOMER_LABELS__=true;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function view(){
 var s=state(),v=low(s.view||s.currentView||s.activeView||s.page||'');
 if(v)return v;
 try{return low(d.body&&d.body.getAttribute('data-exporthub-view'))}catch(_){return''}
}
function customerView(){
 var v=view();
 return v==='customers'||v==='customerfolder'||v==='customer'||v==='kunden'||v==='kundenordner'
}
function labelCandidate(el){
 if(!el||el.nodeType!==1||q(el.textContent)!=='Firma')return false;
 if(el.closest&&el.closest('form,label'))return false;
 if(el.matches&&el.matches('th,[role="columnheader"],h1,h2,h3,h4,button,[role="tab"],.tab,.card-title,.section-title,.heading,.title'))return true;
 var cls=low(el.className);
 if(/(?:^|\s)(?:head|heading|title|tab|column|caption|summary)(?:\s|$|-|_)/.test(cls))return true;
 var p=el.parentElement,depth=0;
 while(p&&depth++<3){
   var text=low(p.textContent);
   if(/kundennummer|kunde|kundenübersicht|standort|adresse/.test(text)&&!/input|textarea|select/.test(low(p.tagName)))return true;
   p=p.parentElement
 }
 return false
}
function renameLabels(root){
 if(!root||!root.querySelectorAll)return 0;
 var changed=0,nodes=root.querySelectorAll('th,[role="columnheader"],h1,h2,h3,h4,button,[role="tab"],span,div');
 for(var i=0;i<nodes.length;i++){
   var el=nodes[i];
   if(!labelCandidate(el))continue;
   el.textContent='Standorte';
   el.setAttribute('data-rc1077-renamed','firma-zu-standorte');
   changed++
 }
 return changed
}
function ensureStyle(){
 if(d.getElementById('rc1077CustomerLabelsStyle'))return;
 var style=d.createElement('style');style.id='rc1077CustomerLabelsStyle';
 style.textContent='body[data-rc1077-customer-view="true"] #content h1,body[data-rc1077-customer-view="true"] #content h2,body[data-rc1077-customer-view="true"] #content h3,body[data-rc1077-customer-view="true"] main h1,body[data-rc1077-customer-view="true"] main h2,body[data-rc1077-customer-view="true"] main h3{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;max-height:none!important;line-height:1.2!important;padding-top:2px;padding-bottom:2px}';
 (d.head||d.documentElement).appendChild(style)
}
function apply(){
 if(!d.body)return false;
 var active=customerView();
 d.body.setAttribute('data-rc1077-customer-view',active?'true':'false');
 if(!active)return false;
 ensureStyle();
 var host=d.getElementById('content')||d.querySelector('main')||d.body;
 renameLabels(host);
 return true
}
function schedule(){
 try{if(typeof w.requestAnimationFrame==='function')w.requestAnimationFrame(apply);else w.setTimeout(apply,0)}catch(_){}
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
if(w.addEventListener){
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){w.addEventListener(name,schedule)});
}
if(w.MutationObserver){
 var obs=new MutationObserver(function(){if(customerView())schedule()});
 try{obs.observe(d.documentElement,{subtree:true,childList:true})}catch(_){}
}
w.ExportHUBRC1077CustomerLabels=Object.freeze({version:'RC1077',apply:apply,renameLabels:renameLabels,customerView:customerView});
})(window,document);
