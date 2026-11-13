// RC1171: Record only non-sensitive status and allowlisted error codes for
// TESTSERVICE state-save responses. Never collect URLs, headers or payloads.
const STATE_SAVE_ERRORS=new Set([
  'AUTH_REQUIRED','SESSION_INVALID','WRITE_FORBIDDEN',
  'STATE_MODULE_WRITE_FORBIDDEN','CONCURRENT_UPDATE',
  'STORAGE_UNREACHABLE','STATE_MISSING','STATE_METADATA_READ_UNAVAILABLE',
  'STATE_CORRUPT_RECOVERY_REQUIRED','STATE_CORRUPT_NO_BACKUP',
  'TEST_STATE_IMPORT_REQUIRED','TEST_STATE_SEED_FAILED',
  'UNKNOWN_STATE_ACTION','SERVER_ERROR'
]);

export function sanitizeStateSaveResponse(httpStatus,errorCode,ok){
  const status=Number(httpStatus);
  const safeStatus=Number.isInteger(status)&&status>=100&&status<=599?status:null;
  const code=String(errorCode||'');
  return {
    httpStatus:safeStatus,
    code:ok===true&&safeStatus!==null&&safeStatus>=200&&safeStatus<300?'OK':
      STATE_SAVE_ERRORS.has(code)?code:'UNRECOGNIZED'
  };
}

function isStateSaveRequest(url){
  try{
    const parsed=new URL(url);
    return parsed.pathname==='/api/exporthub-state'&&parsed.searchParams.get('mode')==='save';
  }catch{return false}
}

export function collectStateSaveEvidence(page){
  const entries=[],pending=new Set(),inFlight=new Set();
  let started=0,finished=0,networkFailures=0;
  function onRequest(request){
    if(!isStateSaveRequest(request.url()))return;
    started++;
    inFlight.add(request);
  }
  function onRequestFinished(request){
    if(!isStateSaveRequest(request.url()))return;
    if(inFlight.delete(request))finished++;
  }
  function append(entry){entries.push(entry);if(entries.length>12)entries.shift()}
  function onResponse(response){
    if(!isStateSaveRequest(response.url()))return;
    const task=(async()=>{
      const status=response.status();
      let code='';let ok=false;
      try{
        const body=await response.json();
        // Do not save/log response bodies; use only canonical API code and ok.
        code=body&&body.code;
        ok=body&&body.ok===true;
      }catch{}
      append(sanitizeStateSaveResponse(status,code,ok));
    })();
    pending.add(task);
    void task.finally(()=>pending.delete(task));
  }
  function onRequestFailed(request){
    if(!isStateSaveRequest(request.url()))return;
    if(inFlight.delete(request))finished++;
    networkFailures++;
    append({httpStatus:null,code:'NETWORK_FAILED'});
  }
  page.on('request',onRequest);
  page.on('response',onResponse);
  page.on('requestfinished',onRequestFinished);
  page.on('requestfailed',onRequestFailed);
  return {
    async snapshot(){
      // No pending network response may hang a diagnostics call indefinitely.
      await Promise.race([
        Promise.allSettled([...pending]),
        new Promise(resolve=>setTimeout(resolve,3000))
      ]);
      return {responses:entries.map(item=>({...item})),started,finished,inFlight:inFlight.size,networkFailures};
    },
    dispose(){
      page.off('request',onRequest);
      page.off('response',onResponse);
      page.off('requestfinished',onRequestFinished);
      page.off('requestfailed',onRequestFailed);
      inFlight.clear();
    }
  };
}
