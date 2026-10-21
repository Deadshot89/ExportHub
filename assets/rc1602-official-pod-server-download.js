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
async function canonicalPdf(sh){
 var tok=token(sh);
 if(!tok)throw Error(t('missingToken'));
 var res=await w.fetch('/api/pickup-pod?file=automatic&token='+encodeURIComponent(tok),{
  method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/pdf'}
 });
 if(!res.ok){
  var why='HTTP '+res.status;
  try{var body=await res.json();why=q(body.message||body.code)||why}catch(_){}
  throw Error(t('unavailable')+why);
 }
 var pdf=await res.blob();
 if(!pdf||pdf.size<1000)throw Error(t('empty'));
 var sig=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
 if(sig.length!==5||sig[0]!==37||sig[1]!==80||sig[2]!==68||sig[3]!==70||sig[4]!==45)
  throw Error(t('invalid'));
 return pdf
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
  var qr=w.ExportHUBPickupPOD;
  if(qr&&typeof qr.syncOne==='function')try{await qr.syncOne(sh,true)}catch(_){}
  var pdf=await canonicalPdf(sh);
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
w.ExportHUBRC1602OfficialPOD=Object.freeze({version:'RC1602',selector:SELECTOR,canonicalPdf:canonicalPdf});
})(window,document);
