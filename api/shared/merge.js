'use strict';

const COLLECTION_KEYS = {
  shipments: ['id', 'ref'],
  tasks: ['id'],
  customers: ['id', 'account', 'customerNumber', 'name'],
  abdRequests: ['id', 'ref'],
  palletAccount: ['id', '_syncId'],
  vacations: ['id', '_syncId'],
  ideas: ['id', '_syncId'],
  customSops: ['id', 'name', '_syncId'],
  isoSops: ['id', 'number', '_syncId'],
  users: ['id', 'user', 'login', 'username', 'name']
};

const LOCAL_ONLY_KEYS = new Set([
  'view', 'q', 'taskSearch', 'taskFilter', 'taskDay', 'shipmentOverviewSearch',
  'shipmentOverviewStatus', 'selectedCustomerId', 'shipment', 'activeShipmentId',
  'currentShipment', 'selectedShipment', 'currentShipmentId', 'selectedShipmentId',
  'editingShipmentId', 'documentShipmentId', 'openShipmentId', 'customerFolderId',
  'customerFolderOpenId', 'currentCustomerId', 'selectedCustomer', 'currentCustomer',
  'shipmentDraft', 'customerDraft', 'abdDraft',
  'sopId', 'sopStep', 'academyId', 'academyStep', 'quizAnswers', 'quizStep',
  'language', 'rc438NotifySnoozeUntil', 'rc439SyncStatus'
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return String(value == null ? '' : value).trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}


const PUBLIC_ACCESS_SECRET_KEYS = ['customerAvisToken','avisToken','customerAvisPublicUrl','avisPublicUrl','pickupToken','pickupQrToken','qrToken'];
function stripShipmentPublicAccessSecrets(shipment) {
  if (!isObject(shipment)) return shipment;
  let next = shipment;
  for (const key of PUBLIC_ACCESS_SECRET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(shipment, key)) continue;
    if (next === shipment) next = Object.assign({}, shipment);
    delete next[key];
  }
  return next;
}

function stripPublicAccessSecrets(state) {
  if (!isObject(state)) return state;
  let out = state;
  const assign = (key, value) => {
    if (out === state) out = Object.assign({}, state);
    out[key] = value;
  };

  ['shipments','savedShipments','shipmentArchive','archivedShipments'].forEach((key) => {
    const list = state[key];
    if (!Array.isArray(list)) return;
    let nextList = list;
    for (let index = 0; index < list.length; index++) {
      const stripped = stripShipmentPublicAccessSecrets(list[index]);
      if (stripped === list[index]) continue;
      if (nextList === list) nextList = list.slice();
      nextList[index] = stripped;
    }
    if (nextList !== list) assign(key, nextList);
  });

  ['shipment','currentShipment','selectedShipment'].forEach((key) => {
    const shipment = state[key];
    if (!isObject(shipment)) return;
    const stripped = stripShipmentPublicAccessSecrets(shipment);
    if (stripped !== shipment) assign(key, stripped);
  });
  return out;
}

function itemKey(item, fields, fallbackIndex) {
  if (!item || typeof item !== 'object') return `index:${fallbackIndex}`;
  for (const field of fields || []) {
    const value = text(item[field]);
    if (value) return `${field}:${lower(value)}`;
  }
  return `index:${fallbackIndex}`;
}

function shipmentIdentityKey(item, fallbackIndex) {
  if (!item || typeof item !== 'object') return `index:${fallbackIndex}`;
  const refFields = ['ref', 'reference', 'shipmentRef', 'referenceNumber', 'referenceNo', 'refNo', 'refNr', 'sendungsnummer', 'exporthubRef', 'exportHubReference'];
  for (const field of refFields) {
    const value = text(item[field]);
    if (value) return `ref:${lower(value)}`;
  }
  const id = text(item.id || item.shipmentId || item._syncId);
  return id ? `id:${lower(id)}` : `index:${fallbackIndex}`;
}

function timestamp(value) {
  const candidates = [
    value && value._syncUpdatedAt,
    value && value.updatedAt,
    value && value.editedAt,
    value && value.modifiedAt,
    value && value.completedAt,
    value && value.savedAt,
    value && value.createdAt
  ];
  for (const candidate of candidates) {
    const time = Date.parse(candidate || '');
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

function taskDone(item) {
  return Boolean(item && (item.done === true || /erledigt|done|completed|abgeschlossen/i.test(text(item.status))));
}


function norm(value) {
  return lower(value).replace(/\s+/g, ' ').replace(/[^a-z0-9äöüß|:_-]+/gi, '');
}

function taskLedgerKeys(task, index) {
  const out = [];
  const add = (prefix, value) => {
    const v = norm(value);
    if (v && !out.includes(prefix + v)) out.push(prefix + v);
  };
  if (task) {
    add('id:', task.id);
    add('sync:', task._syncId);
    add('biz:', [
      task.title || task.name,
      task.area,
      task.day,
      task.dueDate || task.date || task.targetDate,
      task.time,
      task.owner,
      task.linkedShipmentId || task.linkedShipmentRef,
      task.recurringSeriesId || task.weeklySeriesId || task.seriesId
    ].join('|'));
  }
  if (!out.length) add('index:', index);
  return out;
}

function mergeLedger(serverLedger, incomingLedger) {
  const out = {};
  const ingest = (source) => {
    if (!isObject(source)) return;
    for (const [key, value] of Object.entries(source)) {
      if (!isObject(value)) continue;
      const current = out[key];
      const currentTs = Date.parse(current && current.updatedAt || '') || 0;
      const incomingTs = Date.parse(value.updatedAt || '') || 0;
      if (!current || incomingTs >= currentTs) out[key] = clone(value);
    }
  };
  ingest(serverLedger);
  ingest(incomingLedger);
  return out;
}

function applyTaskLedger(tasks, ledger) {
  if (!Array.isArray(tasks) || !isObject(ledger)) return tasks;
  return tasks.map((task, index) => {
    let record = null;
    for (const key of taskLedgerKeys(task, index)) {
      const candidate = ledger[key];
      if (!candidate) continue;
      if (!record || (Date.parse(candidate.updatedAt || '') || 0) >= (Date.parse(record.updatedAt || '') || 0)) record = candidate;
    }
    if (!record) return task;
    const done = record.status === 'erledigt' || record.done === true;
    const next = Object.assign({}, task, {
      status: done ? 'erledigt' : 'offen',
      done,
      statusUpdatedAt: record.updatedAt || task.statusUpdatedAt,
      _syncUpdatedAt: record.updatedAt || task._syncUpdatedAt
    });
    if (done) {
      next.doneAt = record.doneAt || record.updatedAt || next.doneAt;
      next.completedAt = next.doneAt;
      next.doneBy = record.doneBy || next.doneBy || '';
      next.completedBy = next.doneBy;
    } else {
      next.doneAt = '';
      next.completedAt = '';
      next.doneBy = '';
      next.completedBy = '';
    }
    return next;
  });
}

function shipmentAliases(shipment) {
  return [shipment && shipment.id, shipment && shipment.ref].map(norm).filter(Boolean);
}

function fileAliases(file, index) {
  const out = [file && file.id, file && file.remoteId, file && file.name, file && file.fileName].map(norm).filter(Boolean);
  return out.length ? Array.from(new Set(out)) : [norm(index)];
}

function applyDeliveryFileLedger(shipments, ledger) {
  if (!Array.isArray(shipments) || !isObject(ledger)) return shipments;
  return shipments.map((shipment) => {
    const aliases = shipmentAliases(shipment);
    if (!aliases.length || !Array.isArray(shipment.deliveryFiles)) return shipment;
    const files = shipment.deliveryFiles.filter((file, index) => {
      const fAliases = fileAliases(file, index);
      return !aliases.some((s) => fAliases.some((f) => ledger[`${s}|${f}`]));
    });
    return files.length === shipment.deliveryFiles.length ? shipment : Object.assign({}, shipment, { deliveryFiles: files });
  });
}

function chooseNewer(serverItem, incomingItem, collectionName) {
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  if (incomingTs > serverTs) return clone(incomingItem);
  if (serverTs > incomingTs) return clone(serverItem);
  if (collectionName === 'tasks' && taskDone(serverItem) !== taskDone(incomingItem)) {
    return taskDone(incomingItem) ? clone(incomingItem) : clone(serverItem);
  }
  return Object.assign({}, clone(serverItem) || {}, clone(incomingItem) || {});
}

function meaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function mergeCustomerProtected(serverItem, incomingItem) {
  if (!isObject(serverItem)) return clone(incomingItem);
  if (!isObject(incomingItem)) return clone(serverItem);
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  const newer = incomingTs >= serverTs ? incomingItem : serverItem;
  const older = incomingTs >= serverTs ? serverItem : incomingItem;
  const out = clone(newer) || {};

  // Customer master data is loss-protected: an empty/missing value from a newer partial client
  // may not erase a previously persisted non-empty value.
  for (const [key, value] of Object.entries(older)) {
    if (!meaningfulValue(out[key]) && meaningfulValue(value)) out[key] = clone(value);
  }

  // Template/profile objects need the same protection recursively.
  if (isObject(serverItem.mailTemplates) || isObject(incomingItem.mailTemplates)) {
    out.mailTemplates = mergePlainObject(serverItem.mailTemplates, incomingItem.mailTemplates);
    const preserveNested = (olderNode, targetNode) => {
      if (!isObject(olderNode) || !isObject(targetNode)) return;
      for (const [key, value] of Object.entries(olderNode)) {
        if (isObject(value)) {
          if (!isObject(targetNode[key])) targetNode[key] = {};
          preserveNested(value, targetNode[key]);
        } else if (!meaningfulValue(targetNode[key]) && meaningfulValue(value)) targetNode[key] = clone(value);
      }
    };
    preserveNested(older.mailTemplates, out.mailTemplates);
  }

  ['locations', 'sites', 'standorte', 'deliveryLocations', 'shipToLocations'].forEach((key) => {
    const a = Array.isArray(serverItem[key]) ? serverItem[key] : [];
    const b = Array.isArray(incomingItem[key]) ? incomingItem[key] : [];
    if (a.length && !b.length) out[key] = clone(a);
    else if (!a.length && b.length) out[key] = clone(b);
    else if (a.length && b.length) out[key] = clone(incomingTs >= serverTs ? b : a);
  });
  return out;
}

function shipmentStatusRank(value) {
  const text = lower(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/storn|cancel/.test(text)) return 100;
  if (/nachbearbeit|rework/.test(text)) return 90;
  if (/archiv/.test(text)) return 80;
  if (/abgeschlossen|completed|erledigt|done/.test(text)) return 70;
  if (/pod/.test(text)) return 60;
  if (/abgeholt|picked/.test(text)) return 50;
  if (/vorbereit|prepared/.test(text)) return 45;
  if (/bereit.*abhol|ready.*pickup/.test(text)) return 40;
  if (/wartet.*abd|abd.*wart/.test(text)) return 30;
  if (/in bearbeitung|processing|bearbeit/.test(text)) return 25;
  if (/erstellt|created/.test(text)) return 20;
  if (/entwurf|draft/.test(text)) return 10;
  return 0;
}

function rc1017ArrayIdentity(item,index) {
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

function rc1017ArrayIdentity(item,index) {
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

function normalizeTombstones(meta) {
  const list = meta && Array.isArray(meta.tombstones) ? meta.tombstones : [];
  const map = new Map();
  for (const tombstone of list) {
    if (!tombstone || !tombstone.collection || !tombstone.id) continue;
    const key = `${tombstone.collection}:${lower(tombstone.id)}`;
    const current = map.get(key);
    if (!current || Date.parse(tombstone.deletedAt || '') >= Date.parse(current.deletedAt || '')) {
      map.set(key, clone(tombstone));
    }
  }
  return Array.from(map.values());
}

function tombstoneMap(meta) {
  const map = new Map();
  for (const tombstone of normalizeTombstones(meta)) {
    map.set(`${tombstone.collection}:${lower(tombstone.id)}`, tombstone);
  }
  return map;
}

function mergeCollection(name, serverList, incomingList, tombstones) {
  const keys = COLLECTION_KEYS[name] || ['id', '_syncId'];
  const map = new Map();
  const ingest = (list, source) => {
    (Array.isArray(list) ? list : []).forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const shipmentCollection = name === 'shipments' || name === 'savedShipments';
      const key = shipmentCollection ? shipmentIdentityKey(item, index) : itemKey(item, keys, index);
      const existing = map.get(key);
      if (!existing) map.set(key, source === 'server' ? item : clone(item));
      else if (name === 'shipments' || name === 'savedShipments') map.set(key, source === 'incoming' ? mergeShipmentProtected(existing, item) : mergeShipmentProtected(item, existing));
      else if (name === 'customers') map.set(key, source === 'incoming' ? mergeCustomerProtected(existing, item) : mergeCustomerProtected(item, existing));
      else map.set(key, source === 'incoming' ? chooseNewer(existing, item, name) : chooseNewer(item, existing, name));
    });
  };
  ingest(serverList, 'server');
  ingest(incomingList, 'incoming');

  const out = [];
  for (const [key, item] of map.entries()) {
    const rawId = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key;
    const tombstone = tombstones.get(`${name}:${lower(rawId)}`);
    const shipmentCollection = name === 'shipments' || name === 'savedShipments';
    const explicitShipmentDelete = shipmentCollection && tombstone && tombstone.explicitUserAction === true;
    if (tombstone && (!shipmentCollection || explicitShipmentDelete) && Date.parse(tombstone.deletedAt || '') >= timestamp(item)) continue;
    out.push(item);
  }
  return out;
}

function isLocalOnlyKey(key) {
  if (LOCAL_ONLY_KEYS.has(key)) return true;
  return /(?:Search|Filter|Selected|Step|Snooze|Modal|View|Tab|Page|Sort)$/i.test(key) ||
    /^rc\d+(?:Overview|Search|Filter|Edit|Selected|Notify|Ui|Open|Tab|Page|Sort)/i.test(key);
}

function fieldTime(meta, key) {
  const value = meta && meta.fields && meta.fields[key];
  const time = Date.parse(value && value.updatedAt ? value.updatedAt : value || '');
  return Number.isFinite(time) ? time : 0;
}

function mergePlainObject(serverValue, incomingValue) {
  if (!isObject(serverValue)) return clone(incomingValue);
  if (!isObject(incomingValue)) return clone(serverValue);
  const out = clone(serverValue);
  for (const [key, value] of Object.entries(incomingValue)) {
    if (isObject(value) && isObject(out[key])) out[key] = mergePlainObject(out[key], value);
    else out[key] = clone(value);
  }
  return out;
}

function mergeState(serverState, incomingState) {
  const server = isObject(serverState) ? serverState : {};
  const incoming = isObject(incomingState) ? incomingState : {};
  const serverMeta = isObject(server._teamSyncMeta) ? server._teamSyncMeta : {};
  const incomingMeta = isObject(incoming._teamSyncMeta) ? incoming._teamSyncMeta : {};
  const mergedMeta = {
    fields: Object.assign({}, serverMeta.fields || {}, incomingMeta.fields || {}),
    tombstones: normalizeTombstones({ tombstones: [
      ...(serverMeta.tombstones || []),
      ...(incomingMeta.tombstones || [])
    ] })
  };
  const tombstones = tombstoneMap(mergedMeta);
  const serverTombstones = new Map(normalizeTombstones(serverMeta).map(item => [`${lower(item.collection)}:${lower(item.id)}`, item]));
  const changedTombstoneCollections = new Set();
  for (const item of normalizeTombstones(incomingMeta)) {
    const key = `${lower(item.collection)}:${lower(item.id)}`;
    const previous = serverTombstones.get(key);
    if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) changedTombstoneCollections.add(lower(item.collection));
  }
  const incomingFields = isObject(incomingMeta.fields) ? incomingMeta.fields : {};
  const serverFields = isObject(serverMeta.fields) ? serverMeta.fields : {};
  const out = {};
  const keys = new Set([...Object.keys(server), ...Object.keys(incoming)]);

  for (const key of keys) {
    if (key === '_teamSyncMeta' || isLocalOnlyKey(key)) continue;
    const serverValue = server[key];
    const incomingValue = incoming[key];
    const incomingHasValue = Object.prototype.hasOwnProperty.call(incoming, key);
    const incomingFieldMeta = incomingFields[key];
    const fieldMetaChanged = incomingFieldMeta !== undefined && JSON.stringify(incomingFieldMeta) !== JSON.stringify(serverFields[key]);
    const tombstoneChanged = changedTombstoneCollections.has(lower(key));

    if (!incomingHasValue && !fieldMetaChanged && !tombstoneChanged) {
      out[key] = serverValue;
      continue;
    }

    if (Array.isArray(serverValue) || Array.isArray(incomingValue)) {
      out[key] = mergeCollection(key, serverValue, incomingValue, tombstones);
      continue;
    }

    const serverTs = fieldTime(serverMeta, key);
    const incomingTs = fieldTime(incomingMeta, key);
    if (incomingTs > serverTs) out[key] = clone(incomingValue);
    else if (serverTs > incomingTs) out[key] = clone(serverValue);
    else if (isObject(serverValue) || isObject(incomingValue)) out[key] = mergePlainObject(serverValue, incomingValue);
    else out[key] = incomingValue !== undefined ? clone(incomingValue) : clone(serverValue);
  }


  out.taskStatusLedger = mergeLedger(server.taskStatusLedger, incoming.taskStatusLedger);
  out.deliveryFileDeletionLedger = mergeLedger(server.deliveryFileDeletionLedger, incoming.deliveryFileDeletionLedger);
  if (Object.keys(out.taskStatusLedger).length) out.tasks = applyTaskLedger(out.tasks, out.taskStatusLedger);
  if (Object.keys(out.deliveryFileDeletionLedger).length) out.shipments = applyDeliveryFileLedger(out.shipments, out.deliveryFileDeletionLedger);

  out._teamSyncMeta = mergedMeta;
  return stripPublicAccessSecrets(out);
}

function mergeUsers(serverUsers, incomingUsers, meta) {
  return mergeCollection('users', serverUsers, incomingUsers, tombstoneMap(meta || {}));
}

function sanitizeState(state) {
  const source = isObject(state) ? state : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (isLocalOnlyKey(key)) continue;
    out[key] = clone(value);
  }
  if (!isObject(out._teamSyncMeta)) out._teamSyncMeta = { fields: {}, tombstones: [] };
  out._teamSyncMeta.tombstones = normalizeTombstones(out._teamSyncMeta);
  return stripPublicAccessSecrets(out);
}

function pruneTombstones(state, maxAgeDays = 365) {
  if (!state || !state._teamSyncMeta) return state;
  const cutoff = Date.now() - maxAgeDays * 86400000;
  state._teamSyncMeta.tombstones = normalizeTombstones(state._teamSyncMeta).filter((item) => {
    const time = Date.parse(item.deletedAt || '');
    return !Number.isFinite(time) || time >= cutoff;
  });
  return state;
}

module.exports = {
  COLLECTION_KEYS,
  clone,
  itemKey,
  timestamp,
  mergeCollection,
  mergeState,
  mergeUsers,
  sanitizeState,
  pruneTombstones,
  isLocalOnlyKey
};
