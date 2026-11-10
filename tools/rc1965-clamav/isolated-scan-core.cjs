'use strict';

// RC1965: OFFLINE-only isolated worker *core*. No Azure SDK, queue consumer,
// storage credentials, network calls, parser integration or deployment.
// Authenticated, immutable, one-use inputs must come from a future trusted
// Azure worker. A candidate result NEVER authorizes file release.
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {MAX_BYTES,scanLocalQuarantine,runClamscan}=
 require('../rc1956-clamav/scan-local.cjs');
const {verifyQueueCandidate}=require('../rc1964-clamav/cloud-job-preflight.cjs');
const {createCandidateAttestation}=
 require('../rc1963-clamav/scan-candidate-attestation.cjs');
const {verifyClamAvEngine}=
 require('../rc1972-clamav/engine-selftest.cjs');

const DENIED=Object.freeze({authorizedForRelease:false,dispatchAuthorized:false,deployAuthorized:false});
const blocked=reason=>({...DENIED,status:'blocked',reason});
const HEX64=/^[a-f0-9]{64}$/;
const freshHash=b=>crypto.createHash('sha256').update(b).digest('hex');

function snapshotMatches(snapshot,expected){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    !Buffer.isBuffer(snapshot.bytes)||snapshot.bytes.length<1||
    snapshot.bytes.length>MAX_BYTES||snapshot.bytes.length!==expected.bytes||
    typeof snapshot.etag!=='string'||snapshot.etag!==expected.blobEtag||
    !HEX64.test(expected.uploadSha256))return false;
 const actual=Buffer.from(freshHash(snapshot.bytes),'hex');
 const wanted=Buffer.from(expected.uploadSha256,'hex');
 return crypto.timingSafeEqual(actual,wanted);
}

// trust-boundary adapters MUST be implemented by a separate, authorized Azure
// job: claimJob must atomically claim jobId once; readSnapshot must resolve
// an opaque ID against fixed server-controlled TESTSERVICE quarantine scope,
// enforce Azure ETag/version and cap the download BEFORE buffering;
// getDefinitionsUpdatedAt must inspect trusted ClamAV signature metadata.
// Tests may inject synthetic adapters, but those cannot grant parser access.
async function scanOfflineCandidate({
 envelope,expected,queueSecret,proofSecret,
 claimJob,readSnapshot,getDefinitionsUpdatedAt,
 runner=runClamscan,engineCheck=verifyClamAvEngine,now=Date.now()
}={}){
 if(!expected||expected.environment!=='testservice'||
    !Number.isSafeInteger(now)||now<=0)return blocked('invalid-context');
 const queue=verifyQueueCandidate({
  envelope,expected,secret:queueSecret,now
 });
 if(queue.valid!==true)return blocked('invalid-queue-proof');
 if(typeof claimJob!=='function'||typeof readSnapshot!=='function'||
    typeof getDefinitionsUpdatedAt!=='function'||typeof runner!=='function'||
    typeof engineCheck!=='function')
  return blocked('worker-adapter-unavailable');

 let stageDir=null;
 let result=blocked('worker-error');
 try{
  const jobId=envelope.payload.jobId;
  // A durable compare-and-swap lease in the future Azure adapter is mandatory.
  // A duplicate or an unavailable lease MUST NOT read the customer file.
  const claimed=await claimJob({jobId,environment:'testservice'});
  if(claimed!==true){result=blocked('job-already-claimed');}
  else{
   // RC1973: prevent any customer-blob read unless the actual engine has
   // completed a clean-control + EICAR-detection self-test. The default
   // invokes real clamscan; only synthetic tests inject a fake check.
   const engine=await engineCheck();
   if(!engine||engine.verified!==true||engine.authorizedForRelease!==false)
    return blocked('engine-self-test-failed');
   const locator=Object.freeze({jobId,environment:'testservice',
    scopeHash:expected.scopeHash,blobKeyHash:expected.blobKeyHash});
   const first=await readSnapshot(locator);
   if(!snapshotMatches(first,expected)){result=blocked('blob-context-mismatch');}
   else{
    stageDir=await fs.mkdtemp(path.join(os.tmpdir(),'exporthub-rc1965-'));
    await fs.chmod(stageDir,0o700);
    const stage=path.join(stageDir,'candidate.bin');
    await fs.writeFile(stage,first.bytes,{flag:'wx',mode:0o600});
    // Bind the candidate proof to the trusted scanner signature snapshot
    // observed BEFORE scanning. Never substitute a post-scan update as proof
    // of what the engine actually used.
    const definitionsBefore=await getDefinitionsUpdatedAt();
    // RC1971: never start an expensive scan with invalid, future, or stale
    // definitions. The later candidate-proof check alone was too late.
    if(!Number.isSafeInteger(definitionsBefore)||definitionsBefore<=0||
       definitionsBefore>now||now-definitionsBefore>24*60*60*1000)
     throw Error('RC1971_DEFINITIONS_NOT_CURRENT');
    // The RC1956 scanner copies again into its own private, immutable directory
    // and returns no release permission even when clamscan exits 0.
    const scanned=await scanLocalQuarantine({
     rootDir:stageDir,filePath:stage,runner
    });
    if(!scanned||scanned.verdict!=='candidate-clean'){
     result=blocked(scanned&&scanned.verdict==='infected'?'malware-detected':'scan-unverified');
    }else if(scanned.sha256!==expected.uploadSha256||
             scanned.bytes!==expected.bytes){
     result=blocked('scanned-bytes-mismatch');
    }else{
     const second=await readSnapshot(locator);
     if(!snapshotMatches(second,expected)){
      result=blocked('blob-changed-after-scan');
     }else{
      const definitionsAfter=await getDefinitionsUpdatedAt();
      if(definitionsAfter!==definitionsBefore){
       // Signatures updated during scan: the observed post-scan freshness
       // cannot attest the engine signatures that scanned these bytes.
       result=blocked('definitions-changed-during-scan');
      }else{
       // Only candidate evidence. An authorized worker must additionally
       // prove this metadata belongs to the actual loaded scan engine.
       const receipt=createCandidateAttestation({
        candidate:scanned,context:expected,secret:proofSecret,
        definitionsUpdatedAt:definitionsBefore,now
       });
       result={...DENIED,status:'candidate-only',receipt};
      }
     }
    }
   }
  }
 }catch(_){
  // Never leak storage errors, blob paths, signed secrets or scanner stderr.
  result=blocked('worker-error');
 }finally{
  if(stageDir){
   try{await fs.rm(stageDir,{recursive:true,force:true});}
   catch(_){
    // Cleanup failures invalidate even a cryptographically sound candidate.
    result=blocked('cleanup-failed');
   }
  }
 }
 return result;
}
module.exports={scanOfflineCandidate};
