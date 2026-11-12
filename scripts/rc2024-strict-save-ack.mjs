// RC2024: RC1600 has already required a server ACK for all non-customer
// mutations. Tighten only its customer fallback; never let a local echo of
// sentState or a partial remote document approve combined shipment/ABD writes.
const BEFORE="const confirmed=(Array.isArray(stateDelta.customers)&&stateDelta.customers.length>0)?criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta):serverAck;if(!confirmed){rebaseLiveStateFromRemote(authoritative,baseBefore,currentLive);runtime.dirty=true;runtime.pendingSave=true;";
const LEGACY="const confirmed=serverAck||criticalSaveDeltaConfirmed(authoritative&&authoritative.state,stateDelta);if(!confirmed){rebaseLiveStateFromRemote(authoritative,baseBefore,currentLive);runtime.dirty=true;runtime.pendingSave=true;";
const AFTER=[
 "const confirmed=serverAck||(",
 " Array.isArray(stateDelta&&stateDelta.customers)&&stateDelta.customers.length>0&&",
 " authoritative&&authoritative.clientSaveAck!==true&&isObject(authoritative.state)&&",
 " criticalSaveDeltaConfirmed(authoritative.state,stateDelta)&&",
 " syncedCollectionsContainDelta(authoritative.state,stateDelta)",
 ");if(!confirmed){runtime.dirty=true;runtime.pendingSave=true;"
].join('');
export function patchRc2024StrictSaveAckHtml(source,file='index.html'){
 const html=String(source);
 const done=html.split(AFTER).length-1;
 const ready=html.split(BEFORE).length-1;
 const legacy=html.split(LEGACY).length-1;
 if(done===1&&ready===0&&legacy===0)return html;
 if(ready===1&&done===0&&legacy===0)return html.replace(BEFORE,AFTER);
 // Unit tests for RC1982 also patch the canonical, pre-RC1600 source. Do not
 // mutate that source. The release build first applies RC1600 + RC1627, where
 // exactly one BEFORE is mandatory. All other drift is a release failure.
 if(legacy===1&&done===0&&ready===0)return html;
 if(file==='demo.html'&&ready===0&&done===0&&legacy===0&&!html.includes('async function flushSave('))return html;
 throw new Error(file+': RC2024 post-RC1600 save confirmation anchor missing or ambiguous');
}
