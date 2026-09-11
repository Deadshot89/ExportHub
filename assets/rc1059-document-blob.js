(function(w){
 'use strict';
 function q(v){return String(v==null?'':v).trim()}
 function environment(){
  var host=q(w.location&&w.location.hostname).toLowerCase();
  if(/-testservice\./.test(host))return'testservice';
  try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},e=q(rt.environment||rt.dataEnvironment).toLowerCase();if(e==='testservice')return'testservice'}catch(_){}
  return'production';
 }
 function token(){
  try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{};return q(rt.authToken||rt.token||rt.sessionToken)}catch(_){return''}
 }
 function isBlobDocument(file){return !!(file&&typeof file==='object'&&file.storage==='blob'&&/^rc1059\/(production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(q(file.blobName)))}
 function legacyUrl(file){if(!file)return'';if(typeof file==='string')return q(file);return q(file.data||file.dataUrl||file.url||file.downloadUrl||file.contentUrl||file.href||file.objectUrl||file.link)}
 function headers(){var t=token();if(!t)throw new Error('ExportHUB-Anmeldung erforderlich.');return{Accept:'*/*','Cache-Control':'no-cache',Authorization:'Bearer '+t,'X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'X-ExportHUB-Environment':environment()}}
 function endpoint(file){if(!isBlobDocument(file))throw new Error('Ungültige ExportHUB-Dokumentreferenz.');return'/api/exporthub-document?blob='+encodeURIComponent(q(file.blobName))+'&environment='+encodeURIComponent(environment())}
 async function response(file){var r=await w.fetch(endpoint(file),{method:'GET',headers:headers(),credentials:'same-origin',cache:'no-store'});if(!r.ok){var message='Dokument konnte nicht geladen werden.';try{var j=await r.json();if(j&&j.message)message=j.message}catch(_){}throw new Error(message+' (HTTP '+r.status+')')}return r}
 async function fetchBlob(file){return(await response(file)).blob()}
 async function fetchBytes(file){var b=await fetchBlob(file),buf=await b.arrayBuffer();return new Uint8Array(buf)}
 function clickUrl(url,name,download){var a=w.document.createElement('a');a.href=url;a.rel='noopener noreferrer';if(download)a.download=q(name)||'Dokument';else a.target='_blank';w.document.body.appendChild(a);a.click();a.remove()}
 async function open(file,options){
  options=options||{};
  if(!isBlobDocument(file)){var old=legacyUrl(file);if(!old)throw new Error('Für diese Datei ist kein Dateiinhalt vorhanden.');clickUrl(old,options.name||file&&file.name,options.download===true);return true}
  var blob=await fetchBlob(file),url=w.URL.createObjectURL(blob);clickUrl(url,options.name||file&&file.name,options.download===true);w.setTimeout(function(){try{w.URL.revokeObjectURL(url)}catch(_){}},120000);return true
 }
 w.ExportHUBDocumentBlob1059={version:'RC1059',environment:environment,isBlobDocument:isBlobDocument,legacyUrl:legacyUrl,headers:headers,endpoint:endpoint,fetchBlob:fetchBlob,fetchBytes:fetchBytes,open:open};
})(window);
(function(w){
 'use strict';
 function q(v){return String(v==null?'':v).trim()}
 function isTestservice(){return /-testservice\./i.test(q(w.location&&w.location.hostname))}
 function runtime(){try{return w.ExportHUBClean&&w.ExportHUBClean.runtime||{}}catch(_){return{}}}
 function token(){var rt=runtime();return q(rt.authToken||rt.token||rt.sessionToken)}
 function headers(){var t=token();if(!t)throw new Error('ExportHUB-Anmeldung erforderlich.');return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','Authorization':'Bearer '+t,'X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'X-ExportHUB-Environment':'testservice'}}
 function humanBytes(n){n=Number(n)||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB'}
 function remove(){var old=w.document&&w.document.getElementById('rc1060MigrationControl');if(old)old.remove()}
 function install(){
  if(!isTestservice()||!w.document||!w.document.body)return;
  if(w.document.getElementById('rc1060MigrationControl'))return;
  if(!token())return;
  var box=w.document.createElement('div');
  box.id='rc1060MigrationControl';
  box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483000;background:#fff;border:1px solid #d7dee8;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:12px 14px;max-width:330px;font:13px/1.4 Arial,sans-serif;color:#172033';
  var title=w.document.createElement('div');
  title.textContent='TESTSERVICE · Dokumentmigration';
  title.style.cssText='font-weight:700;margin-bottom:7px';
  var status=w.document.createElement('div');
  status.textContent='Sicherer Test-Batch: maximal 5 Dokumente.';
  status.style.cssText='margin-bottom:9px;color:#52606f';
  var btn=w.document.createElement('button');
  btn.type='button';
  btn.textContent='5 Dokumente migrieren';
  btn.style.cssText='border:0;border-radius:8px;padding:9px 12px;background:#172033;color:#fff;font-weight:700;cursor:pointer';
  btn.addEventListener('click',async function(){
   btn.disabled=true;btn.textContent='Migration läuft …';status.textContent='Blob-Upload und Verifikation laufen.';
   try{
    var r=await w.fetch('/api/exporthub-document-migrate',{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers(),body:JSON.stringify({environment:'testservice',limit:5})});
    var data=await r.json().catch(function(){return{}});
    if(!r.ok)throw new Error(q(data.message)||('HTTP '+r.status));
    status.textContent=(data.migrated||0)+' migriert · '+(data.remaining||0)+' übrig · '+humanBytes(data.bytesMoved||0)+' verschoben'+(data.failed?(' · '+data.failed+' Fehler'):'');
    if(data.failed){status.style.color='#a32121';btn.textContent='Fehler prüfen';btn.disabled=true;return}
    if(data.done){status.style.color='#137333';btn.textContent='Migration abgeschlossen';btn.disabled=true;return}
    status.style.color='#137333';btn.textContent='Nächste 5 migrieren';btn.disabled=false;
   }catch(e){
    status.style.color='#a32121';status.textContent='Migration nicht ausgeführt: '+q(e&&e.message||e);btn.textContent='Erneut versuchen';btn.disabled=false;
   }
  });
  box.appendChild(title);box.appendChild(status);box.appendChild(btn);w.document.body.appendChild(box);
 }
 if(w.document&&w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',function(){setTimeout(install,800)});
 else setTimeout(install,800);
 var tries=0,timer=w.setInterval(function(){tries++;install();if(w.document&&w.document.getElementById('rc1060MigrationControl')||tries>60)w.clearInterval(timer)},1000);
 w.ExportHUBDocumentMigration1060={install:install,remove:remove};
})(window);
