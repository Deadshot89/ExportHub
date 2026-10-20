(function(){
'use strict';
// AV-Upload in der Sendungsansicht: legt den Ausgangsvermerk direkt im REF-Ordner ab.
// Die AV-Prüfung (/api/av-check) erkennt ihn dort und schließt eine offene
// Aufgabe "Ausgangsvermerk nicht vorhanden" automatisch.
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
