(function(root,doc){
'use strict';
if(!root||!doc||root.ExportHUBPackagingShipment1555)return;

var SEARCH_ATTR='data-rc1555-packaging-search';
var ENHANCED_ATTR='data-rc1555-search-enhanced';
var scheduled=false;

function q(value){return String(value==null?'':value).trim();}
function norm(value){return q(value).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function comparable(value){return norm(value).replace(/europalette/g,'euro palette').replace(/einwegpalette/g,'einweg palette').replace(/industriepalette/g,'industrie palette').replace(/\s+/g,' ');}
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
  input.type='search';
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
function activePackagingNames(){
  var store=root.ExportHUBPackagingStore;
  if(!store||typeof store.activeItems!=='function')return[];
  var seen=Object.create(null),names=[];
  store.activeItems().forEach(function(item){
    var name=q(item&&(item.name||item.type||item.label)),key=comparable(name);
    if(!name||!key||seen[key])return;
    seen[key]=true;
    names.push(name);
  });
  return names;
}
function packagingCategory(name){
  var value=norm(name);
  if(/^e\s*\d+(?:\b|$)/i.test(q(name))||/\b(karton|kartons|paket|pakete|box|boxes|carton|cartons)\b/.test(value))return'packages';
  if(/palette|palett|pallet|skid/.test(value))return'pallets';
  return'other';
}
function replaceNativeOptions(select,names,current){
  if(!select)return;
  var blank=doc.createElement('option');blank.value='';blank.textContent='—';
  while(select.firstChild)select.removeChild(select.firstChild);
  select.appendChild(blank);
  names.forEach(function(name){var option=doc.createElement('option');option.value=name;option.textContent=name;select.appendChild(option);});
  if(current&&!names.some(function(name){return comparable(name)===comparable(current);})){
    var historical=doc.createElement('option');historical.value=current;historical.textContent=current;historical.setAttribute('data-rc1555-historical','1');select.appendChild(historical);
  }
  select.value=current||'';
}
function rebuildColumns(columnsHost,names,current){
  if(!columnsHost)return;
  var groups={packages:[],pallets:[],other:[]};
  names.forEach(function(name){groups[packagingCategory(name)].push(name);});
  var columns=Array.prototype.slice.call(columnsHost.querySelectorAll('.rc682-packaging-column'));
  ['packages','pallets','other'].forEach(function(category,index){
    var column=columns[index];if(!column)return;
    Array.prototype.forEach.call(column.querySelectorAll('.rc682-packaging-option,.rc682-packaging-empty'),function(node){node.remove();});
    groups[category].forEach(function(name){
      var button=doc.createElement('button');
      button.type='button';
      button.className='rc682-packaging-option';
      button.setAttribute('data-rc682-packaging-option',name);
      button.setAttribute('aria-pressed',comparable(name)===comparable(current)?'true':'false');
      button.textContent=name;
      column.appendChild(button);
    });
  });
}
function refreshPackagingOptions(){
  var names=activePackagingNames();
  var changed=false;
  Array.prototype.forEach.call(doc.querySelectorAll('.rc682-packaging-picker'),function(picker){
    var select=picker.querySelector('.rc682-packaging-native');
    var label=picker.querySelector('[data-rc682-packaging-value]');
    var current=q(select&&select.value)||q(label&&label.textContent);
    if(current==='—')current='';
    replaceNativeOptions(select,names,current);
    var columnsHost=picker.querySelector('.rc682-packaging-columns');
    rebuildColumns(columnsHost,names,current);
    var menu=picker.querySelector('.rc682-packaging-menu');
    var input=menu&&menu.querySelector('[data-rc1555-packaging-search-input]');
    if(menu&&input)filterMenu(menu,input);
    changed=true;
  });
  return changed;
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
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(function(name){
  try{root.addEventListener(name,schedule);}catch(_){}
});
try{root.addEventListener('exporthub:packaging-masterdata-changed',function(){refreshPackagingOptions();schedule();});}catch(_){}

root.ExportHUBPackagingShipment1555=Object.freeze({version:'RC1555',enhance:enhance,filterMenu:filterMenu,refreshPackagingOptions:refreshPackagingOptions});
})(window,document);
