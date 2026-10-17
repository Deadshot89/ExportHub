import fs from 'node:fs';

const path='api/exporthub-state/index.js';
let source=fs.readFileSync(path,'utf8');

const cryptoImport="const crypto = require('crypto');\n";
const utilImport="const { isDeepStrictEqual } = require('node:util');\n";
if(!source.includes(utilImport)){
  if(!source.includes(cryptoImport))throw new Error('crypto import marker fehlt');
  source=source.replace(cryptoImport,cryptoImport+utilImport);
}

const saveStart=source.indexOf('async function saveMerged(');
const saveEnd=source.indexOf('/* RC614:',saveStart);
if(saveStart<0||saveEnd<=saveStart)throw new Error('saveMerged Block nicht gefunden');

const helper="function storageStateEquivalent(a,b){return isDeepStrictEqual(a&&typeof a==='object'?a:{},b&&typeof b==='object'?b:{})}\n\n";
if(!source.includes('function storageStateEquivalent(')){
  source=source.slice(0,saveStart)+helper+source.slice(saveStart);
}

const updatedStart=source.indexOf('async function saveMerged(');
const updatedEnd=source.indexOf('/* RC614:',updatedStart);
let save=source.slice(updatedStart,updatedEnd);
const nextNeedle="  const next={schemaVersion:3,revision:Number(current.revision||0)+1,";
if(!save.includes(nextNeedle))throw new Error('next marker in saveMerged fehlt');

if(!save.includes('storageStateEquivalent(current.state||{},merged)')){
  const guard=[
    "  if(storageStateEquivalent(current.state||{},merged)){",
    "   const noop=clone(current);noop.concurrentMerge=false;noop.baseRevision=Number(incoming.baseRevision||0);noop.noopSave=true;",
    "   try{Object.defineProperty(noop,'__storageEtag',{value:d.etag||null,enumerable:false});Object.defineProperty(noop,'__timing',{value:{retryReadMs,mergeMs,uploadMs,uploadBytes:0,conflictCount},enumerable:false});Object.defineProperty(noop,'__dynamicI18n',{value:dynamicI18nReport,enumerable:false})}catch(_){}",
    "   return noop;",
    "  }",
    ""
  ].join('\n');
  save=save.replace(nextNeedle,guard+nextNeedle);
  source=source.slice(0,updatedStart)+save+source.slice(updatedEnd);
}

fs.writeFileSync(path,source);
console.log('RC1557 minimal no-op guard applied');
