// RC1627: An HTTP-200 save ack with concurrentMerge used to count as failed when the
// follow-up confirmation read timed out on the large production state, so ABD uploads
// were rolled back although Azure had stored them (REF 9Z7L82). Changes made during that
// read were also overwritten by the server copy because "newer" was computed before it.
const PATCHES=[
  {
    "id": "RC1627_ACK_MERGE_READ_OPTIONAL",
    "a": "catch(error){postVerifyError=error;if(!serverAck||d.concurrentMerge===true||d.idempotentReplay===true||(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0))throw error;authoritative={ok:true,revision:Number(d.revision||runtime.revision),state:clone(sentState),users:Array.isArray(d.users)?clone(d.users):clone(sentUsers),concurrentMerge:!!d.concurrentMerge,serverSaveAck:true}}",
    "b": "catch(error){postVerifyError=error;const customerDelta=Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0,ackMergedOnly=serverAck&&d.ackOnly===true&&(d.concurrentMerge===true||d.idempotentReplay===true)&&!customerDelta;if(!serverAck||customerDelta||((d.concurrentMerge===true||d.idempotentReplay===true)&&!ackMergedOnly))throw error;authoritative={ok:true,revision:ackMergedOnly?Number(runtime.revision||0):Number(d.revision||runtime.revision),state:clone(sentState),users:Array.isArray(d.users)?clone(d.users):clone(sentUsers),concurrentMerge:!!d.concurrentMerge,serverSaveAck:true,remoteRefreshPending:ackMergedOnly}}"
  },
  {
    "id": "RC1627_NEWER_AFTER_CONFIRM",
    "a": "const sanitizeResult=authoritative&&",
    "b": "const newerAfterConfirm=newer||Number(runtime.changeGeneration||0)>generation;const sanitizeResult=authoritative&&"
  },
  {
    "id": "RC1627_REBASE_AFTER_CONFIRM",
    "a": "if(newer){rebaseLiveStateFromRemote(authoritative,sentState,currentLive);runtime.dirty=true;runtime.pendingSave=true}",
    "b": "if(newerAfterConfirm){rebaseLiveStateFromRemote(authoritative,sentState,currentLive);runtime.dirty=true;runtime.pendingSave=true}"
  },
  {
    "id": "RC1627_FOLLOWUP_AFTER_CONFIRM",
    "a": "if(newer)runtime.followupSaveNeeded=true",
    "b": "if(newerAfterConfirm)runtime.followupSaveNeeded=true"
  },
  {
    "id": "RC1627_REFRESH_AFTER_ACK",
    "a": "runtime.writeForbiddenUser='';if(info)",
    "b": "runtime.writeForbiddenUser='';if(authoritative&&authoritative.remoteRefreshPending){runtime.lastRemoteRefreshPendingAt=new Date().toISOString();try{scheduleRevisionPoll(1500)}catch(_){}}if(info)"
  }
];
/**
 * Apply after RC1600 hardenCustomerSaveHtml. Customer deltas keep the strict RC1600 readback.
 * Throw on any changed or ambiguous anchor so no release silently omits these fixes.
 */
export function hardenAckMergeSaveHtml(source){
  let html=String(source);
  for(const patch of PATCHES){
    const occurrences=html.split(patch.a).length-1;
    if(occurrences!==1)throw new Error('RC1627 '+patch.id+': expected one source anchor, found '+occurrences);
    html=html.replace(patch.a,patch.b);
  }
  return html;
}
export const RC1627_PATCH_COUNT=PATCHES.length;
