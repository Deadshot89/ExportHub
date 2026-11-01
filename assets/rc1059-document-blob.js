(function(w){
 'use strict';
 function q(v){return String(v==null?'':v).trim()}
 function tr(key,vars,fallback){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function'){var v=w.ExportHUBI18n.t(key,vars);if(v&&v!==key)return v}}catch(_){}return fallback||key}
 function environment(){
  var host=q(w.location&&w.location.hostname).toLowerCase();
  if(/-testservice\./.test(host))return'testservice';
  try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},e=q(rt.environment||rt.dataEnvironment).toLowerCase();if(e==='testservice')return'testservice'}catch(_){}
  return'production';
 }
 function token(){
  try{
   var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},active=q(rt.authToken||rt.token||rt.sessionToken);
   if(active)return active;
  }catch(_){}
  // After a TESTSERVICE state refresh the runtime token can be cleared while
  // the authenticated tab session remains valid. Do not launch Microsoft login.
  try{
   var stored=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');
   if(!stored)return'';
   var session=JSON.parse(stored),value=q(session&&session.token);
   if(!value||!session.user)return'';
   var scope=q(session.environment||session.dataEnvironment).toLowerCase();
   return !scope||scope===environment()?value:'';
  }catch(_){return''}
 }
 function blobName(file){return q(file&&typeof file==='object'&&(file.blobName||file.storageBlobName))}
 function isBlobDocument(file){
  if(!file||typeof file!=='object')return false;
  var name=blobName(file),storage=q(file.storage).toLowerCase();
  // RC1705: older Packmeldungen kept the valid immutable blob reference but
  // sometimes lost the `storage` label during a state merge. The signed
  // document reference is sufficient; API auth still protects the bytes.
  if(/^rc1059\/(production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(name))return true;
  return (storage==='azure'||storage==='pod')&&/^rc995\/(production|testservice)\/[a-f0-9]{64}\/automatic\/[^/]+\.pdf$/i.test(name)
 }
 function legacyUrl(file){if(!file)return'';if(typeof file==='string')return q(file);return q(file.data||file.dataUrl||file.url||file.downloadUrl||file.contentUrl||file.href||file.objectUrl||file.link)}
 function headers(){var t=token();if(!t)throw new Error(tr('document.loginRequired',null,'ExportHUB login required.'));return{Accept:'*/*','Cache-Control':'no-cache',Authorization:'Bearer '+t,'X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'X-ExportHUB-Environment':environment()}}
 function protectedApiUrl(value){
  var raw=q(value);
  if(/^\/api\/exporthub-document(?:\?|$)/i.test(raw))return raw;
  try{
   var loc=w.location||{},base=q(loc.origin)||((q(loc.protocol)||'https:')+'//'+q(loc.hostname));
   var u=new URL(raw,base),site=new URL(base);
   if(u.origin===site.origin&&u.pathname==='/api/exporthub-document')return u.pathname+u.search;
  }catch(_){}
  return'';
 }
 function endpoint(file){if(!isBlobDocument(file))throw new Error(tr('document.invalidReference',null,'Invalid ExportHUB document reference.'));return'/api/exporthub-document?blob='+encodeURIComponent(blobName(file))+'&environment='+encodeURIComponent(environment())}
 function redirectedToLogin(r){
  if(!r)return true;
  var url=q(r.url).toLowerCase(),type=q(r.headers&&r.headers.get&&r.headers.get('content-type')).toLowerCase();
  return r.type==='opaqueredirect'||r.redirected===true||/\/(?:\.auth\/|login(?:\/|\?|$))|login\.microsoftonline\.com/.test(url)||
   (r.ok&&/^(?:text\/html|application\/xhtml\+xml)/.test(type));
 }
 async function response(file){
  var apiUrl=isBlobDocument(file)?endpoint(file):protectedApiUrl(legacyUrl(file));
  if(!apiUrl)throw new Error(tr('document.invalidReference',null,'Invalid ExportHUB document reference.'));
  // The ExportHUB token travels in the headers. Without cookies Azure treats the
  // call like the anonymous RC1702 gate probe instead of redirecting a stale
  // Microsoft sign-in cookie to login.
  var r=await w.fetch(apiUrl,{method:'GET',headers:headers(),credentials:'omit',cache:'no-store',redirect:'manual'});
  if(redirectedToLogin(r)){
   var e=new Error(tr('document.apiRedirect',null,'Der Dokumentenserver hat zur Anmeldung umgeleitet. Die bestehende ExportHUB-Sitzung bleibt erhalten; der Lieferschein wurde nicht heruntergeladen.'));
   e.code='DOCUMENT_API_LOGIN_REDIRECT';throw e;
  }
  if(!r.ok){var message=tr('document.loadFailed',null,'Document could not be loaded.');try{var j=await r.json();if(j&&j.message)message=j.message}catch(_){}throw new Error(message+' (HTTP '+r.status+')')}
  return r
 }
 async function fetchBlob(file){
  var result=await response(file),blob=await result.blob(),mime=q(blob&&blob.type).toLowerCase();
  if(/^(?:text\/html|application\/xhtml\+xml)/.test(mime)){
   var e=new Error(tr('document.apiRedirect',null,'Der Dokumentenserver hat zur Anmeldung umgeleitet. Die bestehende ExportHUB-Sitzung bleibt erhalten; der Lieferschein wurde nicht heruntergeladen.'));
   e.code='DOCUMENT_API_LOGIN_REDIRECT';throw e;
  }
  // A successful HTTP status or PDF MIME value is not proof of original bytes.
  // Prevent Microsoft login pages (also those mislabelled application/pdf).
  var name=q(file&&typeof file==='object'&&(file.name||file.fileName||file.filename));
  var declared=q(file&&typeof file==='object'&&(file.mimeType||file.contentType||file.type)).toLowerCase();
  var pdfExpected=/\.pdf$/i.test(name)||/\bpdf\b/.test(declared)||/\bpdf\b/.test(mime);
  if(pdfExpected&&typeof blob.slice==='function'&&typeof blob.arrayBuffer==='function'){
   var first=new Uint8Array(await blob.slice(0,5).arrayBuffer());
   if(first.length!==5||String.fromCharCode.apply(null,first)!=='%PDF-'){
    var invalid=new Error(tr('document.notPdf',null,'Kein gültiger PDF-Inhalt vom Dokumentenserver erhalten.'));
    invalid.code='DOCUMENT_NOT_PDF';throw invalid;
   }
  }
  return blob
 }
 async function fetchBytes(file){var b=await fetchBlob(file),buf=await b.arrayBuffer();return new Uint8Array(buf)}
 function clickUrl(url,name,download){var a=w.document.createElement('a');a.href=url;a.rel='noopener noreferrer';if(download)a.download=q(name)||tr('document.defaultName',null,'Document');else a.target='_blank';w.document.body.appendChild(a);a.click();a.remove()}
 async function open(file,options){
  options=options||{};
  if(!isBlobDocument(file)&&!protectedApiUrl(legacyUrl(file))){var old=legacyUrl(file);if(!old)throw new Error(tr('document.noContent',null,'No file content is available for this document.'));clickUrl(old,options.name||file&&file.name,options.download===true);return true}
  // Reserve the tab while the click activation is still valid: after the
  // authenticated fetch a target=_blank click is treated as a popup and blocked.
  var tab=null;
  if(options.download!==true&&typeof w.open==='function'){try{tab=w.open('about:blank','_blank')}catch(_){tab=null}}
  var blob,url;
  try{blob=await fetchBlob(file)}catch(e){closeTab(tab);throw e}
  url=w.URL.createObjectURL(blob);
  if(tab&&!tab.closed){try{tab.opener=null}catch(_){}try{tab.location.href=url}catch(_){closeTab(tab);clickUrl(url,options.name||file&&file.name,false)}}
  else clickUrl(url,options.name||file&&file.name,options.download===true);
  w.setTimeout(function(){try{w.URL.revokeObjectURL(url)}catch(_){}},120000);return true
 }
 function closeTab(tab){try{if(tab&&!tab.closed)tab.close()}catch(_){}}
 w.ExportHUBDocumentBlob1059={version:'RC1231',environment:environment,isBlobDocument:isBlobDocument,blobName:blobName,legacyUrl:legacyUrl,protectedApiUrl:protectedApiUrl,headers:headers,endpoint:endpoint,fetchBlob:fetchBlob,fetchBytes:fetchBytes,open:open};
})(window);
