import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for(const file of ['index.html','TESTVERSION.html']){
 test(`RC1713 ${file}: count edit is captured before async lock and restored before reconciliation`,()=>{
  const source=readFileSync(file,'utf8');
  const begin=source.indexOf('function captureColliSaveDraft(){');
  const end=source.indexOf('async function saveAction(){',begin);
  assert(begin>=0&&end>begin,'capture helper is present');
  const block=source.slice(begin,end);
  const active=source.slice(end,source.indexOf('function selectSaved(){',end));
  assert.match(active,/var colliDraft=captureColliSaveDraft\(\);/);
  assert.match(active,/restoreLocalFieldDraft\(\);syncVisibleShipmentFields\(\);if\(colliDraft&&colliDraft.length\)\{paintRowsForSave\(colliDraft\);localRowsDirty=true\}syncRows\(\);reconcileLatestSavedBeforeSave\(\);/);
  const stored={type:'Euro Palette',count:2,weight:100,ldm:0.4,l:120,w:80,h:110};
  const create=(visible,dirty=false,saved=stored)=>{
   const context={
    rowNodes:()=>[{}],shipment:()=>({rows:[stored]}),currentSaved:()=>saved?{rows:[saved]}:null,
    arr:v=>Array.isArray(v)?v:[],readRow:()=>visible,normalizeRow:r=>r,
    q:v=>String(v??'').trim(),num:v=>Number(v)||0,localRowsDirty:dirty,JSON
   };
   vm.createContext(context);
   vm.runInContext(block,context);
   return context.captureColliSaveDraft();
  };
  const changed=create({...stored,count:5});
  assert.equal(changed?.[0]?.count,5,'edited count must not be replaced by persisted count');
  assert.equal(create({...stored}),null,'unchanged rows need no forced restoration');
  assert.equal(create({...stored},true)?.[0]?.count,2,'dirty rows are preserved');
  assert.equal(create({...stored,count:0})?.[0]?.count,0,'invalid edit still reaches normal save validation');
  assert.equal(create({...stored,count:3},false,null),null,'fresh shipment continues through the original save path');
 });
}

test('RC1713: TESTSERVICE E2E covers edit, re-save and Azure readback after reload',()=>{
 const source=readFileSync('e2e/specs/shipment-create.spec.mjs','utf8');
 assert.match(source,/const editedRow=page\.locator\('#rc573ColliCard/);
 assert.match(source,/await editedCount\.fill\('2'\)/);
 assert.match(source,/await saveButton\.click\(\)/);
 assert.match(source,/await page\.reload\(\{waitUntil:'domcontentloaded'\}\)/);
 assert.match(source,/expect\(resaved\.colli[\s\S]*?\)\.toBe\(2\)/);
 assert.match(source,/expect\(resaved\.count[\s\S]*?\)\.toBe\(1\)/);
});
