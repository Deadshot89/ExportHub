'use strict';

// RC1972 - offline-only ClamAV engine self-test. It is NOT a cloud scanner,
// queue consumer, authorization decision or alternative to ABD_SCAN_PENDING.
// Called by a future, independently authenticated isolated worker BEFORE any
// customer file is read. Fails closed if a real scanner cannot detect EICAR.
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {runClamscan}=require('../rc1956-clamav/scan-local.cjs');

const MIN_TIMEOUT_MS=1000,MAX_TIMEOUT_MS=180000;
// EICAR's official non-malicious 68-byte antivirus test pattern is assembled
// only at runtime; no test sample file is shipped in the repo.
const EICAR=Buffer.from([
 'X5O!P%@AP[4\\PZX54(P^)7CC)7}',
 '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
].join(''),'ascii');
const CLEAN=Buffer.from('ExportHUB ClamAV isolated engine self-test: clean file\n','ascii');
const deny=reason=>({verified:false,authorizedForRelease:false,reason});

async function verifyClamAvEngine({runner=runClamscan,timeoutMs=120000}={}){
 if(typeof runner!=='function'||!Number.isSafeInteger(timeoutMs)||
    timeoutMs<MIN_TIMEOUT_MS||timeoutMs>MAX_TIMEOUT_MS||EICAR.length!==68)
  return deny('invalid-self-test-configuration');
 let dir=null,result=deny('engine-unavailable');
 try{
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'exporthub-clamav-selftest-'));
  await fs.chmod(dir,0o700);
  const cleanPath=path.join(dir,'clean.bin');
  const testPath=path.join(dir,'eicar.bin');
  await fs.writeFile(cleanPath,CLEAN,{mode:0o600,flag:'wx'});
  await fs.writeFile(testPath,EICAR,{mode:0o600,flag:'wx'});
  // Never let an engine proceed solely on "clean" results. Independently
  // confirm that it also detects the harmless, standardized EICAR signature.
  const clean=await runner(cleanPath,timeoutMs);
  if(!clean||clean.timedOut||clean.exitCode!==0){
   result=deny('clean-probe-failed');
  }else{
   const test=await runner(testPath,timeoutMs);
   result=(!test||test.timedOut||test.exitCode!==1)
    ?deny('eicar-not-detected')
    :{verified:true,authorizedForRelease:false,engine:'clamav',
       evidence:'local-clean-plus-eicar-self-test'};
  }
 }catch(_){
  // No filenames, contents, scanner errors or system paths in public result.
  result=deny('engine-unavailable');
 }finally{
  if(dir){
   try{await fs.rm(dir,{recursive:true,force:true});}
   catch(_){result=deny('self-test-cleanup-failed');}
  }
 }
 return result;
}

module.exports={verifyClamAvEngine};
