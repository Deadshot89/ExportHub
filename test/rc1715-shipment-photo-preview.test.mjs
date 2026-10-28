import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../assets/rc1014-shipment-overview.js',import.meta.url),'utf8');
class El {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.classList={add(){}}}
 appendChild(x){x.parentNode=this;this.children.push(x);return x}
 setAttribute(k,v){this.attrs[k]=v}
 getAttribute(k){return this.attrs[k]||null}
 querySelector(s){
  const k=s.startsWith('[')&&s.endsWith(']')?s.slice(1,-1):'';if(!k)return null;
  const walk=n=>{for(const x of n.children){if(Object.hasOwn(x.attrs,k))return x;const y=walk(x);if(y)return y}return null};
  return walk(this)
 }
 addEventListener(){}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this)}
}
function render(data){
 const host=new El('div'),anchor=new El('section');anchor.parentNode=host;host.insertBefore=x=>host.appendChild(x);
 const doc={body:{getAttribute:()=> 'shipmentview'},getElementById:id=>id==='rc786ReferenceFilesCard'?anchor:null,querySelector:s=>host.querySelector(s),createElement:tag=>new El(tag)};
 const ctx={document:doc,__EXPORTHUB_GET_STATE__:()=>data,setTimeout:()=>1,console};
 vm.runInNewContext(script,ctx);
 const result=ctx.ExportHUBRC1014ShipmentOverview.enhanceShipmentDetailedView();
 const imgs=[];const walk=n=>{if(n.tag==='img')imgs.push(n);n.children.forEach(walk)};host.children.forEach(walk);
 return {result,imgs};
}
const photos=['loaded','number','sealed'].map(kind=>({id:'container-'+kind,kind,label:kind,uploadedAt:'2026-10-28T18:00:00Z'}));
test('P2: savedShipments photos are visible in detailed shipment preview',()=>{
 const s={view:'shipmentview',shipmentViewId:'S1',shipments:[{id:'S1',reference:'ABC123',containerPhotos:[]}],savedShipments:[{id:'S1',reference:'ABC123',containerPhotos:photos}]};
 const r=render(s);assert.equal(r.result,true);assert.deepEqual(r.imgs.map(x=>x.attrs['data-rc1259-photo-id']),photos.map(x=>x.id));
});
test('P2: saved-only shipments can show their photo previews',()=>{
 const r=render({view:'shipmentview',shipmentViewId:'S1',shipments:[],savedShipments:[{id:'S1',reference:'ABC123',containerPhotos:photos}]});
 assert.equal(r.result,true);assert.equal(r.imgs.length,3);
});
test('P2: foreign shipment with same reference must never provide photos',()=>{
 const r=render({view:'shipmentview',shipmentViewId:'S1',shipments:[{id:'S1',reference:'ABC123',containerPhotos:[]}],savedShipments:[{id:'S2',reference:'ABC123',containerPhotos:photos}]});
 assert.equal(r.result,false);assert.equal(r.imgs.length,0);
});
