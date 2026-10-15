(function(root){
'use strict';
if(root.ExportHubSopGuidedI18n)return;

function parseDictionary(){
  try{
    const node=root.document&&root.document.getElementById('exporthub-rc1544-sop-guided-i18n-data');
    const parsed=node&&JSON.parse(node.textContent||'{}');
    return parsed&&typeof parsed==='object'?parsed:{};
  }catch(_){return {};}
}
function freezeDictionary(source){
  return Object.freeze(Object.fromEntries(Object.entries(source||{}).map(([lang,values])=>[
    lang,
    Object.freeze(values&&typeof values==='object'?{...values}:{})
  ])));
}
function format(value,vars){
  let out=String(value==null?'':value);
  for(const [key,replacement] of Object.entries(vars||{}))out=out.replaceAll(`{{${key}}}`,String(replacement));
  return out;
}

const dictionary=freezeDictionary(parseDictionary());
root.ExportHubSopGuidedI18n=dictionary;

let attempts=0;
function install(){
  const base=root.ExportHUBI18n;
  if(!base||typeof base.t!=='function'){
    attempts+=1;
    if(attempts<120&&typeof root.setTimeout==='function')root.setTimeout(install,25);
    return false;
  }
  if(base.__rc1544GuidedI18n)return true;
  const language=()=>{
    try{return typeof base.language==='function'?String(base.language()||'de').toLowerCase().slice(0,2):'de';}
    catch(_){return'de';}
  };
  const wrapped=Object.freeze(Object.assign({},base,{
    __rc1544GuidedI18n:true,
    t(key,vars){
      let value='';
      try{value=base.t(key,vars);}catch(_){}
      if(value&&value!==key)return value;
      const lang=language();
      const local=dictionary[lang]||dictionary.de||{};
      return Object.prototype.hasOwnProperty.call(local,key)?format(local[key],vars):(value||key);
    }
  }));
  root.ExportHUBI18n=wrapped;
  return true;
}
install();
})(typeof globalThis!=='undefined'?globalThis:this);
