// RC2022: A no-change generation can inherit only a VERIFIED prior Azure ACK.
// Unknown, stale or cross-environment acknowledgements remain unconfirmed.
const START='function finishNoChangeSave(reason,generation){';
const END='\nfunction azureNetworkFailure(';
const BEFORE=" runtime.pendingSave=false;runtime.dirty=false;runtime.lastSavedGeneration=Math.max(Number(runtime.lastSavedGeneration||0),Number(generation||runtime.changeGeneration||0));";
const AFTER=[
 ' // RC2022: carry a verified prior ACK only across an unchanged persistent snapshot.',
 ' const priorSaved=Number(runtime.lastSavedGeneration||0),priorAck=Number(runtime.lastServerSaveAckGeneration||0);',
 ' const ackWasVerified=priorAck>0&&priorAck>=priorSaved&&',
 "  lower(runtime.lastServerSaveAckEnvironment||'')===DATA_ENVIRONMENT&&",
 '  Number(runtime.lastServerSaveAckRevision||0)>0&&',
 '  Number(runtime.lastServerSaveAckRevision||0)>=Number(runtime.revision||0);',
 ' runtime.pendingSave=false;runtime.dirty=false;runtime.lastSavedGeneration=Math.max(priorSaved,Number(generation||runtime.changeGeneration||0));',
 ' if(ackWasVerified)runtime.lastServerSaveAckGeneration=Math.max(priorAck,runtime.lastSavedGeneration);'
].join('\n');
export function patchRc2022NoopAckHtml(source,file='index.html'){
 const html=String(source),start=html.indexOf(START);
 if(start<0){
  if(file==='demo.html'&&!html.includes('async function flushSave('))return html;
  throw new Error(file+': RC2022 no-op-save function missing');
 }
 const end=html.indexOf(END,start+START.length);
 if(end<=start||html.indexOf(START,start+START.length)>=0)
  throw new Error(file+': RC2022 no-op-save function ambiguous');
 const fn=html.slice(start,end);
 if(fn.includes(AFTER)){
  if(fn.includes(BEFORE))throw new Error(file+': RC2022 partially applied');
  return html;
 }
 if(fn.split(BEFORE).length!==2||!fn.includes('runtime.lastNoChangeAt='))
  throw new Error(file+': RC2022 unverified source contract');
 return html.slice(0,start)+fn.replace(BEFORE,AFTER)+html.slice(end);
}
