(function(root){
  'use strict';
  const entries=[
    {key:'duesseldorfer-palette',label:'Düsseldorfer Palette',length:80,width:60,height:null,aliases:['Dusseldorfer Palette','Düsseldorfer Palette','Dusseldorf Pallet','Düsseldorf Palette']},
    {key:'kunststoffpalette',label:'Kunststoffpalette',length:122,width:116,height:null,aliases:['Kunststoff Palette','Kunststoffpalette','Plastic Palette','Plastic Pallet']},
    {key:'industrie-palette',label:'Industrie Palette',length:120,width:100,height:null,aliases:['Industriepalette','Industrie Palette','Industrial Pallet','Industrial Palette']},
    {key:'palettengestell',label:'Palettengestell',length:120,width:90,height:null,aliases:['Palettengestell','Paletten Gestell','Pallet Rack']},
    {key:'euro-palette',label:'Euro Palette',length:120,width:80,height:null,aliases:['Europalette','Euro-Palette','Euro Palette','Euro Pallet','Euro-Pallet']},
    {key:'einwegpalette',label:'Einwegpalette',length:120,width:80,height:null,aliases:['Einwegpalette','Einweg Palette','One Way Pallet','One-Way Pallet']}
  ];
  function normalize(value){return String(value==null?'':value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  const lookup=new Map();
  for(const entry of entries){for(const value of [entry.key,entry.label,...entry.aliases])lookup.set(normalize(value),entry);}
  function copy(entry){return entry?{key:entry.key,label:entry.label,length:entry.length,width:entry.width,height:entry.height}:null;}
  function list(){return entries.map(copy);}
  function get(keyOrLabel){return copy(lookup.get(normalize(keyOrLabel))||null);}
  root.ExportHubPackagingCatalog=Object.freeze({list,get});
})(typeof window!=='undefined'?window:globalThis);
