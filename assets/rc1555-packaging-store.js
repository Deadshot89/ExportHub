(function(root){
  'use strict';
  if(!root||root.ExportHUBPackagingStore)return;
  var records=[],listeners=[];
  function text(v){return String(v==null?'':v).trim();}
  function norm(v){return text(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  function copy(item){if(!item||typeof item!=='object')return null;return{id:text(item.id),name:text(item.name),code:text(item.code),description:text(item.description||item.note),l:num(item.l!=null?item.l:item.length),w:num(item.w!=null?item.w:item.width),h:num(item.h!=null?item.h:item.height),ldm:num(item.ldm),active:item.active!==false,createdAt:text(item.createdAt),createdBy:text(item.createdBy),updatedAt:text(item.updatedAt),updatedBy:text(item.updatedBy)};}
  function num(v){var n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
  function dedupe(list){var out=[],seenId={},seenName={};(Array.isArray(list)?list:[]).forEach(function(raw){var item=copy(raw);if(!item||!item.name)return;var id=norm(item.id),name=norm(item.name);if(id&&seenId[id]||name&&seenName[name])return;if(id)seenId[id]=1;if(name)seenName[name]=1;out.push(item);});return out;}
  function event(reason,itemId){var detail={reason:text(reason)||'replace',itemId:text(itemId)};listeners.slice().forEach(function(fn){try{fn(detail,items());}catch(_){}});try{if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent('exporthub:packaging-masterdata-changed',{detail:detail}));}catch(_){}}
  function replace(list,options){options=options||{};records=dedupe(list);if(!options.silent)event(options.reason||'replace',options.itemId);return items();}
  function items(){return records.map(copy).filter(Boolean);}
  function activeItems(){return items().filter(function(item){return item.active!==false;});}
  function get(value){var key=norm(value);if(!key)return null;var found=records.find(function(item){return norm(item.id)===key||norm(item.name)===key||norm(item.code)===key;});return copy(found);}
  function upsert(raw,options){var item=copy(raw);if(!item||!item.name)return null;var index=records.findIndex(function(x){return item.id&&text(x.id)===item.id||norm(x.name)===norm(item.name);});if(index>=0)records[index]=item;else records.push(item);event(options&&options.reason||'upsert',item.id);return copy(item);}
  function remove(id,options){var key=text(id),before=records.length;records=records.filter(function(item){return text(item.id)!==key;});if(records.length!==before)event(options&&options.reason||'remove',key);return records.length!==before;}
  function subscribe(fn){if(typeof fn!=='function')return function(){};listeners.push(fn);return function(){listeners=listeners.filter(function(x){return x!==fn;});};}
  function state(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}try{return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||{};}catch(_){return{};}}
  function fromState(){var s=state(),canonical=Array.isArray(s.packagingTypes)?s.packagingTypes:null;if(canonical)return canonical;var active=(Array.isArray(s.colliTypes)?s.colliTypes:[]).map(function(x){return Object.assign({},x,{active:true});}),inactive=(Array.isArray(s.inactiveColliTypes)?s.inactiveColliTypes:[]).map(function(x){return Object.assign({},x,{active:false});});return active.concat(inactive);}
  function load(options){options=options||{};if(Array.isArray(options.packaging))return Promise.resolve(replace(options.packaging,{silent:options.silent===true,reason:options.reason||'load'}));return Promise.resolve(replace(fromState(),{silent:options.silent===true,reason:options.reason||'state'}));}
  root.ExportHUBPackagingStore=Object.freeze({load:load,items:items,activeItems:activeItems,get:get,replace:replace,upsert:upsert,remove:remove,subscribe:subscribe});
  replace(fromState(),{silent:true});
})(typeof window!=='undefined'?window:globalThis);
