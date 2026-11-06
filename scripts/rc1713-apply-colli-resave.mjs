import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

/* RC1713: patch the active, large shipping runtime on the fix branch.
   Run only on this dedicated branch; never modify production directly. */
const anchor='async function saveAction(){window.__EXPORTHUB_SHIPMENT_SAVE_TX__=true;';
const helper=`/* RC1713: visible Colli edits survive asynchronous pickup lock checks. */
function captureColliSaveDraft(){
 var nodes=rowNodes(),previous=arr(shipment().rows),saved=currentSaved();
 if(!nodes.length)return null;
 var visible=nodes.map(function(node,i){return readRow(node,previous[i])});
 function signature(rows){return JSON.stringify(arr(rows).map(function(raw){
  var r=normalizeRow(raw);return[q(r.type),num(r.count),num(r.weight),num(r.ldm),num(r.l),num(r.w),num(r.h)]
 }))}
 var stored=arr(saved&&(saved.rows||saved.colli||saved.collis||saved.packages));
 return(localRowsDirty||(saved&&signature(visible)!==signature(stored)))?visible:null
}
`;
const oldSync='restoreLocalFieldDraft();syncVisibleShipmentFields();syncRows();reconcileLatestSavedBeforeSave();';
const newSync='restoreLocalFieldDraft();syncVisibleShipmentFields();if(colliDraft&&colliDraft.length){paintRowsForSave(colliDraft);localRowsDirty=true}syncRows();reconcileLatestSavedBeforeSave();';
function replaceOne(source,oldText,newText,path){
 const index=source.indexOf(oldText);
 assert(index>=0,`${path}: target is missing`);
 assert.equal(source.indexOf(oldText,index+oldText.length),-1,`${path}: duplicate target`);
 return source.replace(oldText,newText);
}
for(const path of ['index.html','TESTVERSION.html']){
 let source=readFileSync(path,'utf8');
 if(source.includes('function captureColliSaveDraft(){')){
  assert(source.includes(newSync),`${path}: incomplete previous patch`);
  continue;
 }
 source=replaceOne(source,anchor,helper+'async function saveAction(){var colliDraft=captureColliSaveDraft();window.__EXPORTHUB_SHIPMENT_SAVE_TX__=true;',path);
 source=replaceOne(source,oldSync,newSync,path);
 assert(source.includes('function captureColliSaveDraft(){'));
 assert(source.includes(newSync));
 writeFileSync(path,source);
 console.log(`RC1713: patched ${path}`);
}
