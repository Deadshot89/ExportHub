import fs from 'node:fs';

const file='api/shared/merge.js';
let src=fs.readFileSync(file,'utf8');

const collectionNeedle="  isoSops: ['id', 'number', '_syncId'],\n  users: ['id', 'user', 'login', 'username', 'name']";
const collectionReplacement="  isoSops: ['id', 'number', '_syncId'],\n  sopLearningProgress: ['id', 'key'],\n  users: ['id', 'user', 'login', 'username', 'name']";
if(!src.includes("sopLearningProgress: ['id', 'key']")){
  if(!src.includes(collectionNeedle))throw new Error('COLLECTION_KEYS insertion point not found');
  src=src.replace(collectionNeedle,collectionReplacement);
}

const helperNeedle='function meaningfulValue(value) {';
const helper=`function progressEventTime(value) {
  const candidates = [
    value && value.at,
    value && value.updatedAt,
    value && value.completedAt,
    value && value.startedAt,
    value && value.createdAt
  ];
  for (const candidate of candidates) {
    const time = Date.parse(candidate || '');
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

function mergeProgressHistory(serverList, incomingList, idFields) {
  const map = new Map();
  let fallback = 0;
  const ingest = (list, source) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      if (!isObject(item)) return;
      let id = '';
      for (const field of idFields) {
        id = text(item[field]);
        if (id) break;
      }
      if (!id) id = 'fallback:' + source + ':' + (++fallback) + ':' + text(item.at || item.completedAt || item.startedAt || item.createdAt);
      const existing = map.get(id);
      if (!existing) {
        map.set(id, clone(item));
        return;
      }
      const existingTime = progressEventTime(existing);
      const itemTime = progressEventTime(item);
      map.set(id, itemTime >= existingTime
        ? Object.assign({}, clone(existing), clone(item))
        : Object.assign({}, clone(item), clone(existing)));
    });
  };
  ingest(serverList, 'server');
  ingest(incomingList, 'incoming');
  return Array.from(map.entries())
    .sort((a, b) => progressEventTime(a[1]) - progressEventTime(b[1]) || a[0].localeCompare(b[0]))
    .map((entry) => entry[1]);
}

function progressIso(a, b, mode) {
  const av = text(a), bv = text(b);
  if (!av) return bv;
  if (!bv) return av;
  const at = Date.parse(av), bt = Date.parse(bv);
  if (!Number.isFinite(at)) return bv;
  if (!Number.isFinite(bt)) return av;
  return mode === 'latest' ? (bt >= at ? bv : av) : (bt <= at ? bv : av);
}

function mergeSopLearningProgress(serverItem, incomingItem) {
  if (!isObject(serverItem)) return clone(incomingItem);
  if (!isObject(incomingItem)) return clone(serverItem);
  const serverTs = timestamp(serverItem);
  const incomingTs = timestamp(incomingItem);
  const newer = incomingTs >= serverTs ? incomingItem : serverItem;
  const older = incomingTs >= serverTs ? serverItem : incomingItem;
  const out = Object.assign({}, clone(older) || {}, clone(newer) || {});

  for (const key of ['id', 'key', 'userId', 'sopNumber', 'version']) {
    out[key] = text(newer[key]) ? clone(newer[key]) : clone(older[key]);
  }
  for (const key of ['viewedAt', 'startedAt', 'completedAt', 'tourCompletedAt']) {
    out[key] = progressIso(serverItem[key], incomingItem[key], 'earliest');
  }

  out.examAttempts = mergeProgressHistory(serverItem.examAttempts, incomingItem.examAttempts, ['attemptId', 'id']);
  out.helpEvents = mergeProgressHistory(serverItem.helpEvents, incomingItem.helpEvents, ['helpId', 'id']);
  out.helpCount = Math.max(
    Number(serverItem.helpCount) || 0,
    Number(incomingItem.helpCount) || 0,
    out.helpEvents.length
  );
  out.updatedAt = progressIso(serverItem.updatedAt, incomingItem.updatedAt, 'latest');
  out._syncUpdatedAt = progressIso(serverItem._syncUpdatedAt, incomingItem._syncUpdatedAt, 'latest');
  return out;
}

function meaningfulValue(value) {`;
if(!src.includes('function mergeSopLearningProgress(')){
  if(!src.includes(helperNeedle))throw new Error('helper insertion point not found');
  src=src.replace(helperNeedle,helper);
}

const branchNeedle="      else if (name === 'customers') map.set(key, source === 'incoming' ? mergeCustomerProtected(existing, item) : mergeCustomerProtected(item, existing));\n      else map.set(key, source === 'incoming' ? chooseNewer(existing, item, name) : chooseNewer(item, existing, name));";
const branchReplacement="      else if (name === 'customers') map.set(key, source === 'incoming' ? mergeCustomerProtected(existing, item) : mergeCustomerProtected(item, existing));\n      else if (name === 'sopLearningProgress') map.set(key, source === 'incoming' ? mergeSopLearningProgress(existing, item) : mergeSopLearningProgress(item, existing));\n      else map.set(key, source === 'incoming' ? chooseNewer(existing, item, name) : chooseNewer(item, existing, name));";
if(!src.includes("name === 'sopLearningProgress'")){
  if(!src.includes(branchNeedle))throw new Error('mergeCollection branch insertion point not found');
  src=src.replace(branchNeedle,branchReplacement);
}

fs.writeFileSync(file,src);
console.log('RC1503 learning-progress merge patch applied');
