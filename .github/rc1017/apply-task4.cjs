'use strict';
const fs=require('fs');

function replaceOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(label+': erwartet 1 Treffer, gefunden '+count);
  return source.replace(search,replacement);
}

const file='api/shared/merge.js';
let src=fs.readFileSync(file,'utf8');

const oldStrip=`function stripShipmentPublicAccessSecrets(shipment) {
  if (!isObject(shipment)) return shipment;
  let next = shipment;
  for (const key of PUBLIC_ACCESS_SECRET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(shipment, key)) continue;
    if (next === shipment) next = Object.assign({}, shipment);
    delete next[key];
  }
  return next;
}`;
const newStrip=`function stripPublicAccessSecretsFromRecord(record) {
  if (!isObject(record)) return record;
  let next = record;
  for (const key of PUBLIC_ACCESS_SECRET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    if (next === record) next = Object.assign({}, record);
    delete next[key];
  }
  return next;
}

function stripShipmentPublicAccessSecrets(shipment) {
  if (!isObject(shipment)) return shipment;
  let next = stripPublicAccessSecretsFromRecord(shipment);
  const subShipments = Array.isArray(shipment.subShipments) ? shipment.subShipments : [];
  let nextSubs = subShipments;
  for (let index = 0; index < subShipments.length; index++) {
    const stripped = stripPublicAccessSecretsFromRecord(subShipments[index]);
    if (stripped === subShipments[index]) continue;
    if (nextSubs === subShipments) nextSubs = subShipments.slice();
    nextSubs[index] = stripped;
  }
  if (nextSubs !== subShipments) {
    if (next === shipment) next = Object.assign({}, shipment);
    next.subShipments = nextSubs;
  }
  return next;
}`;
if(!src.includes('function stripPublicAccessSecretsFromRecord(')){
  src=replaceOnce(src,oldStrip,newStrip,'RC1017 Public-Access-Sanitizer');
}

const marker='function mergeShipmentProtected(serverItem, incomingItem) {';
const helpers=`const RC1017_OPERATIONAL_SUBSHIPMENT_FIELDS = [
  'status','locked','pickupHistory','collectedPickupCollis','pickupCollectedColliCount',
  'remainingPickupCollis','pickupRemainingColliCount','confirmedAt','lastPartialPickupAt',
  'podFiles','signatureBlobName','signatureStoredAt','pickupRegistered','pickupAccessKeyHash'
];
const RC1017_STRUCTURAL_SUBSHIPMENT_FIELDS = [
  'subShipmentId','sequence','total','label','rows','totalColli','totalWeight','totalLdm'
];

function rc1017SubShipmentOperationalTimestamp(sub) {
  const candidates = [
    sub && sub.confirmedAt,
    sub && sub.lastPartialPickupAt,
    sub && sub.podUpdatedAt,
    sub && sub.signatureStoredAt,
    sub && sub.updatedAt
  ];
  if (Array.isArray(sub && sub.pickupHistory)) {
    for (const item of sub.pickupHistory) candidates.push(item && (item.confirmedAt || item.updatedAt || item.createdAt));
  }
  if (Array.isArray(sub && sub.podFiles)) {
    for (const item of sub.podFiles) candidates.push(item && (item.updatedAt || item.createdAt || item.storedAt));
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
  if (/partial|confirmed|pod|completed|abgeholt|teilweise/i.test(text(sub.status))) return true;
  if (Array.isArray(sub.pickupHistory) && sub.pickupHistory.length) return true;
  if (Array.isArray(sub.podFiles) && sub.podFiles.length) return true;
  if (text(sub.signatureBlobName) || text(sub.confirmedAt) || text(sub.lastPartialPickupAt)) return true;
  return false;
}

function rc1017RecordArrayKey(item, index) {
  if (!isObject(item)) return 'index:' + index + ':' + JSON.stringify(item);
  return text(item.id || item.remoteId || item.blobName || item.signatureBlobName || item.name || item.fileName) || ('index:' + index + ':' + JSON.stringify(item));
}

function rc1017MergeRecordArrays(serverList, incomingList) {
  const map = new Map();
  const ingest = (list) => {
    (Array.isArray(list) ? list : []).forEach((item, index) => {
      const key = rc1017RecordArrayKey(item, index);
      const current = map.get(key);
      if (!current) map.set(key, clone(item));
      else {
        const currentTs = rc1017SubShipmentOperationalTimestamp(current);
        const itemTs = rc1017SubShipmentOperationalTimestamp(item);
        map.set(key, clone(itemTs >= currentTs ? Object.assign({}, current, item) : Object.assign({}, item, current)));
      }
    });
  };
  ingest(serverList);
  ingest(incomingList);
  return Array.from(map.values());
}

function rc1017MergeSubShipment(serverSub, incomingSub) {
  if (!isObject(serverSub)) return clone(incomingSub);
  if (!isObject(incomingSub)) return clone(serverSub);
  const serverTs = timestamp(serverSub);
  const incomingTs = timestamp(incomingSub);
  const newer = incomingTs >= serverTs ? incomingSub : serverSub;
  const older = incomingTs >= serverTs ? serverSub : incomingSub;
  const out = clone(newer) || {};
  for (const [key, value] of Object.entries(older)) {
    if (!meaningfulValue(out[key]) && meaningfulValue(value)) out[key] = clone(value);
  }

  const serverOperational = rc1017SubShipmentOperational(serverSub);
  if (serverOperational) {
    for (const key of RC1017_STRUCTURAL_SUBSHIPMENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(serverSub, key)) out[key] = clone(serverSub[key]);
    }
  }

  const serverOpTs = rc1017SubShipmentOperationalTimestamp(serverSub);
  const incomingOpTs = rc1017SubShipmentOperationalTimestamp(incomingSub);
  const operationalSource = serverOpTs > incomingOpTs ? serverSub : incomingOpTs > serverOpTs ? incomingSub : (incomingTs >= serverTs ? incomingSub : serverSub);
  const fallbackSource = operationalSource === serverSub ? incomingSub : serverSub;
  if (serverOperational || rc1017SubShipmentOperational(incomingSub) || Math.max(serverOpTs, incomingOpTs) > 0) {
    for (const key of RC1017_OPERATIONAL_SUBSHIPMENT_FIELDS) {
      if (key === 'pickupHistory') {
        out[key] = rc1017MergeRecordArrays(serverSub[key], incomingSub[key]);
        continue;
      }
      if (key === 'podFiles') {
        out[key] = rc1017MergeRecordArrays(serverSub[key], incomingSub[key]);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(operationalSource, key)) out[key] = clone(operationalSource[key]);
      else if (Object.prototype.hasOwnProperty.call(fallbackSource, key)) out[key] = clone(fallbackSource[key]);
    }
  }
  return out;
}

function rc1017ProtectSubShipments(out, serverItem, incomingItem) {
  const serverSubs = Array.isArray(serverItem && serverItem.subShipments) ? serverItem.subShipments : [];
  const incomingSubs = Array.isArray(incomingItem && incomingItem.subShipments) ? incomingItem.subShipments : [];
  if (!serverSubs.length && !incomingSubs.length) return out;
  const serverMap = new Map(serverSubs.map((sub, index) => [text(sub && sub.subShipmentId) || ('server-index:' + index), sub]));
  const incomingMap = new Map(incomingSubs.map((sub, index) => [text(sub && sub.subShipmentId) || ('incoming-index:' + index), sub]));
  const keys = [];
  for (const key of serverMap.keys()) if (!keys.includes(key)) keys.push(key);
  for (const key of incomingMap.keys()) if (!keys.includes(key)) keys.push(key);
  const merged = keys.map((key) => rc1017MergeSubShipment(serverMap.get(key), incomingMap.get(key))).filter(Boolean);
  merged.sort((a, b) => Number(a && a.sequence || 0) - Number(b && b.sequence || 0) || text(a && a.subShipmentId).localeCompare(text(b && b.subShipmentId)));
  out.subShipments = merged;
  if (merged.length) out.requiredTruckCount = Math.max(Number(out.requiredTruckCount || 0) || 0, merged.length);
  out.multiTruckLocked = Boolean(
    serverItem && serverItem.multiTruckLocked === true ||
    incomingItem && incomingItem.multiTruckLocked === true ||
    merged.some((sub) => rc1017SubShipmentOperational(sub))
  );
  return out;
}

`;
if(!src.includes('function rc1017ProtectSubShipments(')){
  src=replaceOnce(src,marker,helpers+marker,'RC1017 Teilsendungs-Merge-Helfer');
}

if(!src.includes('rc1017ProtectSubShipments(out, serverItem, incomingItem);')){
  src=replaceOnce(
    src,
    '  rc1016ProtectAvis(out, serverItem, incomingItem);\n\n  // Status may only follow the newer persisted record; no rank-based auto-promotion here.',
    '  rc1016ProtectAvis(out, serverItem, incomingItem);\n\n  // RC1017: operative LKW-Teilsendungen sind serverseitige Geschäftsdaten und dürfen durch stale Browser nicht zurückgesetzt werden.\n  rc1017ProtectSubShipments(out, serverItem, incomingItem);\n\n  // Status may only follow the newer persisted record; no rank-based auto-promotion here.',
    'RC1017 Schutzaufruf im Shipment-Merge'
  );
}

if(!src.includes('  mergeShipmentProtected,\n')){
  src=replaceOnce(
    src,
    '  timestamp,\n  mergeCollection,',
    '  timestamp,\n  mergeShipmentProtected,\n  mergeCollection,',
    'RC1017 Merge-Export'
  );
}

fs.writeFileSync(file,src);
console.log('RC1017 Task 4 angewendet: Teilsendungs-Merge, Lock-Schutz und Token-Sanitizing aktiv.');
