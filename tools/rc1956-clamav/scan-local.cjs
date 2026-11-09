'use strict';

// RC1956 feasibility spike: local ClamAV runner for an isolated job.
// NO Azure credential access, NO API connection and NO production approval.
// Never treat a returned candidate as a release authorization.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');

const MAX_BYTES=12*1024*1024;
const DEFAULT_TIMEOUT_MS=120000;
const MAX_TIMEOUT_MS=180000;
const REDACTED=Object.freeze({authorizedForRelease:false,engine:'clamav-local-spike'});

async function snapshot(filePath,rootDir){
 const root=await fs.promises.realpath(rootDir);
 const resolved=await fs.promises.realpath(filePath);
 if(resolved===root||!resolved.startsWith(root+path.sep))return{error:'out-of-scope'};
 if((await fs.promises.lstat(filePath)).isSymbolicLink())return{error:'symlink'};
 const handle=await fs.promises.open(filePath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size<1||stat.size>MAX_BYTES)return{error:'invalid-size'};
  const bytes=await handle.readFile();
  if(bytes.length!==stat.size)return{error:'changed-during-read'};
  return{sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
   size:stat.size,modifiedMs:stat.mtimeMs,dev:stat.dev,ino:stat.ino};
 }finally{await handle.close()}
}

function runClamscan(filePath,timeoutMs=DEFAULT_TIMEOUT_MS){
 return new Promise(resolve=>{
  let child,completed=false,timedOut=false;
  const settle=(result)=>{
   if(completed)return;
   completed=true;
   clearTimeout(timer);
   resolve(result);
  };
  // No shell, no filename output, no network, and no unattended retry.
  const timer=setTimeout(()=>{timedOut=true;if(child)child.kill('SIGKILL');
   settle({exitCode:null,timedOut:true});},timeoutMs);
  try{
   child=cp.spawn('clamscan',[
    '--no-summary','--infected','--alert-exceeds-max',
    '--max-filesize=20M','--max-scansize=80M','--',filePath
   ],{stdio:['ignore','ignore','ignore'],shell:false,env:{PATH:process.env.PATH||'/usr/bin:/bin'}});
   child.once('error',()=>settle({exitCode:null,timedOut:false}));
   child.once('close',(code,signal)=>settle({exitCode:code,timedOut:timedOut||!!signal}));
  }catch(_){settle({exitCode:null,timedOut:false})}
 })
}

async function scanLocalQuarantine({filePath,rootDir,runner=runClamscan,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
 const fail=(reason)=>({...REDACTED,verdict:'unverified',reason});
 if(typeof filePath!=='string'||!path.isAbsolute(filePath)||typeof rootDir!=='string'||
    !path.isAbsolute(rootDir)||!Number.isSafeInteger(timeoutMs)||
    timeoutMs<1000||timeoutMs>MAX_TIMEOUT_MS||typeof runner!=='function')
  return fail('invalid-configuration');
 try{
  const before=await snapshot(filePath,rootDir);
  if(before.error)return fail(before.error);
  const scan=await runner(filePath,timeoutMs);
  if(!scan||scan.timedOut||![0,1,2].includes(scan.exitCode))return fail('scanner-unavailable');
  const after=await snapshot(filePath,rootDir);
  if(after.error||before.sha256!==after.sha256||before.size!==after.size||
     before.modifiedMs!==after.modifiedMs||before.dev!==after.dev||before.ino!==after.ino)
   return fail('file-changed');
  if(scan.exitCode===2)return fail('scanner-error');
  return{...REDACTED,verdict:scan.exitCode===1?'infected':'candidate-clean',
   sha256:before.sha256,bytes:before.size};
 }catch(_){return fail('io-error')}
}

module.exports={MAX_BYTES,scanLocalQuarantine,runClamscan};
