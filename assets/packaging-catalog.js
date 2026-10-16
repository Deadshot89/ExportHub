(function(root){
  'use strict';
  function text(value){return String(value==null?'':value).trim();}
  function normalize(value){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  const aliases={
    dusseldorferpalette:'Düsseldorfer Palette',dusseldorfpalette:'Düsseldorfer Palette',dusseldorferpallet:'Düsseldorfer Palette',
    kunststoffpalette:'Kunststoffpalette',plasticpalette:'Kunststoffpalette',plasticpallet:'Kunststoffpalette',
    industriepalette:'Industrie Palette',industrialpallet:'Industrie Palette',industrialpalette:'Industrie Palette',
    palettengestell:'Palettengestell',palettengestell:'Palettengestell',palletrack:'Palettengestell',
    europalette:'Euro Palette',europallet:'Euro Palette',
    einwegpalette:'Einwegpalette',onewaypallet:'Einwegpalette'
  };
  function canonicalLabel(value){const raw=text(value),key=normalize(raw);return aliases[key]||raw;}
  function store(){return root&&root.ExportHUBPackagingStore&&typeof root.ExportHUBPackagingStore==='object'?root.ExportHUBPackagingStore:null;}
  function adapt(item){if(!item||typeof item!=='object')return null;const label=text(item.name||item.label);if(!label)return null;return{key:text(item.id||item.key)||normalize(label),label,length:item.lengthCm==null?item.length:item.lengthCm,width:item.widthCm==null?item.width:item.widthCm,height:item.heightCm==null?(item.height==null?null:item.height):item.heightCm};}
  function list(){const s=store();if(!s)return[];let values=[];if(typeof s.activeItems==='function')values=s.activeItems();else if(typeof s.items==='function')values=s.items().filter(item=>!item||item.active!==false);return(Array.isArray(values)?values:[]).map(adapt).filter(Boolean);}
  function get(value){const s=store();if(!s)return null;let found=null;if(typeof s.get==='function')found=s.get(value);if(!found){const key=normalize(value);found=(typeof s.items==='function'?s.items():[]).find(item=>[item&&item.id,item&&item.name,item&&item.code].some(v=>normalize(v)===key))||null;}return adapt(found);}
  root.ExportHubPackagingCatalog=Object.freeze({list,get,canonicalLabel,normalize});
})(typeof window!=='undefined'?window:globalThis);
