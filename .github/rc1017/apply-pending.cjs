'use strict';
const fs=require('fs');

function replaceOnce(path,from,to){
  const src=fs.readFileSync(path,'utf8');
  if(src.includes(to)) return false;
  const count=src.split(from).length-1;
  if(count!==1) throw new Error(`${path}: expected exactly one anchor, found ${count}`);
  fs.writeFileSync(path,src.replace(from,to));
  return true;
}
function insertBeforeOnce(path,anchor,insertion,marker){
  const src=fs.readFileSync(path,'utf8');
  if(marker&&src.includes(marker)) return false;
  const count=src.split(anchor).length-1;
  if(count!==1) throw new Error(`${path}: expected exactly one insertion anchor, found ${count}`);
  fs.writeFileSync(path,src.replace(anchor,insertion+'\n'+anchor));
  return true;
}
function insertAfterOnce(path,anchor,insertion,marker){
  const src=fs.readFileSync(path,'utf8');
  if(marker&&src.includes(marker)) return false;
  const count=src.split(anchor).length-1;
  if(count!==1) throw new Error(`${path}: expected exactly one insertion anchor, found ${count}`);
  fs.writeFileSync(path,src.replace(anchor,anchor+'\n'+insertion));
  return true;
}
function patchShipmentSaveBridge(path){
  const src=fs.readFileSync(path,'utf8');
  const status="if(!q(saved.status))saved.status='Entwurf';";
  const unsafe='rc1017SyncSubShipments(saved);';
  const safe="if(typeof window.rc1017SyncSubShipments!=='function')throw new Error('RC1017 Mehr-LKW-Synchronisierung ist nicht verfügbar.');window.rc1017SyncSubShipments(saved);";
  if(src.includes(safe)) return false;
  const unsafeWithStatus=unsafe+status;
  if(src.includes(unsafeWithStatus)){
    fs.writeFileSync(path,src.replace(unsafeWithStatus,safe+status));
    return true;
  }
  const count=src.split(status).length-1;
  if(count!==1) throw new Error(`${path}: expected one shipment status anchor, found ${count}`);
  fs.writeFileSync(path,src.replace(status,safe+status));
  return true;
}

let changed=false;
const calendarSource=fs.readFileSync('assets/abholkalender.js','utf8');
if(!calendarSource.includes('function calendarScalarText(value)')){
  changed=replaceOnce(
    'assets/abholkalender.js',
    "  function shipmentCustomer(shipment){ return String(shipment && (shipment.customer || shipment.customerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }",
    "  function shipmentCustomer(shipment){ return String(shipment && (shipment.customerName || shipment.customer || shipment.recipientCustomerName || shipment.recipient || shipment.locationName) || 'Ohne Kunde'); }"
  )||changed;
}

changed=replaceOnce(
  'assets/abholkalender.js',
  "    return `<article class=\"pickup-item pickup-item-shipment\"><div class=\"pickup-item-head\"><span class=\"pickup-badge pickup-badge-shipment\">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class=\"pickup-item-grid\"><span>${esc(shipmentCustomer(shipment))}</span><span>${esc(shipmentCarrier(shipment))}</span><span class=\"pickup-status\">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;",
  "    const customer = shipmentCustomer(shipment);\n    return `<article class=\"pickup-item pickup-item-shipment\"><div class=\"pickup-item-head\"><span class=\"pickup-badge pickup-badge-shipment\">SENDUNG</span><strong>${esc(shipmentRef(shipment))}</strong></div><div class=\"pickup-item-grid\"><span>Kunde: <strong>${esc(customer)}</strong></span><span>${esc(shipmentCarrier(shipment))}</span><span class=\"pickup-status\">${esc(shipmentStatus(shipment))}</span></div>${colli}${open}</article>`;"
)||changed;

changed=replaceOnce(
  'assets/abholkalender.css',
  '.pickup-badge-fix{background:rgba(245,158,11,.16);color:#9a5b00}',
  '.pickup-item-fix{background:rgba(34,197,94,.10);border-color:rgba(22,163,74,.28)}\n.pickup-item-shipment{background:rgba(37,99,235,.09);border-color:rgba(37,99,235,.26)}\n.pickup-badge-fix{background:rgba(34,197,94,.16);color:#166534}'
)||changed;

const multiTruckRuntime=`
function rc1017FitRows(rows){
 var normalized=arr(rows).map(normalizeRow).filter(function(r){return q(r.type)>''&&num(r.count)>0}),plan=buildStowPlan(normalized,currentStowVehicle());
 return{fits:num(plan.overflowCm)<=0,plan:plan}
}
function rc1017OperationalSubShipment(part){
 if(!part||typeof part!=='object')return false;
 var status=low(part.status||part.pickupStatus||part.processStatus),history=arr(part.pickupHistory),pods=arr(part.podFiles);
 return part.locked===true||history.length>0||pods.length>0||num(part.collectedPickupCollis||part.pickupCollectedColliCount)>0||!!part.confirmedAt||/partial|teilweise|confirmed|abgeholt|picked|pod|abgeschlossen|completed/.test(status)
}
function rc1017SourceSignature(target,rows){
 var vehicle=q(target&&target.stowVehicleType||target&&target.vehicleType||currentStowVehicle().id),data=arr(rows).map(function(r,index){return[index+1,q(r.id||r.rowId||r._syncId),q(r.type||r.packaging||r.verpackung),num(r.count),num(r.weight),num(r.ldm),num(r.l||r.length),num(r.w||r.width),num(r.h||r.height)]});
 return JSON.stringify({vehicle:vehicle,rows:data})
}
function renderRc1017SubShipments(result){
 var card=document.getElementById('rc380StowPlan'),count=Math.max(1,num(result&&result.requiredTruckCount||shipment().requiredTruckCount||1));
 if(card){card.setAttribute('data-rc1017-truck-count',String(count));card.setAttribute('data-rc1017-multi-truck',count>1?'1':'0')}
 return count
}
function rc1017SyncSubShipments(target){
 target=target&&typeof target==='object'?target:shipment();
 var model=window.ExportHubMultiTruck;if(!model||typeof model.planSubShipments!=='function'||typeof model.validatePartition!=='function')throw new Error('RC1017 Mehr-LKW-Modell ist nicht geladen.');
 var shipmentId=q(target.id||target.shipmentId||target.ref||target.reference),rows=completeShipmentRows(target.rows),previous=arr(target.subShipments),locked=target.multiTruckLocked===true||previous.some(rc1017OperationalSubShipment),signature=rc1017SourceSignature(target,rows);
 if(!shipmentId)throw new Error('RC1017 stabile Sendungs-ID fehlt.');
 if(locked){
  if(q(target.multiTruckSourceSignature)&&q(target.multiTruckSourceSignature)!==signature){alert('Die LKW-Aufteilung ist bereits in Verwendung. Colli, Maße, Gewicht, LDM oder Fahrzeugtyp können jetzt nicht mehr automatisch neu verteilt werden.');throw new Error('RC1017_MULTI_TRUCK_LOCKED')}
  if(previous.length)model.validatePartition(shipmentId,rows,previous);
  target.multiTruckLocked=true;target.requiredTruckCount=Math.max(1,previous.length||num(target.requiredTruckCount)||1);target.multiTruckVehicleType=q(target.multiTruckVehicleType||target.stowVehicleType||currentStowVehicle().id);target.multiTruckSourceSignature=q(target.multiTruckSourceSignature)||signature;
  renderRc1017SubShipments({requiredTruckCount:target.requiredTruckCount,subShipments:previous,locked:true});
  return{requiredTruckCount:target.requiredTruckCount,subShipments:previous,changed:false,locked:true}
 }
 var result=model.planSubShipments({shipmentId:shipmentId,rows:rows,previousSubShipments:previous,locked:false,fitRows:rc1017FitRows});
 target.requiredTruckCount=Math.max(1,num(result.requiredTruckCount)||1);target.subShipments=arr(result.subShipments);target.multiTruckLocked=false;target.multiTruckVehicleType=currentStowVehicle().id;target.multiTruckSourceSignature=signature;
 if(target.subShipments.length)model.validatePartition(shipmentId,rows,target.subShipments);
 renderRc1017SubShipments(result);
 return result
}
window.rc1017SyncSubShipments=rc1017SyncSubShipments;
`;
const activeStowRows="function stowRows(){return arr(shipment().rows).map(normalizeRow).filter(function(r){return q(r.type)>''&&num(r.count)>0})}";
changed=insertBeforeOnce('index.html',activeStowRows,multiTruckRuntime,'function rc1017SyncSubShipments(')||changed;
changed=insertBeforeOnce('index.html',activeStowRows,'window.rc1017SyncSubShipments=rc1017SyncSubShipments;','window.rc1017SyncSubShipments=rc1017SyncSubShipments;')||changed;
changed=patchShipmentSaveBridge('index.html')||changed;
changed=insertAfterOnce('index.html','<meta name="robots" content="noindex,nofollow,noarchive,nosnippet"/>','<script id="exporthub-rc1017-multi-truck" defer src="/assets/rc1017-multi-truck.js?v=1017"></script>','id="exporthub-rc1017-multi-truck"')||changed;

changed=replaceOnce('.github/rc1013/build-three-env.mjs',"const LIEFERAVIS_SRC='/assets/rc1015-lieferavis-mail-flow.js?v=1015';","const LIEFERAVIS_SRC='/assets/rc1015-lieferavis-mail-flow.js?v=1015';\nconst MULTI_TRUCK_SRC='/assets/rc1017-multi-truck.js?v=1017';")||changed;
changed=insertBeforeOnce('.github/rc1013/build-three-env.mjs','function diagnosticTags(){',"function multiTruckTag(){return `<script id=\"exporthub-rc1017-multi-truck\" defer src=\"${MULTI_TRUCK_SRC}\"><\\/script>`;}",'function multiTruckTag(){')||changed;
changed=replaceOnce('.github/rc1013/build-three-env.mjs',"out=injectBeforeHeadClose(out,diagnosticTags(),'exporthub-rc1013-diagnostics');out=injectBeforeHeadClose(out,envTag(env),'exporthub-rc1013-env-config');","out=injectBeforeHeadClose(out,diagnosticTags(),'exporthub-rc1013-diagnostics');out=injectBeforeHeadClose(out,multiTruckTag(),'exporthub-rc1017-multi-truck');out=injectBeforeHeadClose(out,envTag(env),'exporthub-rc1013-env-config');")||changed;
changed=replaceOnce('.github/rc1013/build-three-env.mjs',"copy('assets/abholkalender.js');copy('assets/abholkalender.css');copy('assets/rc1012-abholkalender-runtime.js');copy('assets/rc1013-diagnostics.js');copy('assets/rc1013-gate41-ui.js');copy('assets/rc1015-lieferavis-mail-flow.js');","copy('assets/abholkalender.js');copy('assets/abholkalender.css');copy('assets/rc1012-abholkalender-runtime.js');copy('assets/rc1013-diagnostics.js');copy('assets/rc1013-gate41-ui.js');copy('assets/rc1015-lieferavis-mail-flow.js');copy('assets/rc1017-multi-truck.js');")||changed;

console.log(changed?'RC1017 pending patch applied':'RC1017 pending patch already applied');
