(function(root){
  'use strict';

  var q=function(value){return String(value==null?'':value).trim()};
  var arr=function(value){return Array.isArray(value)?value:[]};
  var installed=false;
  var observer=null;
  var rerenderTimer=0;

  var TEXT={
    de:{title:'Abholkontrolle',subtitle:'Noch nicht abgeholt',open:'Offene Sendungen',print:'Kontrollliste drucken',manual:'Abholung nachtragen',manualEdit:'Abholdatum manuell eintragen / ändern',date:'Abholdatum',time:'Abholzeit',reason:'Begründung / Bemerkung',carrier:'Spedition',plate:'Kennzeichen',save:'Abholung bestätigen',cancel:'Abbrechen',saving:'Wird gespeichert …',required:'Bitte Abholdatum und Begründung angeben.',failed:'Abholung konnte nicht gespeichert werden.',physical:'physisch vorhanden',picked:'bereits abgeholt',clarify:'Klärung erforderlich',checkedBy:'Geprüft von',reference:'Referenz',customer:'Kunde / Empfänger',colli:'Colli',weight:'Gewicht',readySince:'Bereit / geplant seit',status:'Status',age:'Alter',note:'Bemerkung',actions:'Aktion',empty:'Keine offenen Abholungen vorhanden.',today:'heute',workday:'Arbeitstag',workdays:'Arbeitstage',close:'Schließen',summary:'Offene Abholungen prüfen und fehlende Bestätigungen nachtragen.'},
    en:{title:'Pickup control',subtitle:'Not yet collected',open:'Open shipments',print:'Print control list',manual:'Enter pickup',manualEdit:'Enter / change pickup date manually',date:'Pickup date',time:'Pickup time',reason:'Reason / note',carrier:'Carrier',plate:'License plate',save:'Confirm pickup',cancel:'Cancel',saving:'Saving …',required:'Please enter pickup date and reason.',failed:'Pickup could not be saved.',physical:'physically present',picked:'already collected',clarify:'clarification required',checkedBy:'Checked by',reference:'Reference',customer:'Customer / consignee',colli:'Colli',weight:'Weight',readySince:'Ready / planned since',status:'Status',age:'Age',note:'Note',actions:'Action',empty:'No open pickups.',today:'today',workday:'working day',workdays:'working days',close:'Close',summary:'Check open pickups and add missing confirmations.'},
    pl:{title:'Kontrola odbioru',subtitle:'Jeszcze nie odebrano',open:'Otwarte wysyłki',print:'Drukuj listę kontrolną',manual:'Dodaj odbiór',manualEdit:'Wpisz / zmień ręcznie datę odbioru',date:'Data odbioru',time:'Godzina odbioru',reason:'Powód / uwaga',carrier:'Przewoźnik',plate:'Nr rejestracyjny',save:'Potwierdź odbiór',cancel:'Anuluj',saving:'Zapisywanie …',required:'Podaj datę odbioru i powód.',failed:'Nie udało się zapisać odbioru.',physical:'fizycznie obecne',picked:'już odebrane',clarify:'wymaga wyjaśnienia',checkedBy:'Sprawdził(a)',reference:'Referencja',customer:'Klient / odbiorca',colli:'Colli',weight:'Waga',readySince:'Gotowe / planowane od',status:'Status',age:'Wiek',note:'Uwagi',actions:'Akcja',empty:'Brak otwartych odbiorów.',today:'dzisiaj',workday:'dzień roboczy',workdays:'dni robocze',close:'Zamknij',summary:'Sprawdź otwarte odbiory i uzupełnij brakujące potwierdzenia.'},
    es:{title:'Control de recogidas',subtitle:'Aún no recogido',open:'Envíos abiertos',print:'Imprimir lista de control',manual:'Registrar recogida',manualEdit:'Introducir / cambiar fecha de recogida manualmente',date:'Fecha de recogida',time:'Hora de recogida',reason:'Motivo / nota',carrier:'Transportista',plate:'Matrícula',save:'Confirmar recogida',cancel:'Cancelar',saving:'Guardando …',required:'Introduzca la fecha y el motivo.',failed:'No se pudo guardar la recogida.',physical:'físicamente presente',picked:'ya recogido',clarify:'requiere aclaración',checkedBy:'Revisado por',reference:'Referencia',customer:'Cliente / destinatario',colli:'Bultos',weight:'Peso',readySince:'Listo / previsto desde',status:'Estado',age:'Antigüedad',note:'Nota',actions:'Acción',empty:'No hay recogidas abiertas.',today:'hoy',workday:'día laborable',workdays:'días laborables',close:'Cerrar',summary:'Compruebe las recogidas abiertas y añada confirmaciones pendientes.'},
    fr:{title:'Contrôle des enlèvements',subtitle:'Pas encore enlevé',open:'Expéditions ouvertes',print:'Imprimer la liste de contrôle',manual:'Ajouter enlèvement',manualEdit:'Saisir / modifier manuellement la date d’enlèvement',date:'Date d’enlèvement',time:'Heure d’enlèvement',reason:'Motif / remarque',carrier:'Transporteur',plate:'Immatriculation',save:'Confirmer l’enlèvement',cancel:'Annuler',saving:'Enregistrement …',required:'Saisissez la date et le motif.',failed:'Impossible d’enregistrer l’enlèvement.',physical:'physiquement présent',picked:'déjà enlevé',clarify:'clarification nécessaire',checkedBy:'Vérifié par',reference:'Référence',customer:'Client / destinataire',colli:'Colis',weight:'Poids',readySince:'Prêt / prévu depuis',status:'Statut',age:'Âge',note:'Remarque',actions:'Action',empty:'Aucun enlèvement ouvert.',today:'aujourd’hui',workday:'jour ouvré',workdays:'jours ouvrés',close:'Fermer',summary:'Contrôlez les enlèvements ouverts et complétez les confirmations manquantes.'},
    it:{title:'Controllo ritiri',subtitle:'Non ancora ritirato',open:'Spedizioni aperte',print:'Stampa lista di controllo',manual:'Registra ritiro',manualEdit:'Inserisci / modifica manualmente la data di ritiro',date:'Data di ritiro',time:'Ora di ritiro',reason:'Motivo / nota',carrier:'Trasportatore',plate:'Targa',save:'Conferma ritiro',cancel:'Annulla',saving:'Salvataggio …',required:'Inserire data di ritiro e motivo.',failed:'Impossibile salvare il ritiro.',physical:'fisicamente presente',picked:'già ritirato',clarify:'chiarimento necessario',checkedBy:'Controllato da',reference:'Riferimento',customer:'Cliente / destinatario',colli:'Colli',weight:'Peso',readySince:'Pronto / pianificato dal',status:'Stato',age:'Età',note:'Nota',actions:'Azione',empty:'Nessun ritiro aperto.',today:'oggi',workday:'giorno lavorativo',workdays:'giorni lavorativi',close:'Chiudi',summary:'Controlla i ritiri aperti e aggiungi le conferme mancanti.'}
  };

  function lang(){
    var value='';
    try{value=q(root.ExportHUBI18n&&root.ExportHUBI18n.language||root.ExportHUBI18n&&root.ExportHUBI18n.currentLanguage||root.document&&root.document.documentElement&&root.document.documentElement.lang)}catch(_){}
    value=value.toLowerCase().slice(0,2);
    return TEXT[value]?value:'de';
  }
  function t(key){return TEXT[lang()][key]||TEXT.de[key]||key}
  function esc(value){return q(value).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
  function state(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
    return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||{};
  }
  function shipmentRef(sh){return q(sh&&(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
  function shipmentId(sh){return q(sh&&(sh.id||sh.shipmentId||sh.uuid||sh.reference||sh.ref))}
  function statusOf(sh){return q(sh&&(sh.pickupStatus||sh.processStatus||sh.shipmentStatus||sh.status))}
  function closed(sh){
    if(!sh)return true;
    if(q(sh.actualPickupDate||sh.actualPickupAt||sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.collectedAt))return true;
    return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|storniert|picked up|pod available|completed|archived|cancelled)$/i.test(statusOf(sh));
  }
  function relevantOpenStatus(sh){
    if(!sh||closed(sh))return false;
    var status=statusOf(sh).toLocaleLowerCase('de-DE');
    if(/^(?:entwurf|draft|storniert|cancelled)$/.test(status))return false;
    return /^(?:erstellt|created|bereit zur abholung|ready for pickup|wartet auf abd|waiting for abd|nachbearbeitung(?: erforderlich)?|rework(?: required)?)$/.test(status);
  }
  function uniqueShipments(source){
    var out=[],seen={};
    arr(source).forEach(function(sh){var ref=shipmentRef(sh),id=shipmentId(sh),key=ref||id;if(!key||seen[key])return;seen[key]=true;out.push(sh)});
    return out;
  }
  function shipmentsFromState(s){
    s=s||state();
    var all=[];
    ['shipments','savedShipments','salesSharedShipments','sharedShipments'].forEach(function(key){if(Array.isArray(s[key]))all=all.concat(s[key])});
    return uniqueShipments(all);
  }
  function rawReadyDate(sh){return q(sh&&(sh.warehousePreparedAt||sh.readyForPickupAt||sh.pickupReadyAt||sh.plannedPickupDate||sh.pickupDate||sh.customerAvisPickupDate||sh.createdAt))}
  function parseDate(value){
    var raw=q(value);if(!raw)return null;
    var match=raw.match(/^(\d{4})-(\d{2})-(\d{2})/),date=match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12,0,0):new Date(raw);
    return Number.isNaN(date.getTime())?null:date;
  }
  function ymd(date){if(!date||Number.isNaN(date.getTime()))return'';return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}
  function formatDate(value){var date=parseDate(value);if(!date)return q(value)||'—';return String(date.getDate()).padStart(2,'0')+'.'+String(date.getMonth()+1).padStart(2,'0')+'.'+date.getFullYear()}
  function businessDaysSince(value,nowValue){
    var start=parseDate(value),end=nowValue instanceof Date?new Date(nowValue):new Date(nowValue||Date.now());
    if(!start||Number.isNaN(end.getTime()))return 0;
    start=new Date(start.getFullYear(),start.getMonth(),start.getDate(),12);end=new Date(end.getFullYear(),end.getMonth(),end.getDate(),12);
    if(start>=end)return 0;
    var count=0,cursor=new Date(start);
    while(cursor<end){cursor.setDate(cursor.getDate()+1);var day=cursor.getDay();if(cursor<=end&&day!==0&&day!==6)count++}
    return count;
  }
  function ageLabel(days){if(!days)return t('today');return days+' '+(days===1?t('workday'):t('workdays'))}
  function urgency(days){return days>=3?'critical':days>=2?'urgent':days>=1?'warning':'normal'}
  function colliCount(sh){
    var direct=Number(sh&&(sh.totalColli||sh.colliCount||sh.packageCount));if(Number.isFinite(direct)&&direct>0)return Math.round(direct);
    var rows=[sh&&sh.rows,sh&&sh.colli,sh&&sh.collis,sh&&sh.packages].find(Array.isArray)||[];
    return rows.reduce(function(sum,row){var n=Number(row&&(row.count||row.qty||row.quantity||row.anzahl));return sum+(Number.isFinite(n)&&n>0?Math.ceil(n):1)},0);
  }
  function weight(sh){
    var direct=Number(sh&&(sh.totalWeight||sh.weight||sh.grossWeight));
    if(Number.isFinite(direct)&&direct>0)return direct;
    var rows=[sh&&sh.rows,sh&&sh.colli,sh&&sh.collis,sh&&sh.packages].find(Array.isArray)||[];
    return rows.reduce(function(sum,row){var n=Number(row&&(row.weight||row.grossWeight||row.gewicht));return sum+(Number.isFinite(n)&&n>0?n:0)},0);
  }
  function customer(sh){return q(sh&&(sh.customerName||sh.recipientName||sh.destinationName||sh.deliveryName||sh.customer&&sh.customer.name))||'—'}
  function openPickupShipments(shipments,nowValue){
    var nowDate=nowValue instanceof Date?nowValue:new Date(nowValue||Date.now());
    return uniqueShipments(shipments).filter(relevantOpenStatus).sort(function(a,b){
      var da=parseDate(rawReadyDate(a)),db=parseDate(rawReadyDate(b));
      var ta=da?da.getTime():Number.MAX_SAFE_INTEGER,tb=db?db.getTime():Number.MAX_SAFE_INTEGER;
      return ta-tb||shipmentRef(a).localeCompare(shipmentRef(b));
    }).map(function(sh){sh.__rc1546AgeDays=businessDaysSince(rawReadyDate(sh),nowDate);return sh});
  }
  function openRows(){return openPickupShipments(shipmentsFromState(),new Date())}
  function currentShipment(){var s=state();return s.currentShipment||s.shipment||s.selectedShipment||null}
  function currentEnvironment(){try{return /-testservice\./i.test(String(root.location&&root.location.hostname||''))?'testservice':'production'}catch(_){return'production'}}
  function authToken(){var runtime=root.ExportHUBClean&&root.ExportHUBClean.runtime||{};return q(runtime.authToken||runtime.sessionToken||'')}
  function apiHeaders(){
    var token=authToken(),headers={'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Environment':currentEnvironment()};
    if(token){headers['X-ExportHUB-Token']=token;headers['X-ExportHUB-Session']=token;headers.Authorization='Bearer '+token}
    return headers;
  }
  async function confirmPickup(sh,payload){
    var response=await root.fetch('/api/manual-pickup-confirm',{method:'POST',credentials:'same-origin',cache:'no-store',headers:apiHeaders(),body:JSON.stringify(Object.assign({shipmentId:shipmentId(sh),reference:shipmentRef(sh),environment:currentEnvironment()},payload))});
    var data={};try{data=await response.json()}catch(_){}
    if(!response.ok||!data.ok)throw new Error(q(data.message)||t('failed'));
    Object.assign(sh,data.values||{});
    try{root.dispatchEvent(new CustomEvent('exporthub:shipment-updated',{detail:{reference:shipmentRef(sh),manualPickupConfirmation:true}}))}catch(_){}
    try{root.dispatchEvent(new CustomEvent('exporthub:shipment-saved',{detail:{reference:shipmentRef(sh),manualPickupConfirmation:true}}))}catch(_){}
    return data;
  }

  function injectStyle(doc){
    if(!doc||doc.getElementById('exporthub-rc1546-style'))return;
    var style=doc.createElement('style');style.id='exporthub-rc1546-style';
    style.textContent='\n#rc1546PickupLauncher{position:fixed;right:18px;bottom:18px;z-index:2147481200;display:flex;gap:8px;align-items:center;padding:10px 12px;border:1px solid rgba(15,23,42,.14);border-radius:14px;background:var(--surface,#fff);color:var(--text,#0f172a);box-shadow:0 12px 34px rgba(15,23,42,.18);font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#rc1546PickupLauncher button,.rc1546-btn{border:0;border-radius:9px;padding:8px 11px;cursor:pointer;font:600 13px/1.2 inherit;background:#0f4c81;color:#fff}.rc1546-secondary{background:#e8eef5!important;color:#0f172a!important}.rc1546-count{display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:#fee2e2;color:#991b1b}.rc1546-overlay{position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px}.rc1546-dialog{width:min(1180px,96vw);max-height:92vh;overflow:auto;border-radius:18px;background:var(--surface,#fff);color:var(--text,#0f172a);box-shadow:0 28px 90px rgba(15,23,42,.32);padding:20px}.rc1546-dialog.rc1546-small{width:min(620px,96vw)}.rc1546-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.rc1546-head h2{margin:0 0 4px;font:750 22px/1.2 system-ui}.rc1546-head p{margin:0;color:#64748b}.rc1546-actions{display:flex;gap:8px;flex-wrap:wrap}.rc1546-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px;margin:12px 0 16px}.rc1546-kpi{border:1px solid #dbe4ee;border-radius:12px;padding:10px}.rc1546-kpi b{display:block;font-size:20px}.rc1546-table-wrap{overflow:auto;border:1px solid #dbe4ee;border-radius:12px}.rc1546-table{width:100%;border-collapse:collapse;font:500 12px/1.35 system-ui}.rc1546-table th,.rc1546-table td{padding:9px 8px;border-bottom:1px solid #e5eaf0;text-align:left;vertical-align:top;white-space:nowrap}.rc1546-table th{position:sticky;top:0;background:#f8fafc;z-index:1}.rc1546-table tr[data-urgency="warning"]{background:#fffbeb}.rc1546-table tr[data-urgency="urgent"]{background:#fff7ed}.rc1546-table tr[data-urgency="critical"]{background:#fef2f2}.rc1546-checks{white-space:normal!important;min-width:170px}.rc1546-checks label{display:block;margin:2px 0}.rc1546-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rc1546-form label{display:grid;gap:5px;font:650 13px/1.3 system-ui}.rc1546-form input,.rc1546-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;background:var(--surface,#fff);color:inherit;font:500 14px/1.3 system-ui}.rc1546-form .rc1546-wide{grid-column:1/-1}.rc1546-status{min-height:20px;margin-top:8px;font:600 13px/1.3 system-ui}.rc1546-print-sign{display:none}.rc1546-detail{position:fixed;right:18px;bottom:74px;z-index:2147481199}.rc1546-detail button{box-shadow:0 10px 28px rgba(15,23,42,.16)}@media(max-width:720px){.rc1546-summary{grid-template-columns:1fr 1fr}.rc1546-form{grid-template-columns:1fr}.rc1546-form .rc1546-wide{grid-column:auto}#rc1546PickupLauncher{left:10px;right:10px;bottom:10px;justify-content:space-between}}@media print{body>*:not(.rc1546-overlay){display:none!important}.rc1546-overlay{position:static!important;display:block!important;background:#fff!important;padding:0!important}.rc1546-dialog{width:100%!important;max-height:none!important;overflow:visible!important;box-shadow:none!important;border-radius:0!important;padding:0!important;color:#000!important}.rc1546-no-print,.rc1546-table .rc1546-no-print{display:none!important}.rc1546-table-wrap{overflow:visible!important;border-color:#777!important}.rc1546-table th{position:static!important;background:#eee!important}.rc1546-table th,.rc1546-table td{border-color:#aaa!important;padding:5px!important}.rc1546-print-sign{display:block!important;margin-top:26px;border-top:1px solid #777;padding-top:18px}.rc1546-checks input{appearance:none;width:11px;height:11px;border:1px solid #000;vertical-align:-1px}.rc1546-head p{color:#333!important}}';
    (doc.head||doc.documentElement).appendChild(style);
  }
  function button(doc,label,className){var b=doc.createElement('button');b.type='button';b.className='rc1546-btn '+(className||'');b.textContent=label;return b}
  function removeOverlay(){var node=root.document&&root.document.querySelector('.rc1546-overlay');if(node)node.remove()}
  function closeOnBackdrop(overlay){overlay.addEventListener('click',function(event){if(event.target===overlay)overlay.remove()})}

  function summary(rows){
    var collis=rows.reduce(function(sum,sh){return sum+colliCount(sh)},0),over1=rows.filter(function(sh){return Number(sh.__rc1546AgeDays||0)>=1}).length,critical=rows.filter(function(sh){return Number(sh.__rc1546AgeDays||0)>=3}).length;
    return{count:rows.length,collis:collis,over1:over1,critical:critical};
  }
  function rowHtml(sh,index,interactive){
    var days=Number(sh.__rc1546AgeDays||0),w=weight(sh),ready=rawReadyDate(sh);
    return '<tr data-urgency="'+urgency(days)+'"><td class="rc1546-checks"><label><input type="checkbox"> '+esc(t('physical'))+'</label><label><input type="checkbox"> '+esc(t('picked'))+'</label><label><input type="checkbox"> '+esc(t('clarify'))+'</label></td><td><b>'+esc(shipmentRef(sh))+'</b></td><td>'+esc(customer(sh))+'</td><td>'+colliCount(sh)+'</td><td>'+(w?w.toLocaleString(lang(),{maximumFractionDigits:1})+' kg':'—')+'</td><td>'+esc(formatDate(ready))+'</td><td>'+esc(statusOf(sh)||'—')+'</td><td><b>'+esc(ageLabel(days))+'</b></td><td style="min-width:130px"></td>'+(interactive?'<td class="rc1546-no-print"><button type="button" class="rc1546-btn" data-rc1546-manual="'+index+'">'+esc(t('manual'))+'</button></td>':'')+'</tr>';
  }
  function tableHtml(rows,interactive){
    return '<div class="rc1546-table-wrap"><table class="rc1546-table"><thead><tr><th>Kontrolle</th><th>'+esc(t('reference'))+'</th><th>'+esc(t('customer'))+'</th><th>'+esc(t('colli'))+'</th><th>'+esc(t('weight'))+'</th><th>'+esc(t('readySince'))+'</th><th>'+esc(t('status'))+'</th><th>'+esc(t('age'))+'</th><th>'+esc(t('note'))+'</th>'+(interactive?'<th class="rc1546-no-print">'+esc(t('actions'))+'</th>':'')+'</tr></thead><tbody>'+rows.map(function(sh,index){return rowHtml(sh,index,interactive)}).join('')+'</tbody></table></div>';
  }
  function printCurrentList(){
    if(typeof window!=='undefined'&&typeof window.print==='function')window.print();
  }
  function openControl(){
    var doc=root.document;if(!doc||!doc.body)return false;removeOverlay();injectStyle(doc);
    var rows=openRows(),stats=summary(rows),overlay=doc.createElement('div');overlay.className='rc1546-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    var panel=doc.createElement('section');panel.className='rc1546-dialog';
    panel.innerHTML='<div class="rc1546-head"><div><h2>'+esc(t('title'))+' · '+esc(t('subtitle'))+'</h2><p>'+esc(t('summary'))+'</p></div><div class="rc1546-actions rc1546-no-print"></div></div><div class="rc1546-summary"><div class="rc1546-kpi"><span>'+esc(t('open'))+'</span><b>'+stats.count+'</b></div><div class="rc1546-kpi"><span>Colli</span><b>'+stats.collis+'</b></div><div class="rc1546-kpi"><span>≥ 1 '+esc(t('workday'))+'</span><b>'+stats.over1+'</b></div><div class="rc1546-kpi"><span>≥ 3 '+esc(t('workdays'))+'</span><b>'+stats.critical+'</b></div></div>'+(rows.length?tableHtml(rows,true):'<p>'+esc(t('empty'))+'</p>')+'<div class="rc1546-print-sign"><b>'+esc(t('checkedBy'))+':</b> __________________________ &nbsp;&nbsp; <b>Datum / Uhrzeit:</b> __________________________ &nbsp;&nbsp; <b>Unterschrift:</b> __________________________</div>';
    var actionHost=panel.querySelector('.rc1546-actions'),print=button(doc,t('print')),close=button(doc,t('close'),'rc1546-secondary');
    print.addEventListener('click',printCurrentList);close.addEventListener('click',function(){overlay.remove()});actionHost.appendChild(print);actionHost.appendChild(close);
    panel.querySelectorAll('[data-rc1546-manual]').forEach(function(btn){btn.addEventListener('click',function(){var sh=rows[Number(btn.getAttribute('data-rc1546-manual'))];if(sh)openManualDialog(sh,function(){overlay.remove();openControl()})})});
    overlay.appendChild(panel);doc.body.appendChild(overlay);closeOnBackdrop(overlay);return true;
  }

  function openManualDialog(sh,onSaved){
    var doc=root.document;if(!doc||!doc.body||!sh)return false;
    var previous=doc.querySelector('.rc1546-overlay[data-kind="manual"]');if(previous)previous.remove();injectStyle(doc);
    var overlay=doc.createElement('div');overlay.className='rc1546-overlay';overlay.dataset.kind='manual';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    var panel=doc.createElement('section');panel.className='rc1546-dialog rc1546-small';
    var existingDate=q(sh.actualPickupDate),existingTime=q(sh.actualPickupTime),today=ymd(new Date());
    panel.innerHTML='<div class="rc1546-head"><div><h2>'+esc(t('manualEdit'))+'</h2><p><b>'+esc(shipmentRef(sh))+'</b> · '+esc(customer(sh))+'</p></div></div><form class="rc1546-form"><label>'+esc(t('date'))+' *<input type="date" name="pickupDate" required value="'+esc(existingDate||today)+'"></label><label>'+esc(t('time'))+'<input type="time" name="pickupTime" value="'+esc(existingTime)+'"></label><label>'+esc(t('carrier'))+'<input type="text" name="carrier" maxlength="160" value="'+esc(sh.pickupCarrierName||sh.manualPickupCarrierName||'')+'"></label><label>'+esc(t('plate'))+'<input type="text" name="plate" maxlength="60" value="'+esc(sh.pickupPlate||sh.customerAvisPickupPlate||'')+'"></label><label class="rc1546-wide">'+esc(t('reason'))+' *<textarea name="reason" rows="3" maxlength="500" required>'+esc(sh.manualPickupReason||'')+'</textarea></label><div class="rc1546-wide rc1546-actions"><button type="submit" class="rc1546-btn">'+esc(t('save'))+'</button><button type="button" class="rc1546-btn rc1546-secondary" data-cancel>'+esc(t('cancel'))+'</button></div><div class="rc1546-wide rc1546-status" role="status" aria-live="polite"></div></form>';
    var form=panel.querySelector('form'),status=panel.querySelector('.rc1546-status'),save=form.querySelector('button[type="submit"]');
    form.querySelector('[data-cancel]').addEventListener('click',function(){overlay.remove()});
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      var date=q(form.elements.pickupDate.value),time=q(form.elements.pickupTime.value),reason=q(form.elements.reason.value),carrier=q(form.elements.carrier.value),plate=q(form.elements.plate.value);
      if(!date||!reason){status.textContent=t('required');return}
      var pickupAt='';if(time){var local=new Date(date+'T'+time+':00');if(!Number.isNaN(local.getTime()))pickupAt=local.toISOString()}
      save.disabled=true;status.textContent=t('saving');
      try{
        await confirmPickup(sh,{pickupDate:date,pickupTime:time,pickupAt:pickupAt,reason:reason,carrier:carrier,plate:plate});
        overlay.remove();scheduleRender();if(typeof onSaved==='function')onSaved(sh);
      }catch(error){status.textContent=q(error&&error.message)||t('failed');save.disabled=false}
    });
    overlay.appendChild(panel);doc.body.appendChild(overlay);closeOnBackdrop(overlay);return true;
  }

  function viewName(){try{return q(root.document&&root.document.body&&root.document.body.getAttribute('data-exporthub-view')).toLowerCase()}catch(_){return''}}
  function mountOverviewLauncher(){
    var doc=root.document;if(!doc||!doc.body)return false;
    if(viewName()!=='shipmentoverview'){var old=doc.getElementById('rc1546PickupLauncher');if(old)old.remove();return false}
    var rows=openRows(),host=doc.getElementById('rc1546PickupLauncher');
    if(!host){host=doc.createElement('div');host.id='rc1546PickupLauncher';host.innerHTML='<span data-label></span><span class="rc1546-count" data-count></span>';var b=button(doc,t('print'));b.setAttribute('data-open','1');host.appendChild(b);b.addEventListener('click',openControl);doc.body.appendChild(host)}
    var label=host.querySelector('[data-label]'),count=host.querySelector('[data-count]'),open=host.querySelector('[data-open]');if(label)label.textContent=t('title');if(count)count.textContent=String(rows.length);if(open)open.textContent=t('print');return true;
  }
  function mountDetailAction(){
    var doc=root.document;if(!doc||!doc.body)return false;
    var existing=doc.getElementById('rc1546PickupDetail');
    if(viewName()!=='shipmentview'){if(existing)existing.remove();return false}
    var sh=currentShipment();if(!sh){if(existing)existing.remove();return false}
    var status=statusOf(sh).toLocaleLowerCase('de-DE');if(/^(?:storniert|cancelled|archiviert|archived)$/.test(status)){if(existing)existing.remove();return false}
    if(!existing){existing=doc.createElement('div');existing.id='rc1546PickupDetail';existing.className='rc1546-detail';var b=button(doc,t('manualEdit'));b.addEventListener('click',function(){var active=currentShipment();if(active)openManualDialog(active)});existing.appendChild(b);doc.body.appendChild(existing)}else{var btn=existing.querySelector('button');if(btn)btn.textContent=t('manualEdit')}
    return true;
  }
  function render(){var doc=root.document;if(!doc||!doc.body)return false;injectStyle(doc);mountOverviewLauncher();mountDetailAction();return true}
  function scheduleRender(){if(rerenderTimer)return;rerenderTimer=root.setTimeout(function(){rerenderTimer=0;render()},60)}
  function install(){
    if(installed)return false;installed=true;
    if(!root.document)return true;
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',render,{once:true});else render();
    ['exporthub:shipment-updated','exporthub:shipment-saved','exporthub:state-loaded','exporthub:navigation','popstate'].forEach(function(name){root.addEventListener&&root.addEventListener(name,scheduleRender)});
    if(typeof root.MutationObserver==='function'&&root.document.documentElement){observer=new root.MutationObserver(scheduleRender);observer.observe(root.document.documentElement,{attributes:true,attributeFilter:['data-exporthub-view'],subtree:true,childList:true})}
    return true;
  }

  root.ExportHUBRC1546PickupControl=Object.freeze({install:install,render:render,openPickupShipments:openPickupShipments,openControl:openControl,openManualDialog:openManualDialog,confirmPickup:confirmPickup,businessDaysSince:businessDaysSince});
  if(root.document)install();
})(typeof window!=='undefined'?window:globalThis);
