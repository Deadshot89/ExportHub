(function(w,d){
'use strict';
if(!w)return;
function q(v){return String(v==null?'':v).trim()}
function printName(value){
 var name=q(value);
 return /^(?:DNC|SIDE)[0-9]{6,20}\.pdf$/i.test(name)?name.replace(/\.pdf$/i,''):name
}
function cloneFile(value){
 if(typeof value==='string')return printName(value);
 if(!value||typeof value!=='object')return value;
 var out=Object.assign({},value);
 for(var i=0;i<['name','fileName','filename','originalName','title'].length;i++){
  var key=['name','fileName','filename','originalName','title'][i];
  if(typeof out[key]==='string'&&out[key].trim()){
   out[key]=printName(out[key]);
   break;
  }
 }
 if(Array.isArray(value.files))out.files=value.files.map(cloneFile);
 return out
}
function printShipment(sh){
 if(!sh||typeof sh!=='object')return sh||{};
 var out=Object.assign({},sh),fields=['deliveryFiles','deliveryNotesFiles','deliveryNoteFiles','deliveryNotes','lieferscheine','documents'];
 fields.forEach(function(field){if(Array.isArray(sh[field]))out[field]=sh[field].map(cloneFile)});
 return out
}
function install(){
 var base=w.ExportHUBRC1305LoadingListPrint;
 if(!base||typeof base.enhance!=='function'||base.__dncSidePrintNames===true)return !!base;
 var wrapped={};Object.keys(base).forEach(function(key){wrapped[key]=base[key]});
 wrapped.__dncSidePrintNames=true;
 wrapped.deliveryFiles=function(sh){return typeof base.deliveryFiles==='function'?base.deliveryFiles(printShipment(sh)):[]};
 wrapped.enhance=function(html,sh,withQr){return base.enhance(html,printShipment(sh),withQr)};
 wrapped.enhanceCover=function(html,sh){return typeof base.enhanceCover==='function'?base.enhanceCover(html,printShipment(sh)):html};
 w.ExportHUBRC1305LoadingListPrint=Object.freeze(wrapped);
 return true
}
w.ExportHUBDocumentPrintNames=Object.freeze({printName:printName,printShipment:printShipment,install:install});
if(!install()){
 if(d&&d.readyState==='loading'&&typeof d.addEventListener==='function')d.addEventListener('DOMContentLoaded',install,{once:true});
 if(typeof w.setTimeout==='function')w.setTimeout(install,0)
}
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
