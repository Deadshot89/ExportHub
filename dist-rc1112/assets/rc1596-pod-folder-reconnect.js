/* RC1596: Reconnect an existing POD emergency folder before asking the user to select it again.
 * Browser filesystem permission can expire between sessions: only request it during a user click.
 * Never claim the folder is writable without a granted permission and never write to an arbitrary directory.
 */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1596_POD_FOLDER_RECONNECT__)return;
function install(){
 var original=w.ExportHUBPODVault;
 if(!original||original.__rc1596Reconnect||typeof original.getDirectory!=='function'||typeof original.connectFolder!=='function')return false;
 var active=original;
 async function permission(handle,request){
  if(!handle||typeof handle.queryPermission!=='function')return false;
  try{
   var state=await handle.queryPermission({mode:'readwrite'});
   if(state==='granted')return true;
   if(request&&typeof handle.requestPermission==='function')return(await handle.requestPermission({mode:'readwrite'}))==='granted';
  }catch(_){}
  return false;
 }
 async function existing(){
  try{return await original.getDirectory()||null}catch(_){return null}
 }
 async function connectFolder(){
  // A click on "Notfallordner verbinden" is a user gesture. Reuse that gesture to reauthorize
  // the persisted FileSystemDirectoryHandle, rather than always opening a folder picker.
  var saved=await existing();
  if(saved&&await permission(saved,true))return saved;
  return original.connectFolder();
 }
 async function folderInfo(){
  var saved=await existing();
  if(saved)return{connected:true,name:String(saved.name||'POD-Notfallordner'),writable:await permission(saved,false),reauthorize:true};
  return original.folderInfo();
 }
 var replacement=Object.assign({},original,{__rc1596Reconnect:true,connectFolder:connectFolder,folderInfo:folderInfo});
 try{w.ExportHUBPODVault=Object.freeze(replacement)}catch(_){return false}
 w.__EXPORTHUB_RC1596_POD_FOLDER_RECONNECT__=true;
 return true;
 }
 if(!install()){
  // The original vault is declared inline in the application body; deferred scripts normally
  // run after parsing. This event covers delayed widget initialization without polling.
  if(w.document&&w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',install,{once:true});
  else w.addEventListener('exporthub:ready',install,{once:true});
 }
})(typeof window!=='undefined'?window:null);
