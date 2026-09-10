'use strict';

const SEED_VERSION = 7;
const ESSENTRA_COMPANY_KEY = 'essentra';
const LEGACY_ESSENTRA_COMPANY_KEY = 'legacy-default';
const SYSTEM_ACTOR = 'System RC1014';
const REMOVED_NEFF_ID = 'FIX-RC1014-ESSENTRA-NEFF-MO';

const ESSENTRA_DEFAULTS = Object.freeze([
  { id:'FIX-RC1014-ESSENTRA-FR-MO', siteLabel:'Frankreich', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-IT-MO', siteLabel:'Italien', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-OHARE-MO', siteLabel:'O’Hare', weekday:1, note:'' },
  { id:'FIX-RC1024-ESSENTRA-ESYSCO-MO', siteLabel:'Esysco', weekday:1, note:'' },
  { id:'FIX-RC1024-ESSENTRA-GAGGENAU-MO', siteLabel:'Gaggenau', weekday:1, note:'' },
  { id:'FIX-RC1024-ESSENTRA-BARCELONA-MO', siteLabel:'Barcelona', weekday:1, note:'' },
  { id:'FIX-RC1024-ESSENTRA-MADRID-MO', siteLabel:'Madrid', weekday:1, note:'' },
  { id:'FIX-RC1025-ESSENTRA-UK-MO', siteLabel:'UK', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-FAURECIA-DI', siteLabel:'Faurecia', weekday:2, note:'' },
  { id:'FIX-RC1024-ESSENTRA-WUERTH-DI', siteLabel:'Adolf Würth', weekday:2, note:'Nach Anmelden verschieben' },
  { id:'FIX-RC1024-ESSENTRA-GORENJE-DI', siteLabel:'Gorenje Slovenien', weekday:2, note:'' },
  { id:'FIX-RC1025-ESSENTRA-UK-DI', siteLabel:'UK', weekday:2, note:'' },
  { id:'FIX-RC1014-ESSENTRA-BMP-MI', siteLabel:'BMP', weekday:3, note:'' },
  { id:'FIX-RC1024-ESSENTRA-BSH-MI', siteLabel:'BSH Hausgeräte', weekday:3, note:'' },
  { id:'FIX-RC1024-ESSENTRA-CONTITECH-MI', siteLabel:'Contitech', weekday:3, note:'' },
  { id:'FIX-RC1025-ESSENTRA-UK-MI', siteLabel:'UK', weekday:3, note:'' },
  { id:'FIX-RC1024-ESSENTRA-WUERTH-DO', siteLabel:'Adolf Würth', weekday:4, note:'' },
  { id:'FIX-RC1024-ESSENTRA-MADRID-DO', siteLabel:'Madrid', weekday:4, note:'' },
  { id:'FIX-RC1024-ESSENTRA-BARCELONA-DO', siteLabel:'Barcelona', weekday:4, note:'' },
  { id:'FIX-RC1024-ESSENTRA-POLEN-DO', siteLabel:'Polen', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-UK-DO', siteLabel:'UK', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-CHINA-DO', siteLabel:'China', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-INDIEN-DO', siteLabel:'Indien', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-AUSTRALIEN-DO', siteLabel:'Australien', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-SINGAPUR-DO', siteLabel:'Singapur', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-SHENZHEN-HK-DO', siteLabel:'Shenzhen HK', weekday:4, note:'' },
  { id:'FIX-RC1025-ESSENTRA-THAILAND-DO', siteLabel:'Thailand', weekday:4, note:'' },
  { id:'FIX-RC1024-ESSENTRA-SCHWEDEN-FR', siteLabel:'Schweden', weekday:5, note:'' },
  { id:'FIX-RC1025-ESSENTRA-UK-FR', siteLabel:'UK', weekday:5, note:'' }
]);

const OBSOLETE_V1_IDS = new Set([
  'FIX-RC1014-ESSENTRA-ES-DI','FIX-RC1014-ESSENTRA-ES-FR','FIX-RC1014-ESSENTRA-IT-MI','FIX-RC1014-ESSENTRA-IT-FR',
  'FIX-RC1014-ESSENTRA-AIR-ASIA-DO','FIX-RC1014-ESSENTRA-PL-FR','FIX-RC1014-ESSENTRA-SE-FR',
  'FIX-RC1014-ESSENTRA-UK-MO','FIX-RC1014-ESSENTRA-UK-DI','FIX-RC1014-ESSENTRA-UK-MI','FIX-RC1014-ESSENTRA-UK-DO','FIX-RC1014-ESSENTRA-UK-FR',
  'FIX-RC1014-ESSENTRA-OHARE-DO','FIX-RC1014-ESSENTRA-OHARE-FR'
]);

function text(value){ return String(value == null ? '' : value).trim(); }
function key(item){ return `${text(item && item.siteLabel).toLocaleLowerCase('de-DE')}|${Number(item && item.weekday || 0)}`; }
function isEssentraCompanyKey(companyKey){
  const company = text(companyKey).toLowerCase();
  return company === ESSENTRA_COMPANY_KEY || company === LEGACY_ESSENTRA_COMPANY_KEY;
}
function defaultsForCompany(companyKey){
  if (!isEssentraCompanyKey(companyKey)) return [];
  return ESSENTRA_DEFAULTS.map(item => ({...item, active:true}));
}
function isUntouchedObsoleteV1(item){
  const id = text(item && item.id);
  if (!OBSOLETE_V1_IDS.has(id)) return false;
  const createdBy = text(item && item.createdBy), updatedBy = text(item && item.updatedBy);
  return createdBy === SYSTEM_ACTOR && (!updatedBy || updatedBy === SYSTEM_ACTOR);
}
function isRemovedNeff(item){
  return text(item && item.id) === REMOVED_NEFF_ID || text(item && item.siteLabel).toLowerCase() === 'neff';
}
function mergeMissing(existing, companyKey, stamp){
  let list = Array.isArray(existing) ? existing.slice() : [];
  if (!isEssentraCompanyKey(companyKey)) return list;
  list = list.filter(item => !isRemovedNeff(item) && !isUntouchedObsoleteV1(item));
  const seenKeys = new Set(list.map(key));
  const seenIds = new Set(list.map(item => text(item && item.id)).filter(Boolean));
  for (const item of defaultsForCompany(companyKey)) {
    if (seenIds.has(item.id) || seenKeys.has(key(item))) continue;
    list.push({...item,createdAt:stamp,createdBy:SYSTEM_ACTOR,updatedAt:stamp,updatedBy:SYSTEM_ACTOR});
    seenIds.add(item.id);seenKeys.add(key(item));
  }
  return list;
}

module.exports = {SEED_VERSION,ESSENTRA_COMPANY_KEY,LEGACY_ESSENTRA_COMPANY_KEY,ESSENTRA_DEFAULTS,OBSOLETE_V1_IDS,REMOVED_NEFF_ID,isEssentraCompanyKey,defaultsForCompany,mergeMissing};