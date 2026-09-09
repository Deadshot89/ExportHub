import fs from 'node:fs';

const file='api/shared/merge.js';
let src=fs.readFileSync(file,'utf8');
const start=src.indexOf('function mergeShipmentProtected(serverItem, incomingItem) {');
const end=src.indexOf('\nfunction normalizeTombstones(meta) {',start);
if(start<0||end<0) throw new Error('RC1017: mergeShipmentProtected block not found');

const block=`function rc1017ArrayIdentity(item,index) {
  if (!item || typeof item !== 'object') return 'index:' + index;
  return text(item.id || item.remoteId || item.fileId || item.name || item.fileName || item.kind || item.type) || ('index:' + index);
}

function rc1017MergeArray(serverValue, incomingValue) {
  const out = [], seen = new Map();
  const ingest = (list) => (Array.isArray(list) ? list : []).forEach((item, index) => {
    const key = lower(rc1017ArrayIdentity(item, index));
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, out.length);
      out.push(clone(item));
      return;
    }
    const at = seen.get(key);
    if (isObject(out[at]) && isObject(item)) out[at] = Object.assign({}, out[at], clone(item));
  });
  ingest(serverValue);
  ingest(incomingValue);
  return out;
}

function rc1017MergeObject(serverValue, incomingValue, incomingPreferred) {
  const a = isObject(serverValue) ? serverValue : {};
  const b = isObject(incomingValue) ? incomingValue : {};
  const preferred = incomingPreferred ? b : a;
  const fallback = incomingPreferred ? a : b;
  const out = clone(preferred) || {};
  for (const [key, value] of Object.entries(fallback)) {
    if (!meaningfulValue(out[key]) && meaningfulValue(value)) out[key] = clone(value);
  }
  return out;
}

function rc1017SanitizeLoadUnit(unit) {
  const out = stripShipmentPublicAccessSecrets(clone(unit) || {});
  if (out.pickup) out.pickup = stripShipmentPublicAccessSecrets(out.pickup);
  if (out.pod) out.pod = stripShipmentPublicAccessSecrets(out.pod);
  return out;
}

function rc1017MergeLoadUnit(serverUnit, incomingUnit, incomingPreferred) {
  if (!isObject(serverUnit)) return rc1017SanitizeLoadUnit(incomingUnit);
  if (!isObject(incomingUnit)) return rc1017SanitizeLoadUnit(serverUnit);
  const preferred = incomingPreferred ? incomingUnit : serverUnit;
  const fallback = incomingPreferred ? serverUnit : incomingUnit;
  const out = Object.assign({}, clone(fallback) || {}, clone(preferred) || {});
  const serverRank = shipmentStatusRank(serverUnit.status || serverUnit.processStatus);
  const incomingRank = shipmentStatusRank(incomingUnit.status || incomingUnit.processStatus);
  const chosenStatus = serverRank > incomingRank ? (serverUnit.status || serverUnit.processStatus) : (incomingRank > serverRank ? (incomingUnit.status || incomingUnit.processStatus) : (preferred.status || preferred.processStatus || fallback.status || fallback.processStatus));
  if (meaningfulValue(chosenStatus)) {
    out.status = clone(chosenStatus);
    out.processStatus = clone(chosenStatus);
  }
  out.pickup = rc1017MergeObject(serverUnit.pickup, incomingUnit.pickup, incomingPreferred);
  out.pod = rc1017MergeObject(serverUnit.pod, incomingUnit.pod, incomingPreferred);
  ['pickupHistory','podFiles','generatedDocuments'].forEach((key) => {
    const merged = rc1017MergeArray(serverUnit[key], incomingUnit[key]);
    if (merged.length) out[key] = merged;
  });
  return rc1017SanitizeLoadUnit(out);
}

function mergeMultiTruckProtected(serverValue, incomingValue, incomingPreferred) {
  const server = isObject(serverValue) ? serverValue : null;
  const incoming = isObject(incomingValue) ? incomingValue : null;
  if (!server) return incoming ? Object.assign({}, clone(incoming), { loadUnits: (Array.isArray(incoming.loadUnits) ? incoming.loadUnits : []).map(rc1017SanitizeLoadUnit) }) : null;
  if (!incoming) return Object.assign({}, clone(server), { loadUnits: (Array.isArray(server.loadUnits) ? server.loadUnits : []).map(rc1017SanitizeLoadUnit) });

  const serverVersion = Math.max(0, Number(server.splitVersion || 0) || 0);
  const incomingVersion = Math.max(0, Number(incoming.splitVersion || 0) || 0);
  const serverUnits = Array.isArray(server.loadUnits) ? server.loadUnits : [];
  const incomingUnits = Array.isArray(incoming.loadUnits) ? incoming.loadUnits : [];
  const preferred = incomingPreferred ? incoming : server;
  const fallback = incomingPreferred ? server : incoming;
  const out = rc1017MergeObject(fallback, preferred, true);

  if (!incomingUnits.length && serverUnits.length) {
    out.loadUnits = serverUnits.map(rc1017SanitizeLoadUnit);
    out.splitVersion = Math.max(serverVersion, incomingVersion);
    return out;
  }
  if (!serverUnits.length && incomingUnits.length) {
    out.loadUnits = incomingUnits.map(rc1017SanitizeLoadUnit);
    out.splitVersion = Math.max(serverVersion, incomingVersion);
    return out;
  }

  if (incomingVersion > serverVersion) {
    const result = incomingUnits.map(rc1017SanitizeLoadUnit);
    const ids = new Set(result.map((u) => lower(u && u.id)).filter(Boolean));
    serverUnits.forEach((unit) => {
      const id = lower(unit && unit.id);
      if (shipmentStatusRank(unit && (unit.status || unit.processStatus)) < 50 || (id && ids.has(id))) return;
      result.push(rc1017SanitizeLoadUnit(unit));
      if (id) ids.add(id);
    });
    out.loadUnits = result;
    out.splitVersion = incomingVersion;
    return out;
  }

  if (serverVersion > incomingVersion) {
    const result = serverUnits.map(rc1017SanitizeLoadUnit);
    const byId = new Map(result.map((u, i) => [lower(u && u.id), i]).filter((entry) => entry[0]));
    incomingUnits.forEach((unit) => {
      const id = lower(unit && unit.id);
      if (!id || !byId.has(id)) return;
      const at = byId.get(id);
      result[at] = rc1017MergeLoadUnit(result[at], unit, false);
    });
    out.loadUnits = result;
    out.splitVersion = serverVersion;
    return out;
  }

  const order = [], serverById = new Map(), incomingById = new Map();
  serverUnits.forEach((u, i) => { const id = lower(u && u.id) || ('server:' + i); serverById.set(id, u); if (!order.includes(id)) order.push(id); });
  incomingUnits.forEach((u, i) => { const id = lower(u && u.id) || ('incoming:' + i); incomingById.set(id, u); if (!order.includes(id)) order.push(id); });
  out.loadUnits = order.map((id) => rc1017MergeLoadUnit(serverById.get(id), incomingById.get(id), incomingPreferred));
  out.splitVersion = serverVersion || incomingVersion || 1;
  return out;
}

function mergeShipmentProtected(serverItem, incomingItem) {
  if (!isObject(serverItem)) return clone(incomingItem);
  if (!isObject(incomingItem)) return clone(serverItem);
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  const incomingPreferred = incomingTs >= serverTs;
  const newer = incomingPreferred ? incomingItem : serverItem;
  const older = incomingPreferred ? serverItem : incomingItem;
  const out = clone(newer) || {};

  // RC641 Bestandsschutz: a newer incomplete copy must never erase existing shipment data.
  for (const [key, value] of Object.entries(older)) {
    if (!meaningfulValue(out[key]) && meaningfulValue(value)) out[key] = clone(value);
  }

  // Rows/documents are additive-protective. Empty arrays can never wipe existing content.
  ['rows','colli','collis','packages','packagingRows','deliveryFiles','deliveryNotesFiles','podFiles','abdFiles','documents','generatedDocuments','files','attachments','mailHistory','pickupHistory'].forEach((key) => {
    const a = Array.isArray(serverItem[key]) ? serverItem[key] : [];
    const b = Array.isArray(incomingItem[key]) ? incomingItem[key] : [];
    if (!a.length && b.length) out[key] = clone(b);
    else if (a.length && !b.length) out[key] = clone(a);
    else if (a.length && b.length && key === 'rows') out[key] = clone((incomingTs >= serverTs ? b : a));
  });

  // RC1017: Teil-LKW werden verlustsicher nach stabiler loadUnit.id und splitVersion zusammengeführt.
  if (isObject(serverItem.multiTruck) || isObject(incomingItem.multiTruck)) {
    out.multiTruck = mergeMultiTruckProtected(serverItem.multiTruck, incomingItem.multiTruck, incomingPreferred);
  }

  // Status may only follow the newer persisted record; no rank-based auto-promotion here.
  const newerStatus = newer.status || newer.processStatus;
  const olderStatus = older.status || older.processStatus;
  const chosenStatus = meaningfulValue(newerStatus) ? newerStatus : olderStatus;
  if (meaningfulValue(chosenStatus)) {
    out.status = clone(chosenStatus);
    out.processStatus = clone(chosenStatus);
  }
  return out;
}
`;

src=src.slice(0,start)+block+src.slice(end);
fs.writeFileSync(file,src);
console.log('RC1017 merge patch applied');
