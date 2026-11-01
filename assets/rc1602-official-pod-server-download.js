/* RC1602 P0: The official signed POD is ALWAYS retrieved from the server PDF renderer.
   Intercepts explicit POD actions before legacy screen-capture handlers execute.
   Never fabricates a signature, mutates the shipment or falls back to an unverified screenshot. */
(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1602_OFFICIAL_POD__)return;
w.__EXPORTHUB_RC1602_OFFICIAL_POD__=true;
var SELECTOR='[data-rc628-official-pod-open="1"],[data-rc628-official-pod-download="1"],[data-index352-action="download-pod"]';
function q(x){return String(x==null?'':x).trim()}
function upper(x){return q(x).toUpperCase()}
var MESSAGES={
 de:{notSelected:'Es ist keine gespeicherte Sendung ausgewählt.',notFound:'Die gespeicherte Sendung konnte nicht gefunden werden.',missingToken:'Der QR-Abholtoken fehlt. Der unterschriebene Original-POD kann nicht sicher geladen werden.',unavailable:'Der gesicherte Original-POD ist nicht abrufbar: ',empty:'Die originalsignierte PDF ist leer oder unvollständig.',invalid:'Der Server hat keine gültige PDF-Datei geliefert.',fallback:'Sendung',loadingTitle:'Original-POD wird geladen',loadingText:'Originalsignierte Ladeliste wird geladen …',failed:'POD konnte nicht geöffnet werden.'},
 en:{notSelected:'No saved shipment is selected.',notFound:'The saved shipment could not be found.',missingToken:'The pickup QR token is missing. The original signed POD cannot be loaded securely.',unavailable:'The original signed POD is unavailable: ',empty:'The original signed PDF is empty or incomplete.',invalid:'The server did not return a valid PDF.',fallback:'Shipment',loadingTitle:'Loading original POD',loadingText:'Loading original signed loading list …',failed:'Could not open POD.'},
 pl:{notSelected:'Nie wybrano zapisanej przesyłki.',notFound:'Nie znaleziono zapisanej przesyłki.',missingToken:'Brak tokenu QR odbioru. Nie można bezpiecznie pobrać oryginalnego podpisanego POD.',unavailable:'Oryginalny podpisany POD jest niedostępny: ',empty:'Oryginalny podpisany PDF jest pusty lub niekompletny.',invalid:'Serwer nie zwrócił poprawnego pliku PDF.',fallback:'Przesyłka',loadingTitle:'Ładowanie oryginalnego POD',loadingText:'Ładowanie oryginalnej podpisanej listy załadunkowej …',failed:'Nie udało się otworzyć POD.'},
 es:{notSelected:'No se ha seleccionado ningún envío guardado.',notFound:'No se ha encontrado el envío guardado.',missingToken:'Falta el token QR de recogida. No se puede cargar el POD original firmado de forma segura.',unavailable:'El POD original firmado no está disponible: ',empty:'El PDF original firmado está vacío o incompleto.',invalid:'El servidor no devolvió un PDF válido.',fallback:'Envío',loadingTitle:'Cargando POD original',loadingText:'Cargando lista de carga original firmada …',failed:'No se pudo abrir el POD.'},
 fr:{notSelected:'Aucun envoi enregistré sélectionné.',notFound:'Envoi enregistré introuvable.',missingToken:'Jeton QR de collecte manquant. Impossible de charger le POD original signé en toute sécurité.',unavailable:'Le POD original signé est indisponible : ',empty:'Le PDF original signé est vide ou incomplet.',invalid:'Le serveur ne renvoie pas de PDF valide.',fallback:'Envoi',loadingTitle:'Chargement du POD original',loadingText:'Chargement de la liste de chargement originale signée …',failed:'Impossible d’ouvrir le POD.'},
 it:{notSelected:'Nessuna spedizione salvata selezionata.',notFound:'Impossibile trovare la spedizione salvata.',missingToken:'Token QR del ritiro mancante. Impossibile caricare in modo sicuro il POD originale firmato.',unavailable:'Il POD originale firmato non è disponibile: ',empty:'Il PDF originale firmato è vuoto o incompleto.',invalid:'Il server non ha restituito un PDF valido.',fallback:'Spedizione',loadingTitle:'Caricamento POD originale',loadingText:'Caricamento lista di carico originale firmata …',failed:'Impossibile aprire il POD.'}
};
function t(key){var code=q((d.documentElement&&d.documentElement.lang)||(w.navigator&&w.navigator.language)||'de').slice(0,2).toLowerCase();return (MESSAGES[code]||MESSAGES.de)[key]||MESSAGES.de[key]||key}

function refOf(sh){return upper(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber))}
function idOf(sh){return q(sh&&(sh.id||sh.shipmentId||sh._syncId))}
function candidates(){
 var arr=[],a=w.ExportHUBIndex240,b=w.ExportHUBPickupPOD;
 try{if(a&&typeof a.shipments==='function')arr=arr.concat(a.shipments()||[])}catch(_){}
 try{if(b&&typeof b.shipments==='function')arr=arr.concat(b.shipments()||[])}catch(_){}
 return arr.filter(Boolean)
}
function shipment(button){
 var id=q(button&&button.dataset&&button.dataset.id);
 if(!id){
  var box=d.getElementById('rc576ShipmentSelect');id=q(box&&box.value);
 }
 if(!id)throw Error(t('notSelected'));
 var found=candidates().find(function(sh){return q(idOf(sh))===id||upper(refOf(sh))===upper(id)});
 if(!found)throw Error(t('notFound'));
 return found;
}
function token(sh){return [sh&&sh.pickupToken,sh&&sh.pickupQrToken,sh&&sh.qrPickupToken,sh&&sh.qrToken,sh&&sh.podToken].map(q).find(Boolean)||''}
function action(button){
 return button.matches('[data-rc628-official-pod-open="1"]')?'open':'download'
}
// RC1616: The already-uploaded, signed loading-list document is the source
// of truth in Shipment View. Reuse its existing authenticated open/download
// handler instead of creating a different server-rendered layout.
function storedDocumentButton(sh,mode){
 var rows=d.querySelectorAll?d.querySelectorAll('.rc786-doc-row'):[],wanted=('pod_'+refOf(sh)+'_ladeliste_mit_unterschrift.pdf').toLowerCase();
 for(var i=0;i<rows.length;i++){
  var row=rows[i],title=q(row&&row.textContent).toLowerCase();
  if(title.indexOf(wanted)<0)continue;
  var action=mode==='open'?'[data-rc786-open-file]':'[data-rc786-download-file]';
  var button=row.querySelector&&row.querySelector(action);
  if(button&&!button.disabled)return button
 }
 return null
}
function dispatchStoredDocument(sh,mode){
 var button=storedDocumentButton(sh,mode);
 if(!button)return false;
 button.click();return true
}
// A server-generated, immutable signed POD is valid even if no browser
// RC1595 PDF was attached. Its bytes are retrieved by exact file ID and
// checked by the server against the stored hash; never use file=automatic.
function verifiedPodVariant(f){
 if(!f||q(f.kind).toLowerCase()!=='automatic-pod')return '';
 var id=q(f.id||f.remoteId);
 if(!/^[A-Za-z0-9_-]{3,180}$/.test(id))return '';
 if(q(f.renderLayout).toUpperCase()==='RC1595')return 'original-layout';
 var hash=q(f.hash).toLowerCase();
 if(q(f.layoutVersion)==='RC1600-SIGNED-LOADING-LIST-V4'&&
    q(f.source)==='pickup-confirm-v3'&&
    /^[a-f0-9]{64}$/.test(hash)&&id==='automatic-pod-'+hash.slice(0,16))
  return 'server-signed';
 return '';
}
function pickVerifiedPod(files){
 var matches=(Array.isArray(files)?files:[]).filter(function(f){return !!verifiedPodVariant(f)});
 matches.sort(function(a,b){
  var ap=verifiedPodVariant(a)==='original-layout'?1:0,
      bp=verifiedPodVariant(b)==='original-layout'?1:0;
  return bp-ap||q(b.uploadedAt).localeCompare(q(a.uploadedAt))
 });
 return matches[0]||null
}
function originalFile(sh){return pickVerifiedPod(sh&&sh.podFiles)}

// RC1616: overview buttons have no rendered document rows. In that case,
// read the original signed loading-list bytes directly from the existing
// document store (inline PDF or authenticated Azure document blob).
// Token-only pickup URLs and unrelated external file links are not POD PDFs.
async function storedSignedBlob(sh){
 var ref=refOf(sh),id=idOf(sh),copies=[sh],state={};
 try{state=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__()||{}:{}}catch(_){}
 ['shipments','savedShipments','salesSharedShipments','sharedShipments'].forEach(function(key){
  var arr=state&&state[key];
  if(!Array.isArray(arr))return;
  arr.forEach(function(other){if(other&&((ref&&refOf(other)===ref)||(id&&idOf(other)===id))&&copies.indexOf(other)<0)copies.push(other)})
 });
 // P0: include both original signed loading-list names. The previous
 // selector ignored ordinary automatic PODs, forcing an obsolete QR token.
 var files=[];
 copies.forEach(function(copy){(Array.isArray(copy&&copy.podFiles)?copy.podFiles:[]).forEach(function(f){
  if(!f||/deleted|gelöscht|replaced|ersetzt|storniert/i.test(q(f.status))||f.placeholder||f.syntheticFallback)return;
  var name=q(f.name||f.fileName||f.filename),kind=q(f.kind).toLowerCase(),manual=f.manualUpload===true||/manual-upload|user-upload/.test(q(f.source).toLowerCase());
  if(kind==='scan-confirmation')return;
  var signed=/_ladeliste_mit_unterschrift\.pdf$/i.test(name);
  var automatic=kind==='automatic-pod'&&(/_ladeliste_unterschrieben\.pdf$/i.test(name)||/\/automatic\/[^/]+\.pdf$/i.test(q(f.blobName||f.storageBlobName)));
  var manualPod=manual&&/\.pdf$/i.test(name);
  if(signed||automatic||manualPod)files.push({file:f,priority:signed?3:automatic?2:1})
 })});
 files.sort(function(a,b){return b.priority-a.priority});
 files=files.map(function(x){return x.file});
 for(var i=0;i<files.length;i++){
  var file=files[i],inline=q(file.dataUrl||file.data||file.content),blob=null;
  try{
   if(/^data:application\/pdf;base64,[A-Za-z0-9+/=\s]+$/i.test(inline)){
    var response=await w.fetch(inline);
    if(response&&response.ok)blob=await response.blob()
   }else{
    var helper=w.ExportHUBDocumentBlob1059;
    if(helper&&typeof helper.isBlobDocument==='function'&&helper.isBlobDocument(file)&&typeof helper.fetchBlob==='function')
     blob=await helper.fetchBlob(file)
   }
   if(!blob||blob.size<1000||blob.size>35000000)continue;
   var sig=new Uint8Array(await blob.slice(0,5).arrayBuffer());
   if(sig.length!==5||sig[0]!==37||sig[1]!==80||sig[2]!==68||sig[3]!==70||sig[4]!==45)continue;
   // Verify bytes against recorded SHA-256 when available; do not accept a
   // mismatched original or silently substitute a newly rendered PDF.
   var expected=q(file.sha256||file.hash).toLowerCase();
   if(/^[a-f0-9]{64}$/.test(expected)){
    if(!(w.crypto&&w.crypto.subtle&&typeof w.crypto.subtle.digest==='function'))continue;
    var actual=await w.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    var bytes=Array.from(new Uint8Array(actual)),digest=bytes.map(function(x){return x.toString(16).padStart(2,'0')}).join('');
    if(digest!==expected)continue
   }
   return blob
  }catch(_){/* A missing or damaged version is never auto-regenerated. */}
 }
 return null
}
async function storedPodManifest(tok,excludedId){
 var res=await w.fetch('/api/pickup-pod?manifest=1&token='+encodeURIComponent(tok),{
  method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}
 });
 if(!res.ok)return null;
 var manifest=await res.json();
 var files=Array.isArray(manifest&&manifest.files)?manifest.files:[];
 // A missing local file ID must never be retried under a different label.
 if(excludedId)files=files.filter(function(f){return q(f&& (f.id||f.remoteId))!==excludedId});
 return pickVerifiedPod(files)
}
async function exactStoredPdf(tok,exact){
 var id=q(exact&& (exact.id||exact.remoteId));
 var res=await w.fetch('/api/pickup-pod?file='+encodeURIComponent(id)+'&token='+encodeURIComponent(tok),{
  method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/pdf'}
 });
 if(!res.ok){
  var why='HTTP '+res.status;
  try{var body=await res.json();why=q(body.message||body.code)||why}catch(_){}
  var failure=Error(t('unavailable')+why);
  failure.status=res.status;
  throw failure
 }
 var pdf=await res.blob();
 if(!pdf||pdf.size<1000)throw Error(t('empty'));
 var sig=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
 if(sig.length!==5||sig[0]!==37||sig[1]!==80||sig[2]!==68||sig[3]!==70||sig[4]!==45)
  throw Error(t('invalid'));
 return pdf
}
async function canonicalPdf(sh){
 var tok=token(sh);
 if(!tok)throw Error(t('missingToken'));
 var exact=originalFile(sh),localId=q(exact&&(exact.id||exact.remoteId));
 if(!exact)exact=await storedPodManifest(tok,'');
 if(!exact)throw Error('Keine geprüfte, gespeicherte POD-Version mit dem Ladelistenlayout vorhanden. Bitte die Original-Ladeliste unter Dateien & Dokumente öffnen.');
 try{return await exactStoredPdf(tok,exact)}
 catch(error){
  // Browser state may reference an old/missing immutable file. A fresh server
  // manifest can identify a DIFFERENT existing original, without regenerating.
  if(!localId||![404,410].includes(Number(error&&error.status)))throw error;
  var alternate=await storedPodManifest(tok,localId);
  if(!alternate)throw error;
  return exactStoredPdf(tok,alternate)
 }
}
// RC1630: If no stored original is reachable (missing QR token, no verified
// server file), use the same renderer as the working "POD als PDF
// herunterladen" action under Ladeliste & CMR. It still requires a real
// digital signature and never fabricates one.
async function renderedPdf(sh,cause){
 var docs=w.ExportHUBIndex240;
 if(!docs||typeof docs.createPodBlob!=='function')throw cause||Error(t('failed'));
 var out=await docs.createPodBlob(sh);
 if(!out||!out.blob||out.blob.size<1000)throw Error(t('empty'));
 return out.blob
}
function fileName(sh){return 'POD_'+(refOf(sh)||t('fallback'))+'_Ladeliste_unterschrieben.pdf'}
function openPdf(blob,sh,mode,popup){
 var href=URL.createObjectURL(blob);
 if(mode==='open'){
  if(popup&&!popup.closed)popup.location.replace(href);
  else{var a=d.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';d.body.appendChild(a);a.click();a.remove()}
 }else{
  var a=d.createElement('a');a.href=href;a.download=fileName(sh);a.rel='noopener';d.body.appendChild(a);a.click();a.remove()
 }
 w.setTimeout(function(){URL.revokeObjectURL(href)},120000)
}
async function handle(button){
 if(button.dataset.rc1602Busy==='1')return;
 var sh=null,popup=null,mode=action(button),old=button.textContent;
 button.dataset.rc1602Busy='1';button.disabled=true;
 if(mode==='open')try{popup=w.open('','_blank');if(popup){popup.document.title=t('loadingTitle');popup.document.body.textContent=t('loadingText')}}catch(_){}
 try{
  sh=shipment(button);
  // Prefer a verified immutable original over a delegated click which
  // returns before the document panel's asynchronous download can fail.
  var saved=await storedSignedBlob(sh);
  if(saved){openPdf(saved,sh,mode,popup);return}
  if(dispatchStoredDocument(sh,mode)){if(popup&&!popup.closed)popup.close();return}
  var qr=w.ExportHUBPickupPOD;
  if(qr&&typeof qr.syncOne==='function')try{await qr.syncOne(sh,true)}catch(_){}
  var pdf=null;
  // RC1745: a server-signed original (RC1600 V4) has the plain server layout. Show the
  // signed loading list in the website design instead whenever the driver signature
  // is available; the stored original stays untouched and remains the fallback.
  var exact=originalFile(sh);
  if(!exact||verifiedPodVariant(exact)!=='original-layout'){
   try{pdf=await renderedPdf(sh,null)}catch(_){pdf=null}
  }
  if(!pdf){
  try{pdf=await canonicalPdf(sh)}
  catch(error){pdf=await renderedPdf(sh,error)}
  }
  openPdf(pdf,sh,mode,popup)
 }catch(e){
  if(popup&&!popup.closed)popup.close();
  if(typeof w.alert==='function')w.alert(t('failed')+'\n\n'+q(e&&e.message||e));
 }finally{
  delete button.dataset.rc1602Busy;button.disabled=false;button.textContent=old;
 }
}
d.addEventListener('click',function(e){
 var button=e.target&&e.target.closest&&e.target.closest(SELECTOR);
 if(!button||button.disabled)return;
 e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
 handle(button);
},true);
w.ExportHUBRC1602OfficialPOD=Object.freeze({version:'RC1630',selector:SELECTOR,canonicalPdf:canonicalPdf,renderedPdf:renderedPdf,dispatchStoredDocument:dispatchStoredDocument,storedSignedBlob:storedSignedBlob,originalFile:originalFile});
})(window,document);
