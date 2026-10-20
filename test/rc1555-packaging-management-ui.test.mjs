import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const JS='assets/rc1555-packaging-management.js';
const CSS='assets/rc1555-packaging-management.css';
function read(path){return fs.readFileSync(path,'utf8');}

test('RC1555 primary packaging management runtime is standalone, admin-only and uses central i18n',()=>{
  assert.equal(fs.existsSync(JS),true,'primary packaging management runtime missing');
  assert.equal(fs.existsSync(CSS),true,'primary packaging management stylesheet missing');
  const js=read(JS);
  assert.match(js,/ExportHUBI18n/,'management must use central ExportHUB i18n');
  assert.doesNotMatch(js,/const\s+TEXT\s*=|\bTEXT\s*=\s*\{/,'management must not own a private translation table');
  assert.match(js,/globalAdmin|isAdmin/,'management navigation/actions must be admin-only');
  assert.match(js,/\/api\/packaging-admin/,'management must use canonical packaging admin API');
  assert.doesNotMatch(js,/location\.reload|location\.assign|location\.replace|window\.location\s*=/i,'packaging CRUD must not reload/navigate the app');
});

test('RC1555 exposes Management → Stammdaten → Verpackungen navigation and breadcrumb',()=>{
  const js=read(JS);
  for(const marker of ['data-rc1555-packaging-nav','data-rc1555-packaging-surface','data-rc1555-packaging-breadcrumb'])assert.ok(js.includes(marker),`${marker} missing`);
  for(const key of ['packaging.masterdata.breadcrumbManagement','packaging.masterdata.breadcrumbMasterdata','packaging.masterdata.nav'])assert.ok(js.includes(key),`${key} missing`);
  assert.match(js,/management/i,'management anchor discovery missing');
});

test('RC1555 masterdata view provides requested columns search status filter sorting and actions',()=>{
  const js=read(JS);
  for(const marker of ['data-packaging-search','data-packaging-status-filter','data-packaging-sort','data-packaging-rows'])assert.ok(js.includes(marker),`${marker} missing`);
  for(const value of ['name','status','updatedAt'])assert.match(js,new RegExp(`value=[\\]?['\"]${value}[\\]?['\"]`),`sort ${value} missing`);
  assert.match(js,/\['name','code','dimensions','ldm','description','status','updatedAt','updatedBy','actions'\]/,'requested table column model (incl. standard dimensions and LDM, decided 2026-10-18) missing');
  assert.match(js,/tr\('packaging\.masterdata\.'\+key\)/,'column labels must resolve through packaging.masterdata.* i18n keys');
  for(const action of ['edit','duplicate','toggle','delete'])assert.ok(js.includes(`button('${action}'`),`action ${action} missing`);
  assert.ok(js.includes('data-packaging-action="create"'),'action create missing');
});

test('RC1555 create/edit form covers name, code, standard dimensions L×W×H, LDM, description and active status',()=>{
  const js=read(JS);
  for(const name of ['name','code','description','active'])assert.match(js,new RegExp(`name=[\\]?['\"]${name}[\\]?['\"]`),`form field ${name} missing`);
  // Scope decision 2026-10-18: standard dimensions and LDM belong to the master data (the API already stores l/w/h/ldm).
  for(const name of ['l','w','h','ldm'])assert.match(js,new RegExp(`name=[\\]?['\"]${name}[\\]?['\"] type=[\\]?['\"]number`),`dimension field ${name} missing`);
  for(const collision of ['length','width','height'])assert.doesNotMatch(js,new RegExp(`name=[\\]?['\"]${collision}[\\]?['\"]`),`${collision} collides with HTMLFormElement properties (form.elements.length)`);
  assert.match(js,/dimensionsInvalid/,'non-positive dimensions must be rejected in the form');
  assert.match(js,/function fixedDims\(/,'fixed standard dimensions (E3) must not be editable');
  assert.match(js,/confirmDelete/,'delete confirmation is required');
});

test('RC1555 management synchronizes canonical state/store in place after mutations',()=>{
  const js=read(JS);
  assert.match(js,/packagingTypes\s*=/,'canonical state packagingTypes must be updated');
  assert.match(js,/colliTypes\s*=/,'legacy active projection must remain synchronized during cutover');
  assert.match(js,/inactiveColliTypes\s*=/,'legacy inactive projection must remain synchronized during cutover');
  assert.match(js,/ExportHUBPackagingStore/,'browser canonical store must be refreshed');
  assert.match(js,/exporthub:packaging-masterdata-changed/,'collection-specific change event must be emitted');
  assert.match(js,/updatedBy/,'changed-by metadata must be rendered');
});

test('RC1555 packaging masterdata layout is responsive and contains local overflow',()=>{
  const css=read(CSS);
  assert.match(css,/overflow-x\s*:\s*auto/,'table overflow must stay inside its own container');
  assert.match(css,/@media\s*\(max-width\s*:/,'mobile/narrow breakpoint missing');
  assert.match(css,/max-width\s*:\s*100%/,'surface must be width-safe');
});
