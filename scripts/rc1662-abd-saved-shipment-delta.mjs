// RC1662 P0: RC1624 updates savedShipments on ABD upload, but the browser
// previously posted the entire savedShipments array for each change. Unlike
// shipments, the saved collection was missing from SYNC_COLLECTION_KEYS.
// Use the existing per-record delta writer and the existing protective server
// mergeCollection('savedShipments') implementation. The server uses REF-first
// identity, so REF must take priority over potentially recycled editor IDs. No changes to status rules,
// file validation, pickup permissions or Azure write acknowledgement.
const FROM="const SYNC_COLLECTION_KEYS={shipments:['id','ref'],tasks:";
const TO="const SYNC_COLLECTION_KEYS={shipments:['id','ref'],savedShipments:['ref','id'],tasks:";
const SAME_FROM="function syncRecordSameIdentity(name,a,b){\n const fields=SYNC_COLLECTION_KEYS[name]||";
const SAME_TO="function syncRecordSameIdentity(name,a,b){\n if(name==='savedShipments'){const refs=['ref','reference','shipmentRef','referenceNumber','referenceNo','refNo','refNr','sendungsnummer','exporthubRef','exportHubReference'];function reference(x){for(const key of refs){const v=lower(x&&x[key]);if(v)return v}return ''}const ar=reference(a),br=reference(b);if(ar||br)return !!ar&&ar===br;}\n const fields=SYNC_COLLECTION_KEYS[name]||";
export function patchRc1662SavedShipmentDeltaHtml(source,file='index.html'){
  const html=String(source);
  if(html.includes(TO)){
    if(!html.includes(SAME_TO))throw new Error(file+': RC1662 partially applied: savedShipments identity guard missing');
    return html;
  }
  const count=html.split(FROM).length-1;
  if(count!==1){
    if(file==='demo.html'&&!html.includes('const SYNC_COLLECTION_KEYS='))return html;
    throw new Error(file+': RC1662 savedShipments delta anchor '+count+'x statt 1x');
  }
  if(!html.includes("const shipmentRecord=name==='shipments'||name==='savedShipments'")){
    throw new Error(file+': RC1662 savedShipments delta writer missing');
  }
  const identityHits=html.split(SAME_FROM).length-1;
  if(identityHits!==1)throw new Error(file+': RC1662 savedShipments identity anchor '+identityHits+'x statt 1x');
  return html.replace(FROM,TO).replace(SAME_FROM,SAME_TO);
}
