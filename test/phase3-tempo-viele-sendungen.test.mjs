import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=['index.html','TESTVERSION.html'];
const read=p=>fs.readFileSync(p,'utf8');
// the functions under test live in the rc543 stability script; other scripts define their own shipmentId/isPersisted
const region=html=>{const at=html.indexOf('var statusIndexCache=null;');assert.ok(at>0,'statusIndexCache fehlt');return html.slice(html.lastIndexOf('<script',at),html.indexOf('</script>',at))};
const fn=(src,name)=>{const start=src.indexOf('function '+name+'(');assert.ok(start>=0,name+' fehlt');let depth=0,i=src.indexOf('{',start);for(;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&--depth===0)break}return src.slice(start,i+1)};

test('Phase 3 (30.10.2026): statusCopies/isPersisted nutzen einen Index statt einer Schleife über alle Sendungen',()=>{
  for(const file of files){
    const html=read(file),rc543=region(html);
    assert.match(rc543,/function statusIndex\(\)/,file);
    assert.match(fn(rc543,'statusCopies'),/statusIndex\(\)/,file);
    assert.match(fn(rc543,'isPersisted'),/idx\.persisted\.has\(sh\)/,file);
    assert.match(html,/var allShipmentsCache=null;/,file);
    assert.match(html,/function collectAllShipments\(\)/,file);
  }
});

test('Phase 3: statusCopies liefert dieselben Kopien in derselben Reihenfolge wie der alte Vergleich',async()=>{
  const html=region(read('index.html'));
  const start=html.indexOf('function sameStatusShipment(');
  const body=['shipmentId','shipmentRef','sameStatusShipment','statusRoots','statusIndexSignature','sameSignature','statusIndex','statusCandidates','statusCopies'].map(n=>fn(html,n)).join('\n');
  assert.ok(start>0);
  const st={shipments:[],savedShipments:[]};
  const ctx={window:{},S:()=>st,A:v=>Array.isArray(v)?v:[],Q:v=>String(v==null?'':v).trim(),L:v=>String(v==null?'':v).trim().toLowerCase(),Promise,Map,Set};
  vm.createContext(ctx);
  vm.runInContext('var statusIndexCache=null;'+body+';this.statusCopies=statusCopies;this.reset=function(){statusIndexCache=null}',ctx);
  const a={id:'1',ref:'ABC'},b={id:'2',ref:'abc'},c={id:'1'},d={id:'3',ref:'XYZ'},e={id:'1',ref:'OTHER'};
  st.shipments.push(a,d,c);st.savedShipments.push(b,e);st.shipment=b;
  const old=sh=>{const out=[];const same=(x,y)=>{if(!x||!y)return false;if(x===y)return true;const xr=ctx.L(x.ref),yr=ctx.L(y.ref);if(xr&&yr)return xr===yr;return !!x.id&&!!y.id&&x.id===y.id};const add=x=>{if(!x||typeof x!=='object'||out.includes(x))return;if(same(sh,x))out.push(x)};add(sh);[st].forEach(r=>{add(r.shipment);add(r.currentShipment);add(r.selectedShipment);r.shipments.forEach(add);r.savedShipments.forEach(add)});return out};
  for(const sh of [a,b,c,d,e,{id:'1'},{ref:'xyz'},{}]){ctx.reset();assert.deepEqual(Array.from(ctx.statusCopies(sh)),old(sh),JSON.stringify(sh))}
  // a list change in the same task must not return stale copies
  const f={id:'9',ref:'ABC'};st.shipments.push(f);
  assert.ok(ctx.statusCopies(a).includes(f),'neue Sendung fehlt nach Listenänderung');
});
