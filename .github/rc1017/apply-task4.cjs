'use strict';
const fs=require('fs');
const path='api/shared/merge.js';
let src=fs.readFileSync(path,'utf8');
function replaceOnce(from,to){
  if(src.includes(to)) return false;
  const count=src.split(from).length-1;
  if(count!==1) throw new Error(`merge.js: expected exactly one anchor, found ${count}`);
  src=src.replace(from,to);return true;
}
let changed=false;
const helpers=`function rc1017SubShipmentOperationalTimestamp(sub) {
  const candidates = [
    sub && sub.confirmedAt,
    sub && sub.lastPartialPickupAt,
    sub && sub.podUpdatedAt,
    sub && sub.signatureStoredAt,
    sub && sub.updatedAt
  ];
  if (Array.isArray(sub && sub.pickupHistory)) {
    for (const item of sub.pickupHistory) candidates.push(item && item.confirmedAt);
  }
  let latest = 0;
  for (const value of candidates) {
    const time = Date.parse(value || '');
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return latest;
}

function rc1017SubShipmentOperational(sub) {
  if (!isObject(sub)) return false;
  if (sub.locked === true) return true;
  if (Array.isArray(sub.pickupHistory) && sub.pickupHistory.length) return true;
  if (Array.isArray(sub.podFiles) && sub.podFiles.length) return true;
  if (Number(sub.collectedPickupCollis || sub.pickupCollectedColliCount || 0) > 0) return true;
  const status = lower(sub.status || sub.pickupStatus || sub.processStatus);
  return /partial|teilweise|confirmed|abgeholt|picked|pod|abgeschlossen|completed/.test(status) || rc1017SubShipmentOperationalTimestamp(sub) > 0;
}

const RC1017_SUBSHIPMENT_OPERATIONAL_FIELDS = [
  'status','pickupStatus','processStatus','locked','pickupHistory',
  'collectedPickupCollis','pickupCollectedColliCount','remainingPickupCollis','pickupRemainingColliCount',
  'confirmedAt','lastPartialPickupAt','podFiles','podUpdatedAt','signatureBlobName','signatureStoredAt',
  'pickupRegistered','pickupAccessKeyHash'
];

function rc1017ProtectSubShipments(out, serverItem, incomingItem) {
  const serverSubs = Array.isArray(serverItem && serverItem.subShipments) ? serverItem.subShipments : [];
  const incomingSubs = Array.isArray(incomingItem && incomingItem.subShipments) ? incomingItem.subShipments : [];
  if (!serverSubs.length && !incomingSubs.length) return out;

  const latestOf = (list) => list.reduce((latest, sub) => Math.max(latest, rc1017SubShipmentOperationalTimestamp(sub)), 0);
  const serverOpTs = latestOf(serverSubs);
  const incomingOpTs = latestOf(incomingSubs);
  const serverOperational = serverItem && serverItem.multiTruckLocked === true || serverSubs.some(rc1017SubShipmentOperational);
  const incomingOperational = incomingItem && incomingItem.multiTruckLocked === true || incomingSubs.some(rc1017SubShipmentOperational);

  // Before operational pickup starts, the normal shipment timestamp merge remains authoritative.
  if (!serverOperational && !incomingOperational && serverOpTs === 0 && incomingOpTs === 0) return out;

  let partitionSource = serverItem;
  let otherSource = incomingItem;
  if (incomingOpTs > serverOpTs || (incomingOpTs === serverOpTs && !serverOperational && incomingOperational)) {
    partitionSource = incomingItem;
    otherSource = serverItem;
  }
  const sourceSubs = Array.isArray(partitionSource && partitionSource.subShipments) ? partitionSource.subShipments : [];
  const otherSubs = Array.isArray(otherSource && otherSource.subShipments) ? otherSource.subShipments : [];
  const otherById = new Map(otherSubs.map(sub => [text(sub && sub.subShipmentId), sub]));

  out.subShipments = sourceSubs.map((sourceSub) => {
    const id = text(sourceSub && sourceSub.subShipmentId);
    const otherSub = otherById.get(id);
    if (!otherSub) return clone(sourceSub);
    const sourceOpTs = rc1017SubShipmentOperationalTimestamp(sourceSub);
    const otherOpTs = rc1017SubShipmentOperationalTimestamp(otherSub);
    const operationalSource = otherOpTs > sourceOpTs ? otherSub : sourceSub;
    const merged = clone(sourceSub) || {};
    for (const key of RC1017_SUBSHIPMENT_OPERATIONAL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(operationalSource, key)) merged[key] = clone(operationalSource[key]);
    }
    return merged;
  });

  out.multiTruckLocked = true;
  for (const key of ['requiredTruckCount','multiTruckVehicleType','multiTruckSourceSignature']) {
    if (Object.prototype.hasOwnProperty.call(partitionSource || {}, key)) out[key] = clone(partitionSource[key]);
  }
  return out;
}

`;
changed=replaceOnce('function mergeShipmentProtected(serverItem, incomingItem) {',helpers+'function mergeShipmentProtected(serverItem, incomingItem) {')||changed;
changed=replaceOnce('  rc1016ProtectAvis(out, serverItem, incomingItem);\n\n  // Status may only follow the newer persisted record; no rank-based auto-promotion here.','  rc1016ProtectAvis(out, serverItem, incomingItem);\n  rc1017ProtectSubShipments(out, serverItem, incomingItem);\n\n  // Status may only follow the newer persisted record; no rank-based auto-promotion here.')||changed;
changed=replaceOnce('  timestamp,\n  mergeCollection,','  timestamp,\n  mergeShipmentProtected,\n  rc1017ProtectSubShipments,\n  mergeCollection,')||changed;
if(changed) fs.writeFileSync(path,src);
console.log(changed?'RC1017 task4 patch applied':'RC1017 task4 patch already applied');
