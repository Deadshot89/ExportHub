'use strict';
// RC1966: inert bounded Azure SDK adapter. No Azure client creation or network
// connection without an explicitly supplied, trusted ContainerClient.
const crypto=require('node:crypto');
const MAX_BYTES=12*1024*1024;
const DEFAULT_TIMEOUT_MS=35000;
const MIN_TIMEOUT_MS=10;
const HEX64=/^[0-9a-f]{64}$/;
const HEX32=/^[0-9a-f]{32}$/;
const ETAG=/^"[A-Za-z0-9!#$%&'*+.^_|~-]{1,128}"$/;
const KINDS=new Set(['pdf','xlsx','csv','txt','tsv','jpg','png']);
const fail=()=>{throw Error('RC1966_BLOB_UNVERIFIED')};
// RC1978: Azure SDK and injected test streams may throw from destroy().
// A throw inside the timeout callback would otherwise become an uncaught
// exception outside the async read's catch/finally path.
const safeDestroy=stream=>{
 try{if(stream&&typeof stream.destroy==='function')stream.destroy();}
 catch(_){/* fail closed; no path, SDK error or secret is reported */}
};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function deriveBlobName(expected,kind){
 if(!expected||expected.environment!=='testservice'||!KINDS.has(kind)||
    !HEX64.test(expected.scopeHash||'')||!HEX64.test(expected.uploadSha256||'')||
    !HEX64.test(expected.blobKeyHash||'')||!HEX32.test(expected.uploadNonce||'')||
    typeof expected.blobEtag!=='string'||!ETAG.test(expected.blobEtag)||
    !Number.isSafeInteger(expected.bytes)||expected.bytes<1||expected.bytes>MAX_BYTES) return fail();
 const name='rc1294/testservice/'+expected.scopeHash+'/'+expected.uploadSha256+'-'+expected.uploadNonce+'.'+kind;
 if(hash(name)!==expected.blobKeyHash)return fail();
 return name;
}
function createBoundedReadSnapshot({container,expected,kind,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
 // A trusted worker must create 'container' using workload identity and the
 // dedicated testservice quarantine container. Never inject a client-supplied
 // URL, SAS, connection string or arbitrary blob path here.
 const name=deriveBlobName(expected,kind);
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<MIN_TIMEOUT_MS||timeoutMs>DEFAULT_TIMEOUT_MS||
    !container||typeof container.getBlobClient!=='function')return fail();
 const scope=Object.freeze({...expected});
 return async function readSnapshot(locator){
  if(!locator||locator.environment!=='testservice'||
     locator.scopeHash!==scope.scopeHash||locator.blobKeyHash!==scope.blobKeyHash||
     !HEX32.test(locator.jobId||''))return fail();
  const controller=new AbortController();
  let activeStream=null,watchdog;
  // RC1968: SDK transports may ignore AbortSignal. A separate deadline
  // rejects even if getProperties, download, or an async iterator never ends.
  const deadline=new Promise((_,reject)=>{
   watchdog=setTimeout(()=>{
    controller.abort();
    safeDestroy(activeStream);
    reject(Error('RC1966_BLOB_TIMEOUT'));
   },timeoutMs);
  });
  const performRead=async()=>{
   try{
   const blob=container.getBlobClient(name);
   if(!blob||typeof blob.getProperties!=='function'||typeof blob.download!=='function')return fail();
   const conditions={ifMatch:scope.blobEtag};
   const props=await blob.getProperties({conditions,abortSignal:controller.signal});
   if(controller.signal.aborted)return fail();
   if(!props||props.etag!==scope.blobEtag||props.blobType!=='BlockBlob'||
      props.contentLength!==scope.bytes)return fail();
   // Server-side range + If-Match prevent an unbounded or substituted download.
   // maxRetryRequests:0 avoids automatic hidden stream retry consumption.
   const response=await blob.download(0,scope.bytes,{conditions,maxRetryRequests:0,
    abortSignal:controller.signal});
   // A late SDK response can arrive after the outer deadline settled. Adopt
   // its stream before checking cancellation so it cannot leak resources.
   const stream=response&&response.readableStreamBody;
   activeStream=stream;
   if(controller.signal.aborted)return fail();
   if(!response||response.etag!==scope.blobEtag||
      response.contentLength!==scope.bytes||
      !stream||typeof stream[Symbol.asyncIterator]!=='function'){
    safeDestroy(stream);
    return fail();
   }
   const parts=[];let total=0;
   try{
    for await(const part of stream){
     if(controller.signal.aborted)return fail();
     if(!Buffer.isBuffer(part)&&!(part instanceof Uint8Array))return fail();
     // RC1969: reject a large transport chunk BEFORE copying it into a new
     // Buffer. The old order allocated attacker-sized memory, then rejected.
     const size=part.byteLength;
     if(!Number.isSafeInteger(size)||size<1||size>scope.bytes-total||
        size>MAX_BYTES-total)return fail();
     const chunk=Buffer.from(part);
     if(chunk.length!==size)return fail();
     total+=size;
     parts.push(chunk);
    }
   }finally{safeDestroy(stream);}
   if(controller.signal.aborted||total!==scope.bytes)return fail();
   const bytes=Buffer.concat(parts,total);
   if(hash(bytes)!==scope.uploadSha256){bytes.fill(0);return fail();}
   return{bytes,etag:scope.blobEtag};
   }catch(_){return fail();}
   finally{
    safeDestroy(activeStream);
   }
  };
  try{
   return await Promise.race([performRead(),deadline]);
  }catch(_){return fail();}
  finally{
   clearTimeout(watchdog);
   safeDestroy(activeStream);
  }
 };
}
module.exports={deriveBlobName,createBoundedReadSnapshot};
