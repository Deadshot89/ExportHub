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
