// RC2024 P0: A local clone of an unverified server response must not approve
// an actual shipment / ABD / Pack state mutation. Preserve the dirty delta for
// idempotent retry instead of rebasing it against a manufactured local state.
const BEFORE='const confirmed=serverAck||criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta);if(!confirmed){rebaseLiveStateFromRemote(authoritative,baseBefore,currentLive);runtime.dirty=true;runtime.pendingSave=true;';
const AFTER=[
 'const confirmed=serverAck||(',
 ' Array.isArray(stateDelta&&stateDelta.customers)&&stateDelta.customers.length>0&&',
 ' authoritative&&authoritative.clientSaveAck!==true&&isObject(authoritative.state)&&',
 ' criticalSaveDeltaConfirmed(authoritative.state,stateDelta)&&',
 ' syncedCollectionsContainDelta(authoritative.state,stateDelta)',
 ');if(!confirmed){runtime.dirty=true;runtime.pendingSave=true;'
].join('');
export function patchRc2024StrictSaveAckHtml(source,file='index.html'){
 const html=String(source);
 if(html.split(AFTER).length===2){
  if(html.includes(BEFORE))throw new Error(file+': RC2024 partial save patch');
  return html;
 }
 if(html.split(BEFORE).length!==2){
  if(file==='demo.html'&&!html.includes('async function flushSave('))return html;
  // An index/TESTVERSION build without its saver is broken, not a success.
  throw new Error(file+': RC2024 save confirmation anchor missing or ambiguous');
 }
 return html.replace(BEFORE,AFTER);
}
