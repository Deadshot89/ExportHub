import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual upload-mount function, not just a regex on source text.
const runtime=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const start=runtime.indexOf(' function ensureUpload(){');
const end=runtime.indexOf(' function applyScanResult(index){',start);
assert.ok(start>=0&&end>start,'RC1943: mount-function boundaries exist');
const mountSource=runtime.slice(start,end);

function fixture({withEditor=false,withTabs=false,withContainer=true}={}){
 const firstChild={name:'firstChild'},invoice={name:'invoice'},tabs={name:'tabs'};
 let uploaded=null,insertions=0,refreshes=0,placement=null;
 const parent={
  firstChild,
  querySelector(selector){
   if(selector==='#rc1549AbdManual')return withEditor?invoice:null;
   if(selector==='#rc1790DocTabs')return withTabs?tabs:null;
   return null;
  },
  insertBefore(element,anchor){
   uploaded=element;placement=anchor;insertions++;
  }
 };
 const document={
  querySelector(selector){
   return selector==='#rc1940Documents [data-rc1940-document-editor]'&&withContainer?parent:null;
  },
  getElementById(id){return id==='rc1940DocumentUpload'?uploaded:null},
  createElement(tag){return {tagName:tag,addEventListener(){},innerHTML:'',id:'',className:''}}
 };
 // RC1962: the production closure also provides w and lastMode to mount the local D365 importer.
 // Supply those bindings in this isolated fixture; count local mount calls explicitly.
 let localMounts=0;
 const w={ExportHUBRC1962D365LocalImport:{mount:(mode)=>{assert.equal(mode,'invoice');localMounts++}}};
 const mount=vm.runInNewContext(mountSource+'\nensureUpload',{d:document,w,lastMode:'invoice',uploadHost:()=>uploaded,refreshUpload:()=>{refreshes++}});
 return {mount,parent,firstChild,invoice,tabs,get uploaded(){return uploaded},get placement(){return placement},get insertions(){return insertions},get refreshes(){return refreshes},get localMounts(){return localMounts}};
}

test('RC1943 P0: file selector mounts when the invoice editor is not yet available',()=>{
 const page=fixture();
 assert.equal(page.mount(),true);
 assert.equal(page.uploaded.id,'rc1940DocumentUpload');
 assert.match(page.uploaded.innerHTML,/type="file" multiple data-rc1940-files/);
 assert.match(page.uploaded.innerHTML,/\.xlsx/);
 assert.match(page.uploaded.innerHTML,/data-rc1940-analyze/);
 assert.equal(page.placement,page.firstChild);
 assert.equal(page.refreshes,1);
 assert.equal(page.localMounts,1);
});

test('RC1943: upload stays above tabs and is not duplicated on repeated re-renders',()=>{
 const page=fixture({withEditor:true,withTabs:true});
 assert.equal(page.mount(),true);
 assert.equal(page.placement,page.tabs);
 assert.equal(page.mount(),true);
 assert.equal(page.insertions,1);
 assert.equal(page.refreshes,2);
 assert.equal(page.localMounts,2);
});

test('RC1943: missing document workspace does not create an upload outside its view',()=>{
 const page=fixture({withContainer:false});
 assert.equal(page.mount(),false);
 assert.equal(page.uploaded,null);
 assert.equal(page.refreshes,0);
});
