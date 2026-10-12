(function(root){
'use strict';
if(!root||root.ExportHUBRC1499Export)return;

var observer=null,observerRoot=null,timer=0,busy={};
function q(value){return String(value==null?'':value).trim()}
function lang(){try{return root.ExportHUBI18n&&root.ExportHUBI18n.language?root.ExportHUBI18n.language():'de'}catch(_){return'de'}}
function tr(key,vars,fallback){
 try{var i=root.ExportHUBI18n;if(i&&typeof i.t==='function'){var value=i.t(key,vars,lang());if(value&&value!==key)return value}}catch(_){}
 return fallback||key
}
function authToken(){
 try{var rt=root.ExportHUBClean&&root.ExportHUBClean.runtime||{},token=q(rt.authToken||rt.sessionToken);if(token)return token}catch(_){}
 try{for(var i=0;root.sessionStorage&&i<root.sessionStorage.length;i++){var raw=root.sessionStorage.getItem(root.sessionStorage.key(i));if(!raw||raw.charAt(0)!=='{')continue;var parsed=JSON.parse(raw);if(parsed&&parsed.token)return q(parsed.token)}}catch(_){}
 return''
}
function environment(){try{return /-testservice\./i.test(String(root.location&&root.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
function headers(){
 var token=authToken();if(!token)throw new Error(tr('errors.unauthorized',null,'Unauthorized'));
 return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':environment(),'X-ExportHUB-Language':lang()}
}
function snapshot(index){
 try{var api=root.ExportHUBRC1294ABDAnalysis;return api&&typeof api.snapshot==='function'?api.snapshot(index):null}catch(_){return null}
}
function ready(data){
 data=data&&typeof data==='object'?data:{};
 var review=data.review||{},totals=data.totals||{},groups=Array.isArray(data.groups)?data.groups:[],unassigned=Array.isArray(data.unassigned)?data.unassigned:[];
 return review.complete===true&&Number(totals.difference)===0&&groups.length>0&&unassigned.length===0
}
function status(message,kind){
 var d=root.document,box=d&&d.querySelector&&d.querySelector('[data-rc1294-status]');if(!box)return;
 box.hidden=false;box.textContent=q(message);box.setAttribute('data-kind',kind||'info')
}
async function request(format,data){
 var response=await root.fetch('/api/abd-analysis/export',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify({action:'export',format:format,snapshot:data})}),raw=await response.text(),body={};
 try{body=raw?JSON.parse(raw):{}}catch(_){body={message:raw}}
 if(!response.ok){var error=new Error(q(body.message)||('HTTP '+response.status));error.code=q(body.code);throw error}
 return body
}
function decodeBase64(raw){
 var binary=root.atob(q(raw)),bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes
}
function download(file){
 if(!file||!file.base64)throw new Error('ABD_EXPORT_EMPTY');
 var d=root.document,blob=new root.Blob([decodeBase64(file.base64)],{type:q(file.mimeType)||'application/octet-stream'}),url=root.URL.createObjectURL(blob),link=d.createElement('a');
 link.href=url;link.download=q(file.name)||'ABD-Auswertung';link.style.display='none';d.body.appendChild(link);link.click();link.remove();
 root.setTimeout(function(){try{root.URL.revokeObjectURL(url)}catch(_){}},1000)
}
async function run(index,format,button){
 var key=index+':'+format;if(busy[key])return false;
 var data=snapshot(index);if(!ready(data))return false;
 busy[key]=true;if(button)button.disabled=true;
 try{var result=await request(format,data);download(result.file);return true}
 catch(error){status(tr('abd.analysis.error',{message:q(error&&error.message)},q(error&&error.message)),'bad');return false}
 finally{delete busy[key];schedule()}
}
function ensureStyle(){
 var d=root.document;if(!d||!d.createElement||d.getElementById('rc1499AbdExportStyle'))return;
 var style=d.createElement('style');style.id='rc1499AbdExportStyle';style.textContent='.rc1499-export-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.rc1499-export-actions button{min-width:62px;padding:6px 9px}.rc1499-export-actions button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:560px){.rc1499-export-actions{width:100%}.rc1499-export-actions button{flex:1}}';
 (d.head||d.documentElement).appendChild(style)
}
function enhance(){
 var d=root.document,box=d&&d.querySelector&&d.querySelector('[data-rc1294-results]');if(!box)return false;
 ensureStyle();var docs=box.querySelectorAll('.rc1294-document');
 for(var index=0;index<docs.length;index++){
  var doc=docs[index],head=doc.querySelector('.rc1294-document-head');if(!head)continue;
  var actions=head.querySelector('[data-rc1499-export-actions]');
  if(!actions){
   actions=d.createElement('div');actions.className='rc1499-export-actions';actions.setAttribute('data-rc1499-export-actions','');
   var pdf=d.createElement('button');pdf.type='button';pdf.className='ghost';pdf.textContent='PDF';pdf.setAttribute('data-rc1499-export-pdf','');pdf.setAttribute('aria-label','PDF');
   var xlsx=d.createElement('button');xlsx.type='button';xlsx.className='ghost';xlsx.textContent='XLSX';xlsx.setAttribute('data-rc1499-export-xlsx','');xlsx.setAttribute('aria-label','XLSX');
   actions.appendChild(pdf);actions.appendChild(xlsx);head.appendChild(actions)
  }
  var data=snapshot(index),enabled=ready(data),pdfButton=actions.querySelector('[data-rc1499-export-pdf]'),xlsxButton=actions.querySelector('[data-rc1499-export-xlsx]');
  pdfButton.disabled=!enabled||!!busy[index+':pdf'];xlsxButton.disabled=!enabled||!!busy[index+':xlsx'];
  pdfButton.onclick=(function(i,b){return function(){run(i,'pdf',b)}})(index,pdfButton);
  xlsxButton.onclick=(function(i,b){return function(){run(i,'xlsx',b)}})(index,xlsxButton)
 }
 return true
}
function schedule(){if(timer)return;timer=root.setTimeout?root.setTimeout(function(){timer=0;enhance()},0):0;if(!root.setTimeout)enhance()}
function disconnectObserver(){if(observer){try{observer.disconnect()}catch(_){}observer=null}observerRoot=null}
function observerHost(){
 var d=root.document;if(!d)return null;
 return d.querySelector&&d.querySelector('[data-rc1294-results]')||d.getElementById&&d.getElementById('rc1294AbdAnalysis')||d.getElementById&&d.getElementById('rc626Abd')||null
}
function bindObserver(){
 var host=observerHost();if(!host||typeof root.MutationObserver!=='function'){disconnectObserver();return false}
 if(observer&&observerRoot===host)return true;
 disconnectObserver();
 try{observer=new root.MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true});observerRoot=host;return true}catch(_){disconnectObserver();return false}
}
function mount(){
 var d=root.document;if(!d||!d.documentElement)return false;ensureStyle();schedule();bindObserver();return true
}
function remount(){if(root.setTimeout)root.setTimeout(mount,0);else mount()}

root.ExportHUBRC1499Export=Object.freeze({mount:mount,run:run,ready:ready,snapshot:snapshot});
mount();
if(typeof root.addEventListener==='function')['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync','exporthub:language-changed'].forEach(function(name){root.addEventListener(name,remount)});
})(typeof window!=='undefined'?window:globalThis);
