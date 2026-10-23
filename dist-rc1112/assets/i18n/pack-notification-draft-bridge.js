(function(root){
  'use strict';
  const core=root&&root.ExportHUBPackI18n;
  if(!core||!core.packs||core.draftExtensionReady)return;
  const supported=Array.from(core.supported||['de','en','pl','es','fr','it']);
  const packs={};
  for(const lang of supported)packs[lang]=Object.assign({},core.packs[lang]||{});
  function interpolate(value,vars){return String(value==null?'':value).replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,key)=>vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):'');}
  function languageCode(lang){const raw=String(lang||'').trim().toLowerCase().replace('_','-').split('-')[0];return supported.includes(raw)?raw:(supported.includes(core.language&&core.language())?core.language():'de');}
  function t(key,vars,lang){const code=languageCode(lang),value=(packs[code]||packs.de||{})[key]??(packs.de||{})[key];return value===undefined?core.t(key,vars,lang):interpolate(value,vars);}
  root.ExportHUBPackI18n=Object.freeze(Object.assign({},core,{packs,t,draftExtensionReady:true}));
})(typeof window!=='undefined'?window:globalThis);
