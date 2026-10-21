/* RC1602 P0: The official signed POD is ALWAYS retrieved from the server PDF renderer.
   Intercepts explicit POD actions before legacy html2canvas capture handlers execute.
   Never fabricates a signature, mutates the shipment or falls back to an unverified screenshot. */
(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1602_OFFICIAL_POD__)return;
w.__EXPORTHUB_RC1602_OFFICIAL_POD__=true;
var SELECTOR='[data-rc628-official-pod-open="1"],[data-rc628-official-pod-download="1"],[data-index352-action="download-pod"]';
function q(x){return String(x==null?'':x).trim()}
function upper(x){return q(x).toUpperCase()}
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
 if(!id)throw Error('Es ist keine gespeicherte Sendung ausgewählt.');
 var found=candidates().find(function(sh){return q(idOf(sh))===id||upper(refOf(sh))===upper(id)});
 if(!found)throw Error('Die gespeicherte Sendung konnte nicht gefunden werden.');
 return found;
}
function token(sh){return [sh&&sh.pickupToken,sh&&sh.pickupQrToken,sh&&sh.qrPickupToken,sh&&sh.qrToken,sh&&sh.podToken].map(q).find(Boolean)||''}
function action(button){
 return button.matches('[data-rc628-official-pod-open="1"]')?'open':'download'
}
async function canonicalPdf(sh){
 var tok=token(sh);
 if(!tok)throw Error('Der QR-Abholtoken fehlt. Der unterschriebene Original-POD kann nicht sicher geladen werden.');
 var res=await w.fetch('/api/pickup-pod?file=automatic&token='+encodeURIComponent(tok),{
  method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/pdf'}
 });
 if(!res.ok){
  var why='HTTP '+res.status;
  try{var body=await res.json();why=q(body.message||body.code)||why}catch(_){}
  throw Error('Der gesicherte Original-POD ist nicht abrufbar: '+why);
 }
 var pdf=await res.blob();
 if(!pdf||pdf.size<1000)throw Error('Die originalsignierte PDF ist leer oder unvollständig.');
 var sig=new Uint8Array(await pdf.slice(0,5).arrayBuffer());
 if(sig.length!==5||sig[0]!==37||sig[1]!==80||sig[2]!==68||sig[3]!==70||sig[4]!==45)
  throw Error('Der Server hat keine gültige PDF-Datei geliefert.');
 return pdf
}
function fileName(sh){return 'POD_'+(refOf(sh)||'Sendung')+'_Ladeliste_unterschrieben.pdf'}
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
 if(mode==='open')try{popup=w.open('','_blank');if(popup){popup.document.title='Original-POD wird geladen';popup.document.body.textContent='Originalsignierte Ladeliste wird geladen …'}}catch(_){}
 try{
  sh=shipment(button);
  var qr=w.ExportHUBPickupPOD;
  if(qr&&typeof qr.syncOne==='function')try{await qr.syncOne(sh,true)}catch(_){}
  var pdf=await canonicalPdf(sh);
  openPdf(pdf,sh,mode,popup)
 }catch(e){
  if(popup&&!popup.closed)popup.close();
  if(typeof w.alert==='function')w.alert('POD konnte nicht geöffnet werden.\n\n'+q(e&&e.message||e));
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
