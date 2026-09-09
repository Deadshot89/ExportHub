'use strict';

function replaceOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+': erwartet 1 Treffer, gefunden '+count);
  return source.replace(search,replacement);
}
function injectDocumentHead(source,tag,label){
  const bodyAt=source.search(/<body\b/i);
  if(bodyAt<0)throw new Error(label+': kein echtes <body> gefunden');
  const headAt=source.lastIndexOf('</head>',bodyAt);
  if(headAt<0)throw new Error(label+': kein echtes </head> vor <body> gefunden');
  return source.slice(0,headAt)+tag+'\n'+source.slice(headAt);
}

const HELPERS_START='/* RC1017_MULTI_TRUCK_INTEGRATION_START */';
const HELPERS_END='/* RC1017_MULTI_TRUCK_INTEGRATION_END */';
const HELPERS=`${HELPERS_START}
function rc1017SubShipmentLocked(sh){
 sh=sh||{};
 if(sh.multiTruckLocked===true)return true;
 return arr(sh.subShipments).some(function(part){
  if(!part)return false;
  if(part.locked===true)return true;
  if(arr(part.pickupHistory).length||arr(part.podFiles).length)return true;
  if(q(part.pickupConfirmedAt||part.confirmedAt||part.pickedUpAt||part.podConfirmedAt))return true;
  if(part.pickupQrRegistered===true||q(part.pickupQrToken||part.pickupToken||part.publicAccessId||part.qrCode))return true;
  return /teil|partial|abgeholt|picked|pod|abgeschlossen|complete/i.test(q(part.status||part.pickupStatus||part.podStatus));
 })
}
function rc1017FitRows(rows){
 var normalized=arr(rows).map(normalizeRow).filter(function(r){return q(r.type)>''&&num(r.count)>0});
 if(!normalized.length)return{fits:true,plan:null,overflowCm:0};
 var plan=buildStowPlan(normalized,currentStowVehicle());
 return{fits:num(plan&&plan.overflowCm)<=0,plan:plan,overflowCm:num(plan&&plan.overflowCm)}
}
function rc1017SyncSubShipments(sh){
 sh=sh||shipment();
 var model=window.ExportHubMultiTruck;
 if(!sh||!model||typeof model.planSubShipments!=='function'||typeof model.validatePartition!=='function'){
  alert('Die Mehr-LKW-Prüfung ist nicht verfügbar. Die Sendung wurde nicht gespeichert.');
  return false
 }
 var shipmentId=q(sh.id||sh.shipmentId||sh.savedShipmentId||sh.__savedShipmentId||sh.ref||sh.reference);
 if(!shipmentId){alert('Für die Mehr-LKW-Prüfung fehlt die stabile Sendungs-ID.');return false}
 var previous=arr(sh.subShipments),locked=rc1017SubShipmentLocked(sh);
 if(locked&&previous.length){
  try{model.validatePartition(shipmentId,arr(sh.rows),previous)}catch(e){
   alert('Die LKW-Aufteilung ist bereits in Verwendung und kann nach QR-Freigabe, Abholung oder POD nicht automatisch neu verteilt werden.');
   return false
  }
 }
 var planned;
 try{
  planned=model.planSubShipments({shipmentId:shipmentId,rows:arr(sh.rows),previousSubShipments:previous,locked:locked,fitRows:rc1017FitRows});
  if(arr(planned.subShipments).length)model.validatePartition(shipmentId,arr(sh.rows),planned.subShipments)
 }catch(e){
  if(e&&e.code==='PHYSICAL_UNIT_EXCEEDS_CAPACITY')alert('Eine einzelne physische Ladeeinheit passt nicht in das ausgewählte Fahrzeug. Bitte die Ladeplanung manuell prüfen.');
  else alert('Die LKW-Aufteilung konnte nicht sicher erstellt werden: '+q(e&&e.message||e));
  return false
 }
 sh.requiredTruckCount=Math.max(1,Math.round(num(planned.requiredTruckCount)||1));
 sh.subShipments=clone(arr(planned.subShipments));
 sh.multiTruckLocked=locked||planned.locked===true;
 sh.multiTruckEnabled=sh.requiredTruckCount>1;
 sh.multiTruckSchemaVersion=1;
 sh.multiTruckStatus=typeof model.aggregateSubShipmentStatus==='function'?model.aggregateSubShipmentStatus(sh.subShipments):{};
 return true
}
function renderRc1017SubShipments(card,sh){
 if(!card)return false;
 var old=card.querySelector('#rc1017SubShipments');if(old)old.remove();
 var parts=arr(sh&&sh.subShipments),total=Math.max(parts.length,Math.round(num(sh&&sh.requiredTruckCount)||1));
 if(total<=1||!parts.length)return false;
 var box=document.createElement('div');box.id='rc1017SubShipments';box.className='rc1017-subshipments';
 var locked=sh&&sh.multiTruckLocked===true;
 box.innerHTML='<div class="rc396-graphic-head"><div><b>Mehr-LKW-Aufteilung</b><div class="muted">'+total+' separate Teilsendungen innerhalb der Hauptsendung'+(locked?' · Aufteilung gesperrt':'')+'</div></div><div class="rc396-head-pills"><span class="pill blue">'+total+' LKW</span>'+(locked?'<span class="pill gray">gesperrt</span>':'')+'</div></div><div style="display:grid;gap:8px;margin:10px 0">'+parts.map(function(part,index){var seq=Math.max(1,Math.round(num(part&&part.sequence)||index+1)),label=q(part&&part.label)||('Sendung '+seq+' von '+total),status=q(part&&part.status)||'Offen';return '<div class="notice" style="margin:0"><b>'+esc(label)+'</b> · '+Math.round(num(part&&part.totalColli))+' Colli · '+num(part&&part.totalWeight).toLocaleString('de-DE',{maximumFractionDigits:1})+' kg · '+num(part&&part.totalLdm).toLocaleString('de-DE',{maximumFractionDigits:2})+' LDM <span class="pill gray">'+esc(status)+'</span></div>'}).join('')+'</div>';
 var actions=card.querySelector('.rc396-actions');if(actions)card.insertBefore(box,actions);else card.appendChild(box);
 return true
}
${HELPERS_END}`;

function patchTask3Html(input){
  let html=String(input||'');
  if(!html.includes('id="exporthub-rc1017-multi-truck"')){
    html=injectDocumentHead(html,'<script id="exporthub-rc1017-multi-truck" defer src="/assets/rc1017-multi-truck.js?v=1017"></script>','RC1017 Modell-Asset');
  }
  if(!html.includes(HELPERS_START)){
    html=replaceOnce(html,'function renderStowPlan(){',HELPERS+'\nfunction renderStowPlan(){','RC1017 Stauplanadapter');
  }
  if(!html.includes("renderRc1017SubShipments(card,shipment());return false}")){
    html=replaceOnce(
      html,
      "rc710StowDirty=false;card.removeAttribute('data-rc710-stow-dirty');return false}",
      "rc710StowDirty=false;card.removeAttribute('data-rc710-stow-dirty');renderRc1017SubShipments(card,shipment());return false}",
      'RC1017 Stauplan Leerzustand'
    );
  }
  if(!html.includes("renderRc1017SubShipments(card,shipment());return true;}")){
    html=replaceOnce(
      html,
      "if(card.dataset.sig===sig&&card.querySelector('.rc717-shell')&&card.querySelector('#rc713VehicleType')){rc710StowDirty=false;card.removeAttribute('data-rc710-stow-dirty');return true;}",
      "if(card.dataset.sig===sig&&card.querySelector('.rc717-shell')&&card.querySelector('#rc713VehicleType')){rc710StowDirty=false;card.removeAttribute('data-rc710-stow-dirty');renderRc1017SubShipments(card,shipment());return true;}",
      'RC1017 Stauplan Cachezustand'
    );
  }
  if(!html.includes("renderRc1017SubShipments(card,shipment());\n var vs=card.querySelector('#rc713VehicleType')")){
    html=replaceOnce(html," var vs=card.querySelector('#rc713VehicleType');"," renderRc1017SubShipments(card,shipment());\n var vs=card.querySelector('#rc713VehicleType');",'RC1017 Stauplan Zusammenfassung');
  }
  if(!html.includes('rc1017SyncSubShipments(saved)')){
    html=replaceOnce(
      html,
      "rows:copy(rows)});if(!q(saved.status))saved.status='Entwurf';",
      "rows:copy(rows)});if(rc1017SyncSubShipments(saved)===false)return false;if(!q(saved.status))saved.status='Entwurf';",
      'RC1017 Persistenzhook'
    );
  }
  return html;
}

module.exports={patchTask3Html,HELPERS_START,HELPERS_END};
