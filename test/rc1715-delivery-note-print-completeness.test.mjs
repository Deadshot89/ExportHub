import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime({capture=true,fetchBlob=async()=>new Blob(['%PDF-1.4\noriginal\n'],{type:'application/pdf'})}={}){
  const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  const tick=String.fromCharCode(96);
  const start=source.indexOf('const rc1340Runtime='+tick),end=source.indexOf('\n'+tick+';',start);
  assert.ok(start>=0&&end>start);
  const script=vm.runInNewContext(source.slice(start,end+3)+'\nrc1340Runtime');
  const prints=[],revoked=[],overlays=[];
  let active=null;
  function el(tag){
    return{
      tag,children:[],attrs:{},handlers:{},style:{},textContent:'',
      setAttribute(k,v){this.attrs[k]=v},
      appendChild(c){this.children.push(c);c.parent=this;return c},
      addEventListener(k,cb){this.handlers[k]=cb},
      focus(){active=this},
      remove(){this.removed=true},
      click(){this.handlers.click?.()}
    };
  }
  const body=el('body');
  const originalAppend=body.appendChild.bind(body);
  body.appendChild=node=>{overlays.push(node);return originalAppend(node)};
  const document={body,activeElement:null,createElement:el};
  const window={
    location:{origin:'https://exporthub360.com',href:'https://exporthub360.com/'},
    ExportHUBDocumentBlob1059:{
      legacyUrl(file){return file.dataUrl||file.url||''},
      isBlobDocument(file){return file.storage==='blob'},
      blobName(file){return file.blobName},
      fetchBlob,
      headers(){return{'x-exporthub-test':'yes'}}
    }
  };
  if(capture)window.__EXPORTHUB_CAPTURE_ATTACHMENT_PRINT__=meta=>prints.push(meta.name);
  const URLShim={
    createObjectURL(){return 'blob:verified-'+(++URLShim.counter)},
    revokeObjectURL(u){revoked.push(u)},
    counter:0
  };
  const context={
    window,document,URL:URLShim,Blob,Uint8Array,fetch,console,
    q:x=>String(x??'').trim(),low:x=>String(x??'').trim().toLowerCase(),
    arr:x=>Array.isArray(x)?x:[],
    Promise
  };
  vm.runInNewContext(script,context);
  return{api:window.ExportHUBRC1340AttachmentPrint,prints,revoked,overlays,document};
}

test('RC1715 P0: two different original PDFs with same filename are not silently lost',async()=>{
  const {api,prints}=runtime();
  const shipment={deliveryFiles:[
    {id:'1',name:'Lieferschein.pdf',storage:'blob',blobName:'ref/one.pdf'},
    {id:'2',name:'Lieferschein.pdf',storage:'blob',blobName:'ref/two.pdf'}
  ],files:[{id:'duplicated-by-collection',name:'Lieferschein.pdf',storage:'blob',blobName:'ref/one.pdf'}]};
  assert.equal(api.printable(shipment).length,2);
  assert.equal(await api.printShipment(shipment),2);
  assert.deepEqual(prints,['Lieferschein.pdf','Lieferschein.pdf']);
});

test('RC1715 P0: an unreadable original is reported as incomplete after available originals',async()=>{
  const {api,prints}=runtime({fetchBlob:async file=>
    new Blob([file.blobName==='bad'?'<!DOCTYPE html>login':'%PDF-1.7\noriginal\n'],
      {type:'application/pdf'})});
  const shipment={deliveryFiles:[
    {name:'Fehler.pdf',storage:'blob',blobName:'bad'},
    {name:'Gut.pdf',storage:'blob',blobName:'good'}
  ]};
  await assert.rejects(()=>api.printShipment(shipment),e=>
    e.code==='DELIVERY_DOCUMENTS_INCOMPLETE'&&e.opened===1&&
    e.failed?.length===1&&e.failed[0].name==='Fehler.pdf');
  assert.deepEqual(prints,['Gut.pdf']);
});

test('RC1715 P0: falsified application/pdf data URL must fail PDF header validation',async()=>{
  const {api}=runtime();
  const shipment={deliveryFiles:[{
    name:'Fake.pdf',dataUrl:'data:application/pdf;base64,PGh0bWw+bG9naW48L2h0bWw+'
  }]};
  const jobs=await api.prepare(shipment);
  assert.equal(jobs.length,0);
  assert.equal(jobs.failed.length,1);
  assert.equal(jobs.failed[0].code,'DOCUMENT_NOT_PDF');
});

test('RC1715 P0: multi-page original stays visible until user explicitly closes viewer',async()=>{
  const {api,revoked,overlays}=runtime({capture:false});
  const item={name:'Drei_Seiten.pdf',identity:'blob:multi',url:'blob:verified-original',owned:true};
  let settled=false;
  const operation=api.printPrepared([item]).then(result=>{settled=true;return result});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(settled,false,'print preview must not finish by a timer');
  assert.equal(overlays.length,1);
  const overlay=overlays[0];
  assert.equal(overlay.attrs['data-rc1715-delivery-print-preview'],'1');
  const card=overlay.children[0],viewer=card.children[1],actions=card.children[2];
  assert.equal(viewer.attrs['data-rc1715-original-pdf'],'1');
  assert.equal(viewer.src,item.url,'original PDF URL must be unmodified');
  assert.equal(overlay.removed,undefined);
  assert.deepEqual(revoked,[],'PDF must not be revoked while preview is open');
  actions.children[2].click();
  assert.equal(await operation,1);
  assert.equal(overlay.removed,true);
  assert.deepEqual(revoked,[item.url]);
});
