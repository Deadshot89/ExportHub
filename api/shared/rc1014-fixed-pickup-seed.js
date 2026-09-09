'use strict';

const SEED_VERSION = 1;
const ESSENTRA_COMPANY_KEY = 'essentra';
const ALTERNATIVE_NOTE = 'Alternativtermin: O’Hare fährt Donnerstag oder Freitag, nicht an beiden Tagen.';

const ESSENTRA_DEFAULTS = Object.freeze([
  { id:'FIX-RC1014-ESSENTRA-FR-MO', siteLabel:'Frankreich', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-ES-DI', siteLabel:'Spanien', weekday:2, note:'' },
  { id:'FIX-RC1014-ESSENTRA-ES-FR', siteLabel:'Spanien', weekday:5, note:'' },
  { id:'FIX-RC1014-ESSENTRA-BMP-MI', siteLabel:'BMP', weekday:3, note:'' },
  { id:'FIX-RC1014-ESSENTRA-IT-MI', siteLabel:'Italien', weekday:3, note:'' },
  { id:'FIX-RC1014-ESSENTRA-IT-FR', siteLabel:'Italien', weekday:5, note:'' },
  { id:'FIX-RC1014-ESSENTRA-AIR-ASIA-DO', siteLabel:'Luftfracht China / Indien / Australien / Singapore / Shenzhen-HK / Thailand', weekday:4, note:'' },
  { id:'FIX-RC1014-ESSENTRA-PL-FR', siteLabel:'Polen', weekday:5, note:'' },
  { id:'FIX-RC1014-ESSENTRA-SE-FR', siteLabel:'Schweden', weekday:5, note:'' },
  { id:'FIX-RC1014-ESSENTRA-UK-MO', siteLabel:'UK', weekday:1, note:'' },
  { id:'FIX-RC1014-ESSENTRA-UK-DI', siteLabel:'UK', weekday:2, note:'' },
  { id:'FIX-RC1014-ESSENTRA-UK-MI', siteLabel:'UK', weekday:3, note:'' },
  { id:'FIX-RC1014-ESSENTRA-UK-DO', siteLabel:'UK', weekday:4, note:'' },
  { id:'FIX-RC1014-ESSENTRA-UK-FR', siteLabel:'UK', weekday:5, note:'' },
  { id:'FIX-RC1014-ESSENTRA-OHARE-DO', siteLabel:'O’Hare', weekday:4, note:ALTERNATIVE_NOTE },
  { id:'FIX-RC1014-ESSENTRA-OHARE-FR', siteLabel:'O’Hare', weekday:5, note:ALTERNATIVE_NOTE }
]);

function text(value){ return String(value == null ? '' : value).trim(); }
function key(item){
  return `${text(item && item.siteLabel).toLocaleLowerCase('de-DE')}|${Number(item && item.weekday || 0)}`;
}
function defaultsForCompany(companyKey){
  if (text(companyKey).toLowerCase() !== ESSENTRA_COMPANY_KEY) return [];
  return ESSENTRA_DEFAULTS.map(item => ({...item, active:true}));
}
function mergeMissing(existing, companyKey, stamp){
  const list = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(list.map(key));
  for (const item of defaultsForCompany(companyKey)) {
    if (seen.has(key(item))) continue;
    list.push({
      ...item,
      createdAt: stamp,
      createdBy: 'System RC1014',
      updatedAt: stamp,
      updatedBy: 'System RC1014'
    });
    seen.add(key(item));
  }
  return list;
}

module.exports = {
  SEED_VERSION,
  ESSENTRA_COMPANY_KEY,
  ESSENTRA_DEFAULTS,
  defaultsForCompany,
  mergeMissing
};
