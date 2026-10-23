(function(g){
'use strict';

function normalizeTargets(value){
  if(value==null)return [];
  if(Array.isArray(value))return value.filter(Boolean);
  if(typeof value.length==='number'&&typeof value!=='string')return Array.from(value).filter(Boolean);
  return [value].filter(Boolean);
}
function create(){
  const resolvers=new Map();
  function register(key,resolver){
    const id=String(key||'').trim();
    if(!id)throw new Error('TRAINING_TARGET_KEY_REQUIRED');
    if(typeof resolver!=='function')throw new Error('TRAINING_TARGET_RESOLVER_REQUIRED');
    if(resolvers.has(id))throw new Error('TRAINING_TARGET_KEY_DUPLICATE');
    resolvers.set(id,resolver);
    return api;
  }
  function find(key,root){
    const id=String(key||'').trim();
    if(!resolvers.has(id))throw new Error('TRAINING_TARGET_KEY_UNKNOWN');
    const matches=normalizeTargets(resolvers.get(id)(root));
    if(matches.length===0)throw new Error('TRAINING_TARGET_MISSING');
    if(matches.length>1)throw new Error('TRAINING_TARGET_AMBIGUOUS');
    return matches[0];
  }
  function keys(){return Array.from(resolvers.keys());}
  const api=Object.freeze({register,find,keys});
  return api;
}

g.ExportHubTrainingTargetRegistry=Object.freeze({create});
})(globalThis);
