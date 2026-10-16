'use strict';

function text(value){return String(value==null?'':value).trim();}
function normalizeAlias(value){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}

const SEEDS=Object.freeze([
  Object.freeze({id:'PKG-DUESSELDORFER-PALETTE',name:'Düsseldorfer Palette',aliases:Object.freeze(['Dusseldorfer Palette','Düsseldorfer Palette','Dusseldorf Pallet','Düsseldorf Palette']),lengthCm:80,widthCm:60,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-KUNSTSTOFFPALETTE',name:'Kunststoffpalette',aliases:Object.freeze(['Kunststoff Palette','Kunststoffpalette','Plastic Palette','Plastic Pallet']),lengthCm:122,widthCm:116,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-INDUSTRIE-PALETTE',name:'Industrie Palette',aliases:Object.freeze(['Industriepalette','Industrie Palette','Industrial Pallet','Industrial Palette']),lengthCm:120,widthCm:100,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-PALETTENGESTELL',name:'Palettengestell',aliases:Object.freeze(['Palettengestell','Paletten Gestell','Pallet Rack']),lengthCm:120,widthCm:90,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-EURO-PALETTE',name:'Euro Palette',aliases:Object.freeze(['Europalette','Euro-Palette','Euro Palette','Euro Pallet','Euro-Pallet']),lengthCm:120,widthCm:80,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-EINWEGPALETTE',name:'Einwegpalette',aliases:Object.freeze(['Einwegpalette','Einweg Palette','One Way Pallet','One-Way Pallet']),lengthCm:120,widthCm:80,heightCm:null,ldm:null,protectedValues:false}),
  Object.freeze({id:'PKG-E3',name:'E3',aliases:Object.freeze(['E3']),lengthCm:43,widthCm:31,heightCm:31,ldm:0.06,protectedValues:true})
]);

const ALIASES=new Map();
for(const seed of SEEDS){
  for(const value of [seed.id,seed.name,...seed.aliases])ALIASES.set(normalizeAlias(value),seed);
}

function seedFor(value){return ALIASES.get(normalizeAlias(value))||null;}
function canonicalLabel(value){const seed=seedFor(value);return seed?seed.name:text(value);}
function listSeeds(){return SEEDS.map(seed=>({
  id:seed.id,name:seed.name,aliases:[...seed.aliases],lengthCm:seed.lengthCm,widthCm:seed.widthCm,
  heightCm:seed.heightCm,ldm:seed.ldm,protectedValues:seed.protectedValues
}));}

module.exports={SEEDS,normalizeAlias,seedFor,canonicalLabel,listSeeds};
