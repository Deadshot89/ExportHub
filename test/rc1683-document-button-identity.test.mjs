import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1063-abd-blob-viewer-compat.js','utf8');
const file=(name,hex)=>({name,storage:'blob',blobName:'rc1059/production/ab/'+hex.repeat(64)});
function harness(){
 const calls=[];
 const state={view:'shipmentview',shipmentViewId:'SHIP-A',shipments:[
  {id:'SHIP-A',ref:'9WX5K6',deliveryFiles:[file('SIDE_FIRST.pdf','1'),file('SIDE_SECOND.pdf','2')]},
  {id:'SHIP-B',ref:'OTHER1',deliveryFiles:[file('OTHER.pdf','3')]}
 ]};
 function node(tag){
  const attrs={};
  return {
   tagName:tag,className:'',children:[],textContent:'',
   setAttribute(name,value){attrs[name]=String(value)},
   getAttribute(name){return Object.hasOwn(attrs,name)?attrs[name]:null},
   appendChild(child){this.children.push(child);return child},
   querySelector(){return null},
   querySelectorAll(selector){return selector==='.rc786-doc-row'?this.children.filter(x=>x.className==='rc786-doc-row'):[]}
  };
 }
 const panel=node('section');
 const native=node('article');native.className='rc786-doc-row';
 const nativeName={textContent:'SHAREPOINT_ORIGINAL.pdf'};
 native.querySelector=selector=>selector==='.rc786-doc-main b'?nativeName:null;
 panel.appendChild(native);
 const doc={readyState:'loading',getElementById:id=>id==='rc786ReferenceFilesPanel'?panel:null,
   createElement:node,addEventListener(){}};
 const win={document:doc,__EXPORTHUB_GET_STATE__:()=>state,
  __EXPORTHUB_RC776_VIEW_DOCS__:[{reference:'OTHER1',...file('FOREIGN_CACHE.pdf','4')}],
  ExportHUBDocumentBlob1059:{
   isBlobDocument:f=>f?.storage==='blob',
   legacyUrl:()=>'',async open(f,options){calls.push({blobName:f.blobName,name:options.name,download:options.download});return true}
  },addEventListener(){},dispatchEvent(){},alert(){}};
 vm.runInNewContext(runtime,{window:win,console,Set});
 return{state,panel,native,calls,actions:win.ExportHUBDocumentActions1151};
}

test('RC1683: SharePoint native row never receives wrong index-based Blob buttons',()=>{
 const h=harness();
 assert.equal(h.actions.patch(),true);
 assert.equal(h.native.children.length,0,'native Graph row must retain only canonical handlers');
 const own=h.panel.children.filter(x=>x.getAttribute('data-rc1151-document-row'));
 assert.equal(own.length,2,'each saved original Blob has its own correctly identified row');
 assert.equal(h.actions.patch(),false,'rerender must not duplicate Blob buttons or rows');
 assert.equal(h.panel.children.length,3);
});

test('RC1683: button identity selects exact original PDF even after attachment reorder',async()=>{
 const h=harness();h.actions.patch();
 const rows=h.panel.children.slice(1);
 const keys=rows.map(x=>x.getAttribute('data-rc1151-document-row'));
 assert.ok(keys[0].includes('1'.repeat(64)));
 assert.ok(keys[1].includes('2'.repeat(64)));
 h.state.shipments[0].deliveryFiles.reverse();
 await h.actions.open(keys[0],true,'9WX5K6');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'SIDE_FIRST.pdf');
 assert.equal(h.calls[0].blobName,file('x','1').blobName);
 assert.equal(h.calls[0].download,true);
});

test('RC1683: cached document from another REF is excluded from open shipment',()=>{
 const h=harness();
 const docs=Array.from(h.actions.documents(),d=>d.name);
 assert.deepEqual(docs,['SIDE_FIRST.pdf','SIDE_SECOND.pdf']);
 assert.ok(!docs.includes('FOREIGN_CACHE.pdf'));
});

test('RC1683: stale button from previous shipment is denied after switching REF',async()=>{
 const h=harness();h.actions.patch();
 const key=h.panel.children[1].getAttribute('data-rc1151-document-row');
 h.state.shipmentViewId='SHIP-B';
 await assert.rejects(()=>h.actions.open(key,true,'9WX5K6'));
 assert.equal(h.calls.length,0);
});

test('RC1683: ambiguous selected shipment and stale cached docs cannot trigger download',async()=>{
 const h=harness();
 h.state.shipments.push({id:'SHIP-A',ref:'WRONG1',deliveryFiles:[file('WRONG.pdf','5')]});
 const docs=Array.from(h.actions.documents());
 assert.equal(docs.length,0,'ambiguous technical ID must fail closed');
 await assert.rejects(()=>h.actions.open('rc1059/production/ab/'+ '1'.repeat(64)+'|Lieferschein',true,'9WX5K6'));
 assert.equal(h.calls.length,0);
});
