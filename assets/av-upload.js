(function(){
'use strict';
// AV-Upload in der Sendungsansicht: speichert AVs zuerst im sicheren Azure-Archiv.
// Nach bestätigter Server-Antwort wird die lokale Aufgabenansicht sofort aktualisiert;
// die separate OneDrive-REF-Ablage kann fehlschlagen, ohne die Aufgabe zu blockieren.
if(window.__EXPORTHUB_AV_UPLOAD__)return;window.__EXPORTHUB_AV_UPLOAD__=true;
var MAX_BYTES=15*1024*1024,busy=false,scheduled=false;
function q(v){return String(v==null?'':v).trim()}
// Texte liegen in assets/i18n/av-upload.js (wird vorher geladen)
function packs(){var p=window.ExportHUBAvUploadI18n;return p&&p.packs||{de:{}}}
function lang(){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function'){var l=q(window.ExportHUBI18n.language()).toLowerCase();if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),pack=all[lang()]||all.de||{},text=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function currentShipment(){var sh=window.__EXPORTHUB_RC776_VIEW_SHIPMENT__;return sh&&typeof sh==='object'?sh:null}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase()}
function requestHeaders(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},token=q(rt.authToken),h={Accept:'application/json','Content-Type':'application/json'};if(token){h['X-ExportHUB-Token']=token;h['X-ExportHUB-Session']=token;h.Authorization='Bearer '+token}return h}
function ensureButton(){
  scheduled=false;
  var actions=document.querySelector('#rc786ReferenceFilesCard .rc786-doc-head-actions');
  if(!actions||actions.querySelector('[data-av-upload]'))return;
  var b=document.createElement('button');b.type='button';b.className='ghost';b.setAttribute('data-av-upload','1');b.textContent=t('idle');
  actions.insertBefore(b,actions.firstChild);
}
function scheduleEnsure(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||setTimeout)(ensureButton)}
function readBase64(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){var s=String(r.result||''),i=s.indexOf(',');resolve(i>=0?s.slice(i+1):s)};r.onerror=function(){reject(r.error||new Error('read'))};r.readAsDataURL(file)})}
function setLabel(button,label,disabled){if(!button)return;button.textContent=label;button.disabled=!!disabled}
function statusNotice(button,body){
  var host=button&&button.parentElement;if(!host)return;
  var notice=host.querySelector('[data-av-upload-status]');
  if(!notice){notice=document.createElement('span');notice.setAttribute('data-av-upload-status','1');notice.setAttribute('role','status');notice.className='rc786-av-upload-status';host.appendChild(notice)}
  notice.textContent=body.taskUpdatePending?t('taskPending'):(body.taskCompleted?(body.sharepointSaved?t('taskCompleted'):t('taskCompletedMirrorPending')):t('taskOpen'));
}
function reflectCompletedTask(ref,body){
  // Never mark a task completed until the server confirms the durable AV
  // archive and the transactional task update. This only patches the visible
  // in-memory projection: the server has already persisted the authoritative state.
  if(!body||body.taskCompleted!==true||body.taskUpdatePending===true)return 0;
  var state=null;try{state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():null}catch(_){}
  if(!state||!Array.isArray(state.tasks))return 0;
  var ids=[],now=new Date().toISOString();
  state.tasks.forEach(function(task){
    if(!task||q(task.sourceType)!=='av_missing')return;
    if(q(task.linkedShipmentRef||task.sourceRef).toUpperCase()!==ref)return;
    if(task.done===true&&task.completed===true)return;
    task.status='erledigt';task.done=true;task.completed=true;
    task.doneAt=now;task.completedAt=now;task.doneBy='AV-Prüfung';task.completedBy='AV-Prüfung';
    task.autoCompletedByAvCheck=true;task.updatedAt=now;
    ids.push(q(task.id));
  });
  if(ids.length){try{
    if(typeof window.dispatchEvent==='function'&&typeof window.CustomEvent==='function')
      window.dispatchEvent(new window.CustomEvent('exporthub:tasks-updated',{detail:{reason:'AV-Upload bestätigt',reference:ref,taskIds:ids}}));
  }catch(_){}}
  return ids.length;
}
async function upload(file,button){
  var ref=refOf(currentShipment());
  if(!ref||!file)return false;
  if(file.size>MAX_BYTES){window.alert(t('tooLarge'));return false}
  busy=true;setLabel(button,t('busy'),true);
  try{
    var data=await readBase64(file);
    var res=await fetch('/api/reference-files',{method:'POST',headers:requestHeaders(),credentials:'same-origin',cache:'no-store',body:JSON.stringify({action:'upload-av',reference:ref,fileName:file.name,mimeType:file.type,data:data})}),body={};
    try{body=await res.json()}catch(_){}
    if(!res.ok||body.ok===false)throw new Error(q(body.message)||('HTTP '+res.status));
    setLabel(button,t('done'),false);
    statusNotice(button,body);
    reflectCompletedTask(ref,body);
    setTimeout(function(){setLabel(button,t('idle'),false)},4000);
    var view=window.ExportHUBShipmentView;if(view&&typeof view.refreshReferenceFiles==='function')view.refreshReferenceFiles();
    return true;
  }catch(e){
    setLabel(button,t('idle'),false);
    window.alert(t('failed',{message:q(e&&e.message||e)}));
    return false;
  }finally{busy=false}
}
function pickFile(button){
  var input=document.createElement('input');input.type='file';input.accept='.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';input.style.display='none';
  input.addEventListener('change',function(){var f=input.files&&input.files[0];input.remove();if(f)upload(f,button)});
  document.body.appendChild(input);input.click();
}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-av-upload]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(!busy)pickFile(b)},true);
function start(){ensureButton();if(window.MutationObserver)new MutationObserver(scheduleEnsure).observe(document.body,{childList:true,subtree:true})}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
window.ExportHUBAvUpload=Object.freeze({version:'AV1',upload:upload,ensureButton:ensureButton});
})();
