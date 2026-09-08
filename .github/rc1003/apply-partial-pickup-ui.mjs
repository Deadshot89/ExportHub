import fs from 'node:fs';

const file='pickup.html';
let html=fs.readFileSync(file,'utf8');

function replaceOnce(from,to,label){
  const first=html.indexOf(from);
  if(first<0)throw new Error(`RC1003 partial pickup: ${label} nicht gefunden`);
  if(html.indexOf(from,first+1)>=0)throw new Error(`RC1003 partial pickup: ${label} mehrfach gefunden`);
  html=html.slice(0,first)+to+html.slice(first+from.length);
}

replaceOnce(
  ".actions .secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}",
  ".actions .secondary{background:#fff;color:#334155;border:1px solid #cbd5e1}\n.pickup-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pickup-actions .partial{background:#fff;color:#1d4ed8;border:2px solid #60a5fa}.pickup-actions button{min-height:52px}",
  'Pickup-Aktionsstyles'
);

replaceOnce(
`<div class="box"><span>Gesamtanzahl der Sendung</span><b id="expectedColli">—</b></div>
<label>Gezählte Gesamt-Colli<input id="colli" type="number" min="1" step="1" inputmode="numeric"></label>
<button id="checkColli" type="button">Gesamtmenge prüfen</button>
<div id="colliResult" class="help">Gesamtmenge noch nicht geprüft.</div>`,
`<div class="info-grid">
<div class="box"><span>Gesamtanzahl</span><b id="expectedColli">—</b></div>
<div class="box"><span>Bereits abgeholt</span><b id="collectedColli">0</b></div>
<div class="box" style="grid-column:1/-1"><span>Noch offen</span><b id="remainingColli">—</b></div>
</div>
<label>Auf diesem LKW verladenen Colli<input id="colli" type="number" min="1" step="1" inputmode="numeric"></label>
<button id="checkColli" type="button">Eingabe prüfen</button>
<div id="colliResult" class="help">Noch keine Colli-Anzahl geprüft.</div>`,
  'Colli-Bereich'
);

replaceOnce(
  `<button id="confirm" type="submit">Abholung und POD übertragen</button>`,
  `<div class="pickup-actions"><button id="confirmPartial" class="partial" type="submit" data-mode="partial">Teilabholung bestätigen</button><button id="confirm" type="submit" data-mode="complete">Vollständige Abholung bestätigen</button></div>`,
  'Abholbuttons'
);

replaceOnce(
  `var expected=0, colliOk=false, signatureSaved='', submitting=false;`,
  `var expected=0,collectedBefore=0,remainingBefore=0,colliOk=false,signatureSaved='',submitting=false;`,
  'Pickup-Zustand'
);

replaceOnce(
`  expected=expectedCollis(data);
  details.innerHTML='<div class="info-grid"><div class="box"><span>Sendungsreferenz</span><b>'+esc(ref)+'</b></div><div class="box"><span>Kunde</span><b>'+esc(customer)+'</b></div>'+(address?'<div class="box" style="grid-column:1/-1"><span>Lieferadresse</span><b>'+esc(address)+'</b></div>':'')+'</div>';
  if(carrier)document.getElementById('carrier').value=carrier;
  if(expected>0){
    document.getElementById('colliSection').hidden=false;
    document.getElementById('expectedColli').textContent=String(expected);
  }else document.getElementById('colliSection').hidden=true;
  form.hidden=false;
  status('Sendungsdaten geladen. Bitte Abholung vollständig bestätigen.','info');`,
`  expected=expectedCollis(data);
  collectedBefore=Math.max(0,Math.round(Number(deep(data,['collectedPickupCollis','pickupCollectedColliCount']))||0));
  var explicitRemaining=deep(data,['remainingPickupCollis','pickupRemainingColliCount']);
  remainingBefore=colliNumber(explicitRemaining)||Math.max(0,expected-collectedBefore);
  details.innerHTML='<div class="info-grid"><div class="box"><span>Sendungsreferenz</span><b>'+esc(ref)+'</b></div><div class="box"><span>Kunde</span><b>'+esc(customer)+'</b></div>'+(address?'<div class="box" style="grid-column:1/-1"><span>Lieferadresse</span><b>'+esc(address)+'</b></div>':'')+'</div>';
  if(carrier)document.getElementById('carrier').value=carrier;
  if(expected>0){
    document.getElementById('colliSection').hidden=false;
    document.getElementById('expectedColli').textContent=String(expected);
    document.getElementById('collectedColli').textContent=String(collectedBefore);
    document.getElementById('remainingColli').textContent=String(remainingBefore);
    document.getElementById('colli').max=String(remainingBefore);
  }else document.getElementById('colliSection').hidden=true;
  form.hidden=false;
  status('Sendungsdaten geladen. Noch offen: '+remainingBefore+' von '+expected+' Colli.','info');`,
  'Statusanzeige'
);

replaceOnce(
`function checkColli(){
  if(!(expected>0)){colliOk=true;return true}
  var input=document.getElementById('colli'),n=colliNumber(input.value),out=document.getElementById('colliResult');
  if(n===expected){colliOk=true;out.textContent='✓ Gesamt-Colli-Anzahl stimmt: '+expected+'.';out.style.color='#166534';input.readOnly=true;return true}
  colliOk=false;out.textContent='Gesamtmenge stimmt nicht. Erwartet werden '+expected+' Colli.';out.style.color='#991b1b';input.readOnly=false;input.focus();return false;
}
document.getElementById('checkColli').addEventListener('click',checkColli);
document.getElementById('colli').addEventListener('input',function(){colliOk=false;this.readOnly=false;document.getElementById('colliResult').textContent='Gesamtmenge noch nicht geprüft.'});`,
`function checkColli(mode){
  if(!(expected>0)){colliOk=true;return true}
  var input=document.getElementById('colli'),n=colliNumber(input.value),out=document.getElementById('colliResult'),open=remainingBefore||expected;
  if(mode==='partial'){
    if(n>0&&n<open){colliOk=true;out.textContent='✓ Teilabholung: '+n+' Colli. Danach bleiben '+(open-n)+' Colli offen.';out.style.color='#166534';input.readOnly=true;return true}
    colliOk=false;out.textContent=n===open?'Die komplette Restmenge bitte mit „Vollständige Abholung bestätigen“ abschließen.':'Für eine Teilabholung bitte 1 bis '+Math.max(1,open-1)+' Colli eingeben.';out.style.color='#991b1b';input.readOnly=false;input.focus();return false;
  }
  if(n===open){colliOk=true;out.textContent='✓ Vollständige Abholung: alle '+open+' offenen Colli werden abgeschlossen.';out.style.color='#166534';input.readOnly=true;return true}
  colliOk=false;out.textContent='Für die vollständige Abholung müssen alle '+open+' noch offenen Colli bestätigt werden.';out.style.color='#991b1b';input.readOnly=false;input.focus();return false;
}
document.getElementById('checkColli').addEventListener('click',function(){var n=colliNumber(document.getElementById('colli').value),open=remainingBefore||expected;checkColli(n>0&&n<open?'partial':'complete')});
document.getElementById('colli').addEventListener('input',function(){colliOk=false;this.readOnly=false;document.getElementById('colliResult').textContent='Noch keine Colli-Anzahl geprüft.'});`,
  'Colli-Pruefung'
);

replaceOnce(
`form.addEventListener('submit',function(e){
  e.preventDefault();
  var pin=q(document.getElementById('pin').value),driver=q(document.getElementById('driver').value),plate=q(document.getElementById('plate').value),carrier=q(document.getElementById('carrier').value),sig=q(document.getElementById('signatureData').value),returned=Math.max(0,Math.round(Number(document.getElementById('returned').value||0))),entered=colliNumber(document.getElementById('colli').value),btn=document.getElementById('confirm');`,
`form.addEventListener('submit',function(e){
  e.preventDefault();
  var mode=e.submitter&&e.submitter.dataset&&e.submitter.dataset.mode==='partial'?'partial':'complete';
  var pin=q(document.getElementById('pin').value),driver=q(document.getElementById('driver').value),plate=q(document.getElementById('plate').value),carrier=q(document.getElementById('carrier').value),sig=q(document.getElementById('signatureData').value),returned=Math.max(0,Math.round(Number(document.getElementById('returned').value||0))),entered=colliNumber(document.getElementById('colli').value),btn=mode==='partial'?document.getElementById('confirmPartial'):document.getElementById('confirm');`,
  'Submit-Modus'
);

replaceOnce(
  `if(expected>0&&!checkColli()){status('Die eingegebene Gesamt-Colli-Anzahl stimmt nicht.','bad');return}`,
  `if(expected>0&&!checkColli(mode)){status(mode==='partial'?'Die Teilabholung konnte mit dieser Colli-Anzahl nicht bestätigt werden.':'Die eingegebene Rest-Colli-Anzahl stimmt nicht.','bad');return}`,
  'Submit-Colli-Pruefung'
);

replaceOnce(
  `submitting=true;btn.disabled=true;status('Abholung und POD werden übertragen …','info');`,
  `submitting=true;document.getElementById('confirmPartial').disabled=true;document.getElementById('confirm').disabled=true;status(mode==='partial'?'Teilabholung wird übertragen …':'Abholung und POD werden übertragen …','info');`,
  'Submit-Status'
);

replaceOnce(
  `var body={token:token,pin:pin,loaderPin:pin,personalLoaderPin:pin,driverName:driver,licensePlate:plate,carrierName:carrier,speditionName:carrier,carrier:carrier,spedition:carrier,signatureDataUrl:sig,returnedEuroPallets:returned,enteredColliCount:entered,colliCount:entered,expectedColliCount:expected,colliConfirmed:expected>0?colliOk:true,colliCountConfirmed:expected>0?colliOk:true,environment:env};`,
  `var body={token:token,pin:pin,loaderPin:pin,personalLoaderPin:pin,driverName:driver,licensePlate:plate,carrierName:carrier,speditionName:carrier,carrier:carrier,spedition:carrier,signatureDataUrl:sig,returnedEuroPallets:returned,enteredColliCount:entered,colliCount:entered,expectedColliCount:expected,colliConfirmed:expected>0?colliOk:true,colliCountConfirmed:expected>0?colliOk:true,pickupMode:mode,environment:env};`,
  'Pickup-Modus im Request'
);

replaceOnce(
`  request('pickup-confirm-v2',{method:'POST',body:JSON.stringify(body),timeout:45000}).then(function(data){
    submitting=false;
    var card=document.querySelector('.card');
    card.innerHTML='<div class="success"><div class="icon">✓</div><h2>Abholung erfolgreich übertragen</h2><p>Die digitale Unterschrift wurde gespeichert und der POD der Sendung zugeordnet.</p><div class="status ok">Die Bestätigung ist abgeschlossen. Dieses Fenster kann geschlossen werden.</div></div>';
  }).catch(function(err){
    submitting=false;btn.disabled=false;
    if(err.code==='COLLI_MISMATCH'||err.code==='COLLI_REQUIRED'||err.code==='COLLI_EXPECTED_MISSING'){colliOk=false;status('Die Gesamt-Colli-Anzahl wurde vom Server nicht akzeptiert. Bitte erneut zählen.','bad');return}`, 
`  request('pickup-confirm-v2',{method:'POST',body:JSON.stringify(body),timeout:45000}).then(function(data){
    submitting=false;
    var card=document.querySelector('.card');
    if(data&&data.partial){var rest=Math.max(0,Math.round(Number(data.remainingAfter)||0));card.innerHTML='<div class="success"><div class="icon">✓</div><h2>Teilabholung gespeichert</h2><p>Die Teilabholung und die Fahrerunterschrift wurden gespeichert.</p><div class="status ok">Noch offen: '+rest+' Colli. Der QR-Code bleibt für die nächste Abholung aktiv.</div></div>';return}
    card.innerHTML='<div class="success"><div class="icon">✓</div><h2>Abholung erfolgreich übertragen</h2><p>Die digitale Unterschrift wurde gespeichert und der POD der Sendung zugeordnet.</p><div class="status ok">Die vollständige Abholung ist abgeschlossen. Dieses Fenster kann geschlossen werden.</div></div>';
  }).catch(function(err){
    submitting=false;document.getElementById('confirmPartial').disabled=false;document.getElementById('confirm').disabled=false;
    if(err.code==='COLLI_MISMATCH'||err.code==='COLLI_REQUIRED'||err.code==='COLLI_EXPECTED_MISSING'||err.code==='COLLI_EXCEEDS_REMAINING'){colliOk=false;status('Die Colli-Anzahl wurde vom Server nicht akzeptiert. Bitte offene Restmenge prüfen.','bad');return}`,
  'Erfolg und Fehlerbehandlung'
);

fs.writeFileSync(file,html);
console.log('RC1003 Teilabholung UI angewendet');
