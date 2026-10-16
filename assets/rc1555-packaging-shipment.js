(function(root,doc){
'use strict';
if(!root||!doc||root.ExportHUBPackagingShipment1555)return;

var SEARCH_ATTR='data-rc1555-packaging-search';
var ENHANCED_ATTR='data-rc1555-search-enhanced';
var scheduled=false;

function q(value){return String(value==null?'':value).trim();}
function norm(value){return q(value).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function tr(key){
  try{
    if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){
      var value=root.ExportHUBI18n.t(key);
      if(value&&value!==key)return value;
    }
  }catch(_){}
  return key;
}
function optionText(option){
  if(!option)return'';
  return [option.getAttribute&&option.getAttribute('data-name'),option.getAttribute&&option.getAttribute('data-value'),option.textContent].map(q).filter(Boolean).join(' ');
}
function filterMenu(menu,input){
  if(!menu||!input)return;
  var term=norm(input.value);
  var options=Array.prototype.slice.call(menu.querySelectorAll('.rc682-packaging-option'));
  options.forEach(function(option){
    var visible=!term||norm(optionText(option)).includes(term);
    option.hidden=!visible;
    option.setAttribute('aria-hidden',visible?'false':'true');
  });
  Array.prototype.forEach.call(menu.querySelectorAll('.rc1096-packaging-col'),function(group){
    var groupOptions=Array.prototype.slice.call(group.querySelectorAll('.rc682-packaging-option'));
    group.hidden=groupOptions.length>0&&!groupOptions.some(function(option){return !option.hidden;});
  });
}
function enhanceMenu(menu){
  if(!menu||menu.nodeType!==1)return false;
  if(menu.getAttribute(ENHANCED_ATTR)==='1')return false;
  var wrap=doc.createElement('div');
  wrap.className='rc1555-packaging-search';
  wrap.setAttribute(SEARCH_ATTR,'');
  var input=doc.createElement('input');
  input.type = 'search';
  input.autocomplete='off';
  input.spellcheck=false;
  input.className='rc1555-packaging-search-input';
  input.setAttribute('data-rc1555-packaging-search-input','');
  var label=tr('common.search');
  input.placeholder=label;
  input.setAttribute('aria-label',label);
  input.addEventListener('input',function(){filterMenu(menu,input);});
  input.addEventListener('keydown',function(event){
    if(event&&event.key==='Escape'&&input.value){input.value='';filterMenu(menu,input);event.stopPropagation();}
  });
  wrap.appendChild(input);
  menu.insertBefore(wrap,menu.firstChild);
  menu.setAttribute(ENHANCED_ATTR,'1');
  filterMenu(menu,input);
  return true;
}
function ensureStyle(){
  if(doc.getElementById('exporthub-rc1555-packaging-shipment-style'))return;
  var style=doc.createElement('style');
  style.id='exporthub-rc1555-packaging-shipment-style';
  style.textContent='.rc1555-packaging-search{position:sticky;top:0;z-index:3;padding:8px 10px;background:var(--surface,#fff);border-bottom:1px solid #dbe4ec}.rc1555-packaging-search-input{display:block;width:100%;min-height:40px;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:inherit;background:var(--surface,#fff);color:inherit}.rc1555-packaging-search-input:focus{outline:2px solid #2563eb;outline-offset:1px}.rc682-packaging-option[hidden],.rc1096-packaging-col[hidden]{display:none!important}@media(max-width:720px){.rc1555-packaging-search{padding:7px}.rc1555-packaging-search-input{min-height:42px}}';
  (doc.head||doc.documentElement).appendChild(style);
}
function enhance(){
  ensureStyle();
  var changed=false;
  Array.prototype.forEach.call(doc.querySelectorAll('.rc682-packaging-menu'),function(menu){if(enhanceMenu(menu))changed=true;});
  return changed;
}
function refreshLabels(){
  Array.prototype.forEach.call(doc.querySelectorAll('['+SEARCH_ATTR+'] input'),function(input){var label=tr('common.search');input.placeholder=label;input.setAttribute('aria-label',label);});
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  var run=function(){scheduled=false;try{enhance();refreshLabels();}catch(error){try{console.warn('RC1555 packaging shipment search',error);}catch(_){}}};
  if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(run);else root.setTimeout(run,0);
}

if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
if(typeof MutationObserver!=='undefined'){
  var observer=new MutationObserver(schedule);
  try{observer.observe(doc.documentElement,{childList:true,subtree:true});}catch(_){}
}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:packaging-masterdata-changed','exporthub:language-changed'].forEach(function(name){
  try{root.addEventListener(name,schedule);}catch(_){}
});

root.ExportHUBPackagingShipment1555=Object.freeze({version:'RC1555',enhance:enhance,filterMenu:filterMenu});
})(window,document);
