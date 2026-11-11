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
const {verifyQueueCandidate,JOB_SHAPE}=require('../rc1964-clamav/cloud-job-preflight.cjs');
const {createCandidateAttestation}=
 require('../rc1963-clamav/scan-candidate-attestation.cjs');
const {verifyClamAvEngine}=
 require('../rc1972-clamav/engine-selftest.cjs');

// RC1975: 240 s was the candidate Container Apps Job ceiling, but the
// prior defaults allowed 2 x 120 s probes + 120 s customer scan + 2 x 35 s
// Blob reads (430 s before overhead). All values below are conservative
// design timeouts, NOT an Azure deployment or a guarantee of runtime safety.
// A future container job must enforce a separate 240 s hard execution cap.
const TIME_BUDGET=Object.freeze({
 jobMs:JOB_SHAPE.maxSeconds*1000,
 eicarProbeMs:25000,eicarProbes:2,
 customerScanMs:90000,blobReadMs:35000,blobReads:2,
 reserveMs:30000
});
const plannedMaximum=TIME_BUDGET.eicarProbeMs*TIME_BUDGET.eicarProbes+
 TIME_BUDGET.customerScanMs+TIME_BUDGET.blobReadMs*TIME_BUDGET.blobReads+
 TIME_BUDGET.reserveMs;
if(plannedMaximum>TIME_BUDGET.jobMs)
 throw Error('RC1975_INVALID_JOB_BUDGET');
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
   // RC1974: reject demonstrably stale signature metadata before the
   // EICAR preflight OR any customer Blob read. The earlier RC1971 check
   // happened after both expensive operations and wasted Consumption CPU.
   const definitionsBefore=await getDefinitionsUpdatedAt();
   if(!Number.isSafeInteger(definitionsBefore)||definitionsBefore<=0||
      definitionsBefore>now||now-definitionsBefore>24*60*60*1000)
    throw Error('RC1974_DEFINITIONS_NOT_CURRENT');
   // RC1973: prevent any customer-blob read unless the actual engine has
   // completed a clean-control + EICAR-detection self-test. The default
   // invokes real clamscan; only synthetic tests inject a fake check.
   // RC1976: self-test the EXACT runner subsequently used for customer
   // bytes. Probing the default clamscan while injecting a separate scanner
   // would falsely attest an engine that never scanned the uploaded file.
   const engine=await engineCheck({runner,timeoutMs:TIME_BUDGET.eicarProbeMs});
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
    // observed BEFORE scanning, including across the EICAR preflight.
    // A refreshed database during the preflight must not be attested as
    // the signatures actually used by the worker's scan process.
    const definitionsImmediatelyBeforeScan=await getDefinitionsUpdatedAt();
    if(definitionsImmediatelyBeforeScan!==definitionsBefore)
     throw Error('RC1974_DEFINITIONS_CHANGED_DURING_PREFLIGHT');
    // The RC1956 scanner copies again into its own private, immutable directory
    // and returns no release permission even when clamscan exits 0.
    const scanned=await scanLocalQuarantine({
     rootDir:stageDir,filePath:stage,runner,
     timeoutMs:TIME_BUDGET.customerScanMs
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
module.exports={scanOfflineCandidate,TIME_BUDGET};
