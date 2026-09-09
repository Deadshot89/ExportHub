'use strict';

function text(v){return String(v==null?'':v).trim()}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
function rank(value){
 const s=text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/archiv/.test(s))return 80;
 if(/abgeschlossen|completed|erledigt|done/.test(s))return 70;
 if(/pod/.test(s))return 60;
 if(/abgeholt|picked|confirmed/.test(s))return 50;
 if(/bereit.*abhol|ready.*pickup/.test(s))return 40;
 if(/wartet.*abd/.test(s))return 30;
 if(/erstellt|created/.test(s))return 20;
 if(/entwurf|draft/.test(s))return 10;
 return 0;
}
function error(code,message,status=409){const e=new Error(message);e.code=code;e.status=status;return e}
function pickupSubjectId(shipmentId,loadUnitId,splitVersion){
 const sid=text(shipmentId),uid=text(loadUnitId),version=Math.max(0,Math.round(Number(splitVersion)||0));
 if(!uid)return sid;
 return sid+'|load:'+uid+'|split:'+version;
}
function multiTruckOf(shipment){return shipment&&shipment.multiTruck&&typeof shipment.multiTruck==='object'?shipment.multiTruck:null}
function resolveLoadUnit(shipment,loadUnitId,splitVersion){
 const uid=text(loadUnitId);
 if(!uid)return null;
 const mt=multiTruckOf(shipment);
 if(!mt)throw error('PICKUP_LOAD_UNIT_NOT_FOUND','Die angeforderte LKW-Ladeeinheit ist in dieser Sendung nicht vorhanden.',410);
 const activeVersion=Math.max(0,Math.round(Number(mt.splitVersion)||0));
 const requestedVersion=Math.max(0,Math.round(Number(splitVersion)||0));
 if(activeVersion!==requestedVersion)throw error('PICKUP_SPLIT_OUTDATED','Dieser QR-Code gehört zu einer veralteten LKW-Aufteilung. Bitte den aktuellen QR-Code verwenden.',410);
 const unit=(Array.isArray(mt.loadUnits)?mt.loadUnits:[]).find(x=>text(x&&x.id)===uid);
 if(!unit)throw error('PICKUP_LOAD_UNIT_NOT_FOUND','Die angeforderte LKW-Ladeeinheit ist nicht mehr aktiv.',410);
 return unit;
}
function buildLoadUnitSnapshot(shipment,loadUnitId,splitVersion){
 const unit=resolveLoadUnit(shipment,loadUnitId,splitVersion);
 if(!unit)return null;
 return{
  loadUnitId:text(unit.id),
  loadUnitSequence:Number(unit.sequence)||0,
  loadUnitTotal:Number(unit.total)||((multiTruckOf(shipment)&&multiTruckOf(shipment).loadUnits||[]).length),
  splitVersion:Math.max(0,Math.round(Number(splitVersion)||0)),
  rows:clone(Array.isArray(unit.rows)?unit.rows:[]),
  totalCount:Number(unit.totalCount)||0,
  totalWeightKg:Number(unit.totalWeightKg)||0,
  totalLdm:Number(unit.totalLdm)||0,
  displayLabel:text(unit.displayLabel)
 };
}
function deriveMainShipmentStatus(shipment){
 const out=clone(shipment)||{},mt=multiTruckOf(out),units=mt&&Array.isArray(mt.loadUnits)?mt.loadUnits:[];
 if(!units.length)return out;
 const allPod=units.every(u=>rank(u&&u.status)>=60);
 const allPicked=units.every(u=>rank(u&&u.status)>=50);
 if(allPod){out.status='POD vorhanden';out.processStatus='POD vorhanden';out.podAvailable=true;out.podConfirmed=true;out.pickupStatus='abgeholt'}
 else if(allPicked){out.status='Abgeholt';out.processStatus='Abgeholt';out.pickupStatus='abgeholt'}
 return out;
}
function applyPickupRecordToShipment(shipment,record){
 const out=clone(shipment)||{},r=record&&typeof record==='object'?record:{};
 const unit=resolveLoadUnit(out,r.loadUnitId,r.splitVersion),units=out.multiTruck.loadUnits;
 const at=units.findIndex(x=>text(x&&x.id)===text(unit.id));
 if(at<0)throw error('PICKUP_LOAD_UNIT_NOT_FOUND','Die LKW-Ladeeinheit konnte nicht aktualisiert werden.',410);
 const next=clone(unit)||{},history=Array.isArray(r.pickupHistory)?clone(r.pickupHistory):[],podFiles=Array.isArray(r.podFiles)?clone(r.podFiles):[];
 next.pickup=Object.assign({},next.pickup||{},r.pickup||{});
 if(history.length)next.pickup.history=history;
 if(r.confirmedAt)next.pickup.confirmedAt=r.confirmedAt;
 if(r.lastPartialPickupAt)next.pickup.lastPartialPickupAt=r.lastPartialPickupAt;
 next.pod=Object.assign({},next.pod||{},r.pod||{});
 if(podFiles.length)next.pod.files=podFiles;
 if(r.confirmedAt&&podFiles.length)next.pod.confirmedAt=r.confirmedAt;
 const complete=r.complete===true||text(r.status).toLowerCase()==='confirmed'||!!r.confirmedAt;
 const hasPod=podFiles.length>0||!!r.signatureBlobName||!!(next.pod&&next.pod.confirmedAt);
 if(complete)next.status=hasPod?'POD vorhanden':'Abgeholt';
 else if((history.length||Number(r.pickupCollectedColliCount||r.collectedPickupCollis)>0)&&rank(next.status)<50)next.status='Teilweise abgeholt';
 next.processStatus=next.status;
 next.updatedAt=text(r.updatedAt||r.confirmedAt||r.lastPartialPickupAt)||next.updatedAt;
 units[at]=next;
 return deriveMainShipmentStatus(out);
}

module.exports={pickupSubjectId,resolveLoadUnit,buildLoadUnitSnapshot,deriveMainShipmentStatus,applyPickupRecordToShipment,statusRank:rank};
