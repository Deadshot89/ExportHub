'use strict';

// TESTSERVICE-only health diagnostics. Reuse a previously parsed aggregate
// ONLY after the Azure Blob service confirms the exact current ETag with HEAD.
// The caller supplies a SHA-256-scoped account/container/blob key, never a
// connection string or customer data. No TTL-only or unverified reuse.
function createTestserviceHealthEtagCache(maxEntries=4){
 const entries=new Map();
 return async function readVerifiedHealth({key,head,read}={}){
  if(typeof read!=='function'||typeof head!=='function')throw new TypeError('HEALTH_CACHE_READER_INVALID');
  const scoped=typeof key==='string'&&/^[a-f0-9]{64}$/.test(key)?key:null;
  if(!scoped){
   const fresh=await read();
   if(!fresh||!fresh.summary)throw new Error('HEALTH_CACHE_RESULT_INVALID');
   return fresh.summary;
  }
  const cached=entries.get(scoped);
  if(cached){
   try{
    const props=await head();
    if(props&&props.etag&&String(props.etag)===cached.etag)return cached.summary;
   }catch(_){
    // A failed HEAD does not authorize using cached state: download again.
   }
   entries.delete(scoped);
  }
  const fresh=await read();
  if(!fresh||!fresh.summary)throw new Error('HEALTH_CACHE_RESULT_INVALID');
  if(fresh.cacheable===true&&typeof fresh.etag==='string'&&fresh.etag){
   entries.delete(scoped);
   entries.set(scoped,{etag:fresh.etag,summary:fresh.summary});
   while(entries.size>maxEntries)entries.delete(entries.keys().next().value);
  }
  return fresh.summary;
 };
}
module.exports={createTestserviceHealthEtagCache};
