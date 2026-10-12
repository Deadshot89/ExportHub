/* ExportHUB360 RC1371 – dashboard personalization state/runtime. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1371_DASHBOARD__)return;
w.__EXPORTHUB_RC1371_DASHBOARD__=true;

var VERSION='RC1371';
var SCHEMA='v1';
var STORAGE_PREFIX='exporthub.dashboard.layout.v1.';
var SIZES=['S','M','L','XL'];
var TEMPLATES=['standard','management','operativ','kompakt','analyse'];

function q(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function normalizedUserId(value){return q(value).toLowerCase()}
function allowedTemplate(value){value=q(value).toLowerCase();return TEMPLATES.indexOf(value)>=0?value:'standard'}
function defs(registry){return Array.isArray(registry)?registry.filter(function(row){return row&&q(row.id)}):[]}
function allowedSizes(def){
  var list=Array.isArray(def&&def.allowedSizes)?def.allowedSizes.map(function(v){return q(v).toUpperCase()}).filter(function(v){return SIZES.indexOf(v)>=0}):[];
  return list.length?list:[q(def&&def.defaultSize).toUpperCase()||'M']
}
function defaultSize(def){
  var allowed=allowedSizes(def),value=q(def&&def.defaultSize).toUpperCase();
  return allowed.indexOf(value)>=0?value:allowed[0]||'M'
}
function defaultVisible(def){return !(def&&def.defaultVisible===false)}

function templateLayout(name,registry){
  var template=allowedTemplate(name);
  return {
    schema:SCHEMA,
    template:template,
    widgets:defs(registry).map(function(def,index){
      return {id:q(def.id),visible:defaultVisible(def),size:defaultSize(def),order:index}
    })
  }
}

function normalizeLayout(raw,registry){
  var list=defs(registry),byId=new Map();
  list.forEach(function(def){byId.set(q(def.id),def)});
  var source=raw&&typeof raw==='object'?raw:{};
  var stored=Array.isArray(source.widgets)?source.widgets:[];
  var selected=new Map();
  stored.forEach(function(row,index){
    if(!row||typeof row!=='object')return;
    var id=q(row.id),def=byId.get(id);
    if(!def||selected.has(id))return;
    var allowed=allowedSizes(def),size=q(row.size).toUpperCase();
    if(allowed.indexOf(size)<0)size=defaultSize(def);
    var order=Number(row.order);
    if(!Number.isFinite(order))order=index;
    selected.set(id,{id:id,visible:row.visible!==false,size:size,order:order})
  });
  var nextOrder=selected.size;
  list.forEach(function(def){
    var id=q(def.id);
    if(!selected.has(id))selected.set(id,{id:id,visible:defaultVisible(def),size:defaultSize(def),order:nextOrder++})
  });
  var widgets=Array.from(selected.values()).sort(function(a,b){return a.order-b.order}).map(function(row,index){
    return {id:row.id,visible:row.visible!==false,size:row.size,order:index}
  });
  return {schema:SCHEMA,template:allowedTemplate(source.template),widgets:widgets}
}

function layoutStorageKey(userId){
  var id=normalizedUserId(userId);
  return id?STORAGE_PREFIX+encodeURIComponent(id):''
}

function currentUserRecord(){
  try{
    if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){
      var direct=w.__EXPORTHUB_GET_CURRENT_USER__();
      if(direct)return direct
    }
  }catch(_){}
  try{
    if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)return w.ExportHUBClean.runtime.user
  }catch(_){}
  if(w.currentUser)return w.currentUser;
  try{
    if(typeof w.__EXPORTHUB_GET_STATE__==='function'){
      var state=w.__EXPORTHUB_GET_STATE__();
      if(state&&(state.currentUser||state.user))return state.currentUser||state.user
    }
  }catch(_){}
  return null
}

function resolveUserIdentity(){
  var user=currentUserRecord();
  if(!user)return '';
  if(typeof user==='string')return normalizedUserId(user);
  var keys=['id','userId','uid','username','user','login','email'];
  for(var i=0;i<keys.length;i++){
    var value=normalizedUserId(user[keys[i]]);
    if(value)return value
  }
  return ''
}

function readLayout(userId,registry){
  var key=layoutStorageKey(userId);
  if(!key)return templateLayout('standard',registry);
  var raw=null;
  try{raw=w.localStorage&&w.localStorage.getItem(key)}catch(_){}
  if(!raw)return templateLayout('standard',registry);
  try{return normalizeLayout(JSON.parse(raw),registry)}catch(_){return templateLayout('standard',registry)}
}

function writeLayout(userId,state){
  var key=layoutStorageKey(userId);
  if(!key)return false;
  try{
    if(!w.localStorage||typeof w.localStorage.setItem!=='function')return false;
    w.localStorage.setItem(key,JSON.stringify(state));
    return true
  }catch(_){return false}
}

function resetLayout(userId){
  var key=layoutStorageKey(userId);
  if(!key)return false;
  try{
    if(!w.localStorage||typeof w.localStorage.removeItem!=='function')return false;
    w.localStorage.removeItem(key);
    return true
  }catch(_){return false}
}

w.ExportHUBDashboard1371=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  sizes:SIZES.slice(),
  templates:TEMPLATES.slice(),
  normalizeLayout:normalizeLayout,
  resolveUserIdentity:resolveUserIdentity,
  layoutStorageKey:layoutStorageKey,
  readLayout:readLayout,
  writeLayout:writeLayout,
  resetLayout:resetLayout,
  templateLayout:templateLayout
});
})(window);
