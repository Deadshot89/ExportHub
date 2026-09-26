import fs from 'node:fs';

const LANGS=['de','en','pl','es','fr','it'];
const LOCALE={de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'};
const packs=Object.fromEntries(LANGS.map(lang=>[
  lang,
  JSON.parse(fs.readFileSync(new URL('../../assets/i18n/'+lang+'.json',import.meta.url),'utf8'))
]));

function interpolate(value,vars){
  return String(value==null?'':value).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,(_,key)=>
    vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]==null?'':vars[key]):''
  );
}

export function createTestI18n(defaultLanguage='de'){
  let current=LANGS.includes(defaultLanguage)?defaultLanguage:'de';
  return {
    t(key,vars,language){
      const lang=LANGS.includes(language)?language:current;
      const pack=packs[lang]||packs.de;
      const value=pack[key] ?? packs.de[key] ?? key;
      return interpolate(value,vars||{});
    },
    language(){return current;},
    setLanguage(language){if(LANGS.includes(language))current=language;return current;},
    formatDate(value,options){
      return new Intl.DateTimeFormat(LOCALE[current]||LOCALE.de,options||{}).format(value);
    },
    localized(record,key){
      if(!record||typeof record!=='object')return '';
      const direct=record[key];
      const translations=record.translations||record.i18n||record.localized||null;
      if(translations&&translations[current]&&typeof translations[current]==='object'&&translations[current][key]!=null)return translations[current][key];
      return direct;
    }
  };
}
