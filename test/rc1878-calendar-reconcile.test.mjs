import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(new URL('..',import.meta.url).pathname);
const calendar=readFileSync(resolve(root,'assets/abholkalender.js'),'utf8');
const route=readFileSync(resolve(root,'api/pickup-transport-reconcile/index.js'),'utf8');
const service=readFileSync(resolve(root,'api/shared/pickup-transport-reconcile.js'),'utf8');
test('calendar remains valid JavaScript and schedules a bounded server reconcile',()=>{
 assert.doesNotThrow(()=>new vm.Script(calendar));
 assert.match(calendar,/function schedulePickupReconcile\(force\)/);
 assert.match(calendar,/\.slice\(0,5\)/);
 assert.match(calendar,/rc1878At<30000/);
 assert.match(calendar,/setTimeout\(run,650\)/);
});
test('the request sends only pickup dates and uses existing same-origin credentials',()=>{
 assert.match(calendar,/fetch\('\/api\/pickup-transport-reconcile'/);
 assert.match(calendar,/method:'POST',credentials:'same-origin',cache:'no-store',redirect:'manual'/);
 assert.match(calendar,/body:JSON\.stringify\(\{dates\}\)/);
 assert.doesNotMatch(calendar,/body:JSON\.stringify\(\{dates,\s*shipments/);
});
test('sync happens when calendar loads and its shipment/task data change',()=>{
 assert.match(calendar,/requestState\.canEdit = data\.canEdit === true;\s+schedulePickupReconcile\(false\)/);
 assert.match(calendar,/function setWeekOffset\(offset\)[\s\S]*?schedulePickupReconcile\(false\)/);
 assert.match(calendar,/function setShipments\(shipments, errorMessage\)[\s\S]*?schedulePickupReconcile\(true\)/);
 assert.match(calendar,/function setTasks\(tasks\)[\s\S]*?schedulePickupReconcile\(true\)/);
});
test('the server only uses logged-in team state and never accepts browser REF data',()=>{
 assert.match(route,/auth\.clientsForEnvironment\(environment\)/);
 assert.match(route,/auth\.readJson\(clients\.team,auth\.emptyTeam\(\)\)/);
 assert.match(route,/rights\.canEditAny\(logged\.user,\['planning'\]\)/);
 assert.match(route,/rights\.canReadAny\(logged\.user,\['shipment'\]\)/);
 assert.match(route,/service\.reconcile\(\{/);
 assert.doesNotMatch(route,/payload\.shipments|payload\.transports|payload\.tasks/);
 assert.match(service,/registrationProof\.inspect\(\{/);
 assert.match(service,/linkStore\.applyAutomatic\(\{/);
});
test('transport conflicts, manual exceptions and completed shipment states remain protected',()=>{
 assert.match(service,/shipmentsFromState\(snapshot\)/);
 assert.match(service,/registrationProof\.inspect/);
 assert.match(service,/verifiedTransports/);
 assert.match(service,/expectedRevision:prior\.revision/);
 assert.match(calendar,/Fail closed: never claim a REF link was saved on API failure/);
});
test('no background poller, browser token or direct document write is added',()=>{
 assert.doesNotMatch(calendar,/setInterval\s*\(/);
 assert.doesNotMatch(calendar,/\/api\/pickup-pod|\/api\/pod-backup/);
 assert.doesNotMatch(service,/podFiles\s*=|signatureBlobName\s*=|pickupHistory\s*=/);
 assert.doesNotMatch(route,/payload\.proof|payload\.actor/);
});
