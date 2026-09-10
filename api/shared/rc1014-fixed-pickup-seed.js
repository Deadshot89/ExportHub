'use strict';

const SEED_VERSION = 4;
const ESSENTRA_COMPANY_KEY = 'essentra';
const LEGACY_ESSENTRA_COMPANY_KEY = 'legacy-default';
const SYSTEM_ACTOR = 'System RC1014';

const ESSENTRA_DEFAULTS = Object.freeze([
  { id:'FIX-RC1014-ESSENTRA-FR-MO', siteLabel:'Frankreich', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-IT-MO', siteLabel:'Italien', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-NEFF-MO', siteLabel:'Neff', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-OHARE-MO', siteLabel:'O’Hare', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-FAURECIA-DI', siteLabel:'Faurecia', weekday:2, note:'' },
  { id:'FIX-RC1014-ESSENTRA-BMP-MI', siteLabel:'BMP', weekday:3, note:'' }
]);

const OBSOLETE_V1_IDS = new Set([
  'FIX-RC1014-ESSENTRA-ES-DI','FIX-RC1014-ESSENTRA-ES-FR','FIX-RC1014-ESSENTRA-IT-MI','FIX-RC1014-ESSENTRA-IT-FR',
  'FIX-RC1014-ESSENTRA-AIR-ASIA-DO','FIX-RC1014-ESSENTRA-PL-FR','FIX-RC1014-ESSENTRA-SE-FR',
  'FIX-RC1014-ESSENTRA-UK-MO','FIX-RC1014-ESSENTRA-UK-DI','FIX-RC1014-ESSENTRA-UK-MI','FIX-RC1014-ESSENTRA-UK-DO','FIX-RC1014-ESSENTRA-UK-FR',
  'FIX-RC1014-ESSENTRA-OHARE-DO','FIX-RC1014-ESSENTRA-OHARE-FR'
]);

function text(value){ return String(value == null ? '' : value).trim(); }
function isEssentraCompany(companyKey){
  const company=text(companyKey).toLowerCase();
  return company===ESSENTRA_COMPANY_KEY||company===LEGACY_ESSENTRA_COMPANY_KEY;
}
function key(item){ return `${text(item && item.siteLabel).toLocaleLowerCase('de-DE')}|${Number(item && item.weekday || 0)}`; }
function defaultsForCompany(companyKey){
  if (!isEssentraCompany(companyKey)) return [];
  return ESSENTRA_DEFAULTS.map(item => ({...item, active:true}));
}
function isUntouchedObsoleteV1(item){
  const id = text(item && item.id);
  if (!OBSOLETE_V1_IDS.has(id)) return false;
  const createdBy = text(item && item.createdBy), updatedBy = text(item && item.updatedBy);
  return createdBy === SYSTEM_ACTOR && (!updatedBy || updatedBy === SYSTEM_ACTOR);
}
function mergeMissing(existing, companyKey, stamp){
  let list = Array.isArray(existing) ? existing.slice() : [];
  if (!isEssentraCompany(companyKey)) return list;
  list = list.filter(item => !isUntouchedObsoleteV1(item));
  const seenKeys = new Set(list.map(key));
  const seenIds = new Set(list.map(item => text(item && item.id)).filter(Boolean));
  for (const item of defaultsForCompany(companyKey)) {
    if (seenIds.has(item.id) || seenKeys.has(key(item))) continue;
    list.push({...item,createdAt:stamp,createdBy:SYSTEM_ACTOR,updatedAt:stamp,updatedBy:SYSTEM_ACTOR});
    seenIds.add(item.id);seenKeys.add(key(item));
  }
  return list;
}

module.exports = {SEED_VERSION,ESSENTRA_COMPANY_KEY,LEGACY_ESSENTRA_COMPANY_KEY,ESSENTRA_DEFAULTS,OBSOLETE_V1_IDS,isEssentraCompany,defaultsForCompany,mergeMissing};
