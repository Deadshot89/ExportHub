// RC1662 P0: RC1624 updates savedShipments on ABD upload, but the browser
// previously posted the entire savedShipments array for each change. Unlike
// shipments, the saved collection was missing from SYNC_COLLECTION_KEYS.
// Use the existing per-record delta writer and the existing protective server
// mergeCollection('savedShipments') implementation. No changes to status rules,
// file validation, pickup permissions or Azure write acknowledgement.
const FROM="const SYNC_COLLECTION_KEYS={shipments:['id','ref'],tasks:";
const TO="const SYNC_COLLECTION_KEYS={shipments:['id','ref'],savedShipments:['id','ref'],tasks:";
export function patchRc1662SavedShipmentDeltaHtml(source,file='index.html'){
  const html=String(source);
  if(html.includes(TO))return html;
  const count=html.split(FROM).length-1;
  if(count!==1){
    if(file==='demo.html'&&!html.includes('const SYNC_COLLECTION_KEYS='))return html;
    throw new Error(file+': RC1662 savedShipments delta anchor '+count+'x statt 1x');
  }
  if(!html.includes("const shipmentRecord=name==='shipments'||name==='savedShipments'")){
    throw new Error(file+': RC1662 savedShipments delta writer missing');
  }
  return html.replace(FROM,TO);
}
