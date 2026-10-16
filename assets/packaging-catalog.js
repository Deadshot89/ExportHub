(function(root){
  'use strict';
  const entries=[
    {key:'duesseldorfer-palette',name:'Düsseldorfer Palette',length:80,width:60,height:null,aliases:['Dusseldorfer Palette','Düsseldorfer Palette','Dusseldorf Pallet','Düsseldorf Palette']},
    {key:'kunststoffpalette',name:'Kunststoffpalette',length:122,width:116,height:null,aliases:['Kunststoff Palette','Kunststoffpalette','Plastic Palette','Plastic Pallet']},
    {key:'industrie-palette',name:'Industrie Palette',length:120,width:100,height:null,aliases:['Industriepalette','Industrie Palette','Industrial Pallet','Industrial Palette']},
    {key:'palettengestell',name:'Palettengestell',length:120,width:90,height:null,aliases:['Palettengestell','Paletten Gestell','Pallet Rack']},
    {key:'euro-palette',name:'Euro Palette',length:120,width:80,height:null,aliases:['Europalette','Euro-Palette','Euro Palette','Euro Pallet','Euro-Pallet']},
    {key:'einwegpalette',name:'Einwegpalette',length:120,width:80,height:null,aliases:['Einwegpalette','Einweg Palette','One Way Pallet','One-Way Pallet']}
  ];
  function normalize(value){return String(value==null?'':value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  const lookup=new Map();
  for(const entry of entries){for(const value of [entry.key,entry.name,...entry.aliases])lookup.set(normalize(value),entry);}
  function copy(entry){return entry?{key:entry.key,label:entry.name,length:entry.length,width:entry.width,height:entry.height}:null;}
  function authoritative(){return root.ExportHUBPackagingMasterAuthoritative===true;}
  function list(){return authoritative()?[]:entries.map(copy);}
  function get(keyOrLabel){return authoritative()?null:copy(lookup.get(normalize(keyOrLabel))||null);}
  function observePackagingMaster(){
    const original=root.fetch;
    if(typeof original!=='function'||original.__exporthubPackagingMasterObserver)return;
    const wrapped=function(input,init){
      const url=String(input&&input.url||input||'');
      return Promise.resolve(original.call(this,input,init)).then(response=>{
        if(response&&response.ok===true&&/\/api\/pack-notification(?:\?|$)/.test(url)&&/[?&]action=packaging-list(?:&|$)/.test(url))root.ExportHUBPackagingMasterAuthoritative=true;
        return response;
      });
    };
    wrapped.__exporthubPackagingMasterObserver=true;
    wrapped.__exporthubOriginalFetch=original;
    root.fetch=wrapped;
  }
  observePackagingMaster();
  root.ExportHubPackagingCatalog=Object.freeze({list,get});
})(typeof window!=='undefined'?window:globalThis);
