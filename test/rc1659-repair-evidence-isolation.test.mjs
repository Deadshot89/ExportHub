import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const { mergeState, sanitizeState }=require('../api/shared/merge.js');

// Reported live case (2026-10-24): evidence of an old August shipment stayed in the
// synced team state after "Sendung wieder öffnen" and was written into every new shipment.
const LEAKED_EVIDENCE={status:'POD vorhanden',processStatus:'POD vorhanden',podStatus:'POD vorhanden',pickedUpAt:'2026-08-14T08:16:31.616Z',actualPickupDate:'2026-08-14',pickupStatus:'abgeholt',podAvailable:true,pickupHistory:[{colliCount:2}]};

function repairRuntime(file){
  const html=fs.readFileSync(path.join(ROOT,file),'utf8');
  const start=html.indexOf('function repairActive(sh){');
  const end=html.indexOf('function markRepairAudit(sh){',start);
  assert.ok(start>0&&end>start,`${file}: RC844 repair block not found`);
  const state={__rc844RepairShipmentId:'SHIP-1786541996890-PQK83V',__rc844RepairShipmentRef:'LWYRNN',__rc844RepairEvidence:JSON.parse(JSON.stringify(LEAKED_EVIDENCE)),__rc844RepairReason:'Daten ergänzen',__rc844RepairOpenedAt:'2026-10-23T13:20:00Z'};
  const window={};
  const document={getElementById:()=>null};
  const context={window,document,state:()=>state,q:v=>String(v==null?'':v).trim(),clone:v=>JSON.parse(JSON.stringify(v))};
  vm.createContext(context);
  vm.runInContext(html.slice(start,end)+';this.api={repairActive,applyRepairEvidence,clearRepairMode};',context);
  return {state,api:context.api};
}

for(const file of ['index.html','TESTVERSION.html']){
  test(`RC1659 ${file}: stale repair evidence is never applied to a new shipment`,()=>{
    const {api}=repairRuntime(file);
    const fresh={id:'SHIP-1792836115515-7CAHH2',shipmentId:'SHIP-1792836115515-7CAHH2',ref:'DRLMGN',status:'Erstellt',pickedUpAt:'',actualPickupDate:'',podAvailable:false,pickupHistory:[]};
    api.applyRepairEvidence(fresh);
    assert.equal(fresh.status,'Erstellt');
    assert.equal(fresh.pickedUpAt,'');
    assert.equal(fresh.actualPickupDate,'');
    assert.equal(fresh.podAvailable,false);
    assert.deepEqual(fresh.pickupHistory,[]);
  });

  test(`RC1659 ${file}: the shipment in repair mode keeps its own evidence`,()=>{
    const {api}=repairRuntime(file);
    const repaired={id:'SHIP-1786541996890-PQK83V',ref:'LWYRNN',status:'Erstellt',pickedUpAt:''};
    api.applyRepairEvidence(repaired);
    assert.equal(repaired.status,'POD vorhanden');
    assert.equal(repaired.pickedUpAt,'2026-08-14T08:16:31.616Z');
  });

  test(`RC1659 ${file}: "Neue Sendung" ends an open repair mode first`,()=>{
    const html=fs.readFileSync(path.join(ROOT,file),'utf8');
    const start=html.indexOf('function startFreshShipment(){');
    assert.ok(start>0);
    assert.match(html.slice(start,start+120),/^function startFreshShipment\(\)\{\n try\{clearRepairMode\(\)\}catch\(_\)\{\}cancelPendingEditSave\(\);/);
    const {state,api}=repairRuntime(file);
    api.clearRepairMode();
    assert.equal(Object.keys(state).some(k=>k.startsWith('__rc844Repair')),false);
  });
}

test('RC1659 server: repair mode keys are browser-only and never stored in the team state',()=>{
  const server={shipments:[],__rc844RepairEvidence:LEAKED_EVIDENCE,__rc844RepairShipmentId:'SHIP-1786541996890-PQK83V',__rc844RepairShipmentRef:'LWYRNN',__rc844RepairReason:'x',__rc844RepairOpenedAt:'2026-10-23T13:20:00Z',_teamSyncMeta:{fields:{},tombstones:[]}};
  const incoming={shipments:[],__rc844RepairEvidence:LEAKED_EVIDENCE,__rc844RepairShipmentRef:'LWYRNN',_teamSyncMeta:{fields:{},tombstones:[]}};
  const merged=mergeState(server,incoming);
  const sanitized=sanitizeState(server);
  for(const out of [merged,sanitized])
    assert.deepEqual(Object.keys(out).filter(k=>k.startsWith('__rc844Repair')),[]);
});
