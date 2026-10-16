import fs from 'node:fs';

function replaceExact(path, oldText, newText, label){
  let source=fs.readFileSync(path,'utf8');
  if(source.includes(newText))return false;
  const count=source.split(oldText).length-1;
  if(count!==1)throw new Error(`${path}: ${label} expected exactly once, found ${count}`);
  source=source.replace(oldText,newText);
  fs.writeFileSync(path,source);
  return true;
}

const runtimes=['assets/rc1305-loading-list-print.js','assets/document-print-name.js'];
const oldCard="function cardFor(el,root){if(!el)return null;var n=el;for(var i=0;i<6&&n&&n!==root;i++,n=n.parentElement){if(n.nodeType===1&&/(?:card|field|sign|box|cell|pickup)/i.test(q(n.className)))return n}return el.parentElement&&el.parentElement!==root?el.parentElement:el}";
const newCard="function cardFor(el,root){if(!el)return null;if(el.closest){var explicit=el.closest('.rc390-card,.rc352-card');if(explicit&&explicit!==root&&(!root||typeof root.contains!=='function'||root.contains(explicit)))return explicit}var n=el;for(var i=0;i<6&&n&&n!==root;i++,n=n.parentElement){if(n.nodeType===1&&/(?:card|field|sign|box|cell|pickup)/i.test(q(n.className)))return n}return el.parentElement&&el.parentElement!==root?el.parentElement:el}";
const oldLegacy="[data-rc1503-pickup-field]>.rc390-txt,[data-rc1503-pickup-field]>.rc352-txt{display:none!important}";
const newLegacy="[data-rc1503-pickup-field] .rc390-txt,[data-rc1503-pickup-field] .rc352-txt{display:none!important}";
for(const path of runtimes){
  replaceExact(path,oldCard,newCard,'prefer explicit outer POD card');
  replaceExact(path,oldLegacy,newLegacy,'hide nested legacy pickup text');
}
replaceExact('assets/document-print-name.js',"wrapped.version='RC1504'","wrapped.version='RC1555'",'runtime version');

// Cache-bust both browser runtimes so already-open production clients cannot keep the broken copies.
for(const path of ['.github/rc1112/build-three-env.mjs','.github/rc1505/verify-production-live.mjs','.github/rc1505/verify-build-contract.mjs']){
  let source=fs.readFileSync(path,'utf8');
  if(source.includes('rc1305-loading-list-print.js?v=1379')){
    source=source.replaceAll('rc1305-loading-list-print.js?v=1379','rc1305-loading-list-print.js?v=1555');
    fs.writeFileSync(path,source);
  }
}
{
  const path='.github/rc1048/build-three-env.mjs';
  let source=fs.readFileSync(path,'utf8');
  source=source.replaceAll('document-print-name.js?v=1543','document-print-name.js?v=1555');
  fs.writeFileSync(path,source);
}

console.log('RC1555 exact POD card/container patch applied');
