(function(root){
'use strict';
if(root.ExportHubSopTourValidator)return;

function text(value){return String(value==null?'':value).trim();}
function result(ok,reason,details){return {ok:!!ok,reason:text(reason)||'UNKNOWN',details:details&&typeof details==='object'?details:{}};}
function selectorKey(value){return text(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"');}
function targetFor(key,context){
  const stableKey=text(key);
  if(!stableKey)return {ok:false,reason:'KEY_REQUIRED'};
  const scope=context&&context.root;
  if(!scope||typeof scope.querySelectorAll!=='function')return {ok:false,reason:'ROOT_UNAVAILABLE'};
  let nodes=[];
  try{nodes=Array.from(scope.querySelectorAll(`[data-tour-key="${selectorKey(stableKey)}"]`)||[]);}catch(_){return {ok:false,reason:'TARGET_QUERY_FAILED'};}
  if(nodes.length===0)return {ok:false,reason:'TARGET_NOT_FOUND'};
  if(nodes.length>1)return {ok:false,reason:'TARGET_AMBIGUOUS'};
  return {ok:true,element:nodes[0],key:stableKey};
}
function visible(element){
  if(!element)return false;
  if(element.hidden===true)return false;
  try{if(typeof element.getAttribute==='function'&&text(element.getAttribute('aria-hidden')).toLowerCase()==='true')return false;}catch(_){}
  const style=element.style&&typeof element.style==='object'?element.style:{};
  if(text(style.display).toLowerCase()==='none')return false;
  if(text(style.visibility).toLowerCase()==='hidden')return false;
  return true;
}
function valueAt(source,path){
  const parts=text(path).split('.').map(text).filter(Boolean);
  if(!parts.length)return {found:false,value:undefined};
  let cursor=source;
  for(const part of parts){
    if(cursor==null||typeof cursor!=='object'||!Object.prototype.hasOwnProperty.call(cursor,part))return {found:false,value:undefined};
    cursor=cursor[part];
  }
  return {found:true,value:cursor};
}
function expected(condition){return Object.prototype.hasOwnProperty.call(condition,'equals')?condition.equals:condition.value;}

function evaluate(condition,context={}){
  const c=condition&&typeof condition==='object'?condition:{};
  const type=text(c.type);
  if(!type)return result(false,'CONDITION_TYPE_REQUIRED',{type:''});
  if(type==='element-visible'){
    const key=text(c.key||c.stableKey);
    const target=targetFor(key,context);
    if(!target.ok)return result(false,target.reason,{type,key});
    if(!visible(target.element))return result(false,'TARGET_NOT_VISIBLE',{type,key});
    return result(true,'OK',{type,key});
  }
  if(type==='field-value'){
    const key=text(c.key||c.stableKey);
    if(!key)return result(false,'KEY_REQUIRED',{type,key});
    if(!Object.prototype.hasOwnProperty.call(c,'value')&&!Object.prototype.hasOwnProperty.call(c,'equals'))return result(false,'EXPECTED_VALUE_REQUIRED',{type,key});
    const target=targetFor(key,context);
    if(!target.ok)return result(false,target.reason,{type,key});
    const actual=target.element&&Object.prototype.hasOwnProperty.call(target.element,'value')?target.element.value:undefined;
    const wanted=expected(c);
    if(String(actual==null?'':actual)!==String(wanted==null?'':wanted))return result(false,'FIELD_VALUE_MISMATCH',{type,key,actual,wanted});
    return result(true,'OK',{type,key,actual});
  }
  if(type==='state'){
    const path=text(c.path);
    if(!path)return result(false,'STATE_PATH_REQUIRED',{type,path});
    if(!Object.prototype.hasOwnProperty.call(c,'equals'))return result(false,'EXPECTED_VALUE_REQUIRED',{type,path});
    const found=valueAt(context&&context.state,path);
    if(!found.found)return result(false,'STATE_PATH_NOT_FOUND',{type,path});
    if(found.value!==c.equals)return result(false,'STATE_MISMATCH',{type,path,actual:found.value,wanted:c.equals});
    return result(true,'OK',{type,path});
  }
  if(type==='document-present'){
    const category=text(c.category);
    if(!category)return result(false,'DOCUMENT_CATEGORY_REQUIRED',{type,category});
    const wanted=category.toLowerCase();
    const docs=Array.isArray(context&&context.documents)?context.documents:[];
    const found=docs.some(doc=>[doc&&doc.category,doc&&doc.categoryCode,doc&&doc.type,doc&&doc.kind].map(text).some(value=>value.toLowerCase()===wanted));
    return found?result(true,'OK',{type,category}):result(false,'DOCUMENT_NOT_PRESENT',{type,category});
  }
  return result(false,'UNSUPPORTED_CONDITION',{type});
}

function evaluateAll(conditions,context={}){
  if(!Array.isArray(conditions))return result(false,'CONDITIONS_INVALID',{index:-1});
  for(let index=0;index<conditions.length;index++){
    const current=evaluate(conditions[index],context);
    if(!current.ok)return result(false,current.reason,Object.assign({},current.details,{index}));
  }
  return result(true,'OK',{count:conditions.length});
}

root.ExportHubSopTourValidator=Object.freeze({evaluate,evaluateAll});
})(typeof globalThis!=='undefined'?globalThis:this);
