(function(root){
  'use strict';
  function normalize(value){return String(value==null?'':value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  const ALIASES={
    dusseldorferpalette:'Düsseldorfer Palette',dusseldorfpalette:'Düsseldorfer Palette',dusseldorfpallet:'Düsseldorfer Palette',
    kunststoffpalette:'Kunststoffpalette',plasticpalette:'Kunststoffpalette',plasticpallet:'Kunststoffpalette',
    industriepalette:'Industrie Palette',industrialpallet:'Industrie Palette',industrialpalette:'Industrie Palette',
    palettengestell:'Palettengestell',pallettrack:'Palettengestell',palletrack:'Palettengestell',
    europalette:'Euro Palette',europallet:'Euro Palette',
    einwegpalette:'Einwegpalette',onewaypallet:'Einwegpalette'
  };
  function store(){return root.ExportHUBPackagingStore||null;}
  function number(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:null;}
  function copy(entry){return entry?{key:String(entry.id||normalize(entry.name)),label:String(entry.name||''),length:number(entry.l!=null?entry.l:entry.length),width:number(entry.w!=null?entry.w:entry.width),height:number(entry.h!=null?entry.h:entry.height),ldm:number(entry.ldm)}:null;}
  function disabled(){return new Set((Array.isArray(root.ExportHUBDisabledPackaging)?root.ExportHUBDisabledPackaging:[]).map(normalize).filter(Boolean));}
  function aliasNames(){const seen=new Set(),blocked=disabled(),out=[];Object.values(ALIASES).forEach(function(name){const key=normalize(name);if(!key||seen.has(key)||blocked.has(key))return;seen.add(key);out.push({id:key,name:name,active:true});});return out;}
  function canonical(value){const s=store();if(s&&typeof s.get==='function'){let item=s.get(value);if(!item){const alias=ALIASES[normalize(value)];if(alias)item=s.get(alias);}return item&&item.active!==false?item:null;}const alias=ALIASES[normalize(value)];if(!alias||disabled().has(normalize(alias)))return null;return{id:normalize(alias),name:alias,active:true};}
  function list(){const s=store();const source=s&&typeof s.activeItems==='function'?s.activeItems():aliasNames();return source.map(copy).filter(Boolean);}
  function get(keyOrLabel){return copy(canonical(keyOrLabel));}
  function requestPayload(init){try{return JSON.parse(String(init&&init.body||'{}'));}catch(_){return{};}}
  function observePackagingMaster(){
    const original=root.fetch;
    if(typeof original!=='function'||original.__exporthubPackagingCanonicalObserver)return;
    const wrapped=function(input,init){
      const url=String(input&&input.url||input||''),self=this;
      return Promise.resolve(original.call(self,input,init)).then(async response=>{
        if(response&&response.ok===true&&/\/api\/pack-notification(?:\?|$)/.test(url)&&/[?&]action=packaging-list(?:&|$)/.test(url)){
          const payload=requestPayload(init),stationToken=String(payload.stationToken||'').trim();
          if(stationToken){
            try{
              const metaResponse=await original.call(self,'/api/packaging-public-state',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({stationToken,environment:payload.environment||undefined})});
              if(metaResponse&&metaResponse.ok===true){
                const meta=await metaResponse.json(),packaging=Array.isArray(meta&&meta.packaging)?meta.packaging:[],hidden=Array.isArray(meta&&meta.disabledPackaging)?meta.disabledPackaging:[];
                const s=store();if(s&&typeof s.replace==='function'&&packaging.length)s.replace(packaging,{reason:'pack-public'});
                root.ExportHUBDisabledPackaging=hidden.slice();
              }
            }catch(_){}
          }
        }
        return response;
      });
    };
    wrapped.__exporthubPackagingCanonicalObserver=true;
    wrapped.__exporthubOriginalFetch=original;
    root.fetch=wrapped;
  }
  observePackagingMaster();
  root.ExportHubPackagingCatalog=Object.freeze({list,get});
})(typeof window!=='undefined'?window:globalThis);
