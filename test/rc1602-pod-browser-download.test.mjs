import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('../assets/rc1602-official-pod-server-download.js',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');

test('RC1602: canonical POD click handler registers as a capture listener before legacy browser renderer',()=>{
  assert.match(source,/addEventListener\('click',[\s\S]*,true\)/);
  assert.match(source,/stopImmediatePropagation\(\)/);
  assert.doesNotMatch(source,/file=automatic&token=/,'Opening must never regenerate an automatic server PDF');
  assert.match(source,/dispatchStoredDocument/);
  assert.match(source,/RC1595/);
  assert.doesNotMatch(source,/html2canvas|pdfBase64/);
  // RC1630: the only renderer allowed is the Ladeliste & CMR POD renderer, and
  // only after every stored original failed.
  assert.match(source,/catch\(error\)\{pdf=await renderedPdf\(sh,error\)\}/);
  assert.match(builder,/injectImmediateRuntimeAfterHead\(html,RC1602_OFFICIAL_POD_SCRIPT_TAG/);
  assert.match(builder,/assets\/rc1602-official-pod-server-download\.js/);
});

function setup({withToken=true,status=200,withDocumentRow=false,withoutStoredFile=false,withSignedInline=false,serverManifestFiles=[],staleLocalId=false,createPodBlob=null,withStoredAutomaticBlob=false,corruptStoredAutomaticBlob=false,withManualPod=false}={}){
  let click=null,called=[],alerts=[],urls=[],downloaded=[],popup=null,delegated=[],storedCalls=[];
  const sh={id:'id8',ref:'8LSUHW',pickupToken:withToken?'authorized-test-token':'',podFiles:withoutStoredFile?[]:[{id:'automatic-pod-test001',kind:'automatic-pod',renderLayout:'RC1595',name:'POD_8LSUHW_Ladeliste_unterschrieben.pdf'}]};
  if(withSignedInline)sh.podFiles.unshift({id:'signed-pod-original',kind:'signed-loadlist',name:'POD_8LSUHW_Ladeliste_mit_Unterschrift.pdf',dataUrl:'data:application/pdf;base64,'+Buffer.from('%PDF-1.7\\n'+'s'.repeat(1250)).toString('base64')});
  const button={disabled:false,dataset:{id:'id8'},textContent:'POD als PDF',
    matches:s=>s.includes('data-rc628-official-pod-download')};
  const document={
    addEventListener:(event,fn,capture)=>{if(event==='click'){assert.equal(capture,true);click=fn}},
    getElementById:()=>null,
    querySelectorAll:()=>withDocumentRow?[{textContent:'POD_8LSUHW_Ladeliste_mit_Unterschrift.pdf',querySelector:(selector)=>({disabled:false,click(){delegated.push(selector)}})}]:[],
    createElement:()=>({click(){downloaded.push(true)},remove(){},set href(value){urls.push(value)},set download(value){downloaded.push(value)}}),
    body:{appendChild(){}}
  };
  const pdf=Buffer.from('%PDF-1.7\n'+'x'.repeat(1100));
  if(withStoredAutomaticBlob){const hash=createHash('sha256').update(pdf).digest('hex');sh.podFiles=[{id:'automatic-pod-'+hash.slice(0,16),kind:'automatic-pod',name:'POD_8LSUHW_Ladeliste_unterschrieben.pdf',blobName:'rc995/production/'+ 'a'.repeat(64)+'/automatic/'+hash+'-POD_8LSUHW_Ladeliste_unterschrieben.pdf',hash}];}
  if(withManualPod)sh.podFiles=[{kind:'manual-pod',manualUpload:true,name:'Customer_POD.pdf',dataUrl:'data:application/pdf;base64,'+pdf.toString('base64')}];
  const window={
    __EXPORTHUB_GET_STATE__:()=>({shipments:[sh]}),
    ExportHUBIndex240:createPodBlob?{shipments:()=>[sh],createPodBlob}:{shipments:()=>[sh]},ExportHUBPickupPOD:{shipments:()=>[],syncOne:async()=>true},
    fetch:async(url,opts)=>{
      called.push({url,opts});
      const isStale=staleLocalId&&String(url).includes('file=automatic-pod-test001&');
      const code=isStale?404:status;
      return{ok:code===200,status:code,
       blob:async()=>new Blob([pdf],{type:'application/pdf'}),
       json:async()=>String(url).includes('manifest=1')?{ok:true,files:serverManifestFiles}:{code:'TEST_FAILED',message:'Test failure'}}
    },
    setTimeout:()=>{},alert:x=>alerts.push(x)
  };
  window.crypto=webcrypto;
  window.ExportHUBDocumentBlob1059={isBlobDocument:f=>!!f.blobName,fetchBlob:async f=>{storedCalls.push(f.blobName);return new Blob([corruptStoredAutomaticBlob?Buffer.from('%PDF-1.7\n'+'z'.repeat(1100)):pdf],{type:'application/pdf'})}};
  const URL={createObjectURL:()=>'/blob/server-pod',revokeObjectURL:()=>{}};
  vm.runInNewContext(source,{window,document,URL,Blob,Uint8Array,encodeURIComponent},{filename:'rc1602-pod.js'});
  return{click,button,called,alerts,urls,downloaded,delegated,storedCalls}
}

test('RC1616: reference 8LSUHW reads the named immutable stored PDF, not a newly rendered screenshot',async()=>{
  const x=setup();
  let prevented=false,stopped=false;
  x.click({target:{closest:()=>x.button},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true},stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prevented,true);assert.equal(stopped,true);
  assert.equal(x.called.length,1);
  assert.equal(x.called[0].url,'/api/pickup-pod?file=automatic-pod-test001&token=authorized-test-token');
  assert.equal(x.called[0].opts.credentials,'same-origin');
  assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
  assert.equal(x.alerts.length,0);
});

test('RC1602: without real QR pickup token the intercepted download fails closed',async()=>{
  const x=setup({withToken:false});
  x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(x.called.length,0);
  assert.equal(x.alerts.length,1);
  assert.match(x.alerts[0],/QR-Abholtoken fehlt/);
});

test('RC1616: POD öffnen reuses the already working signed loading-list document in the shipment view',async()=>{
 const x=setup({withDocumentRow:true});
 x.button.matches=()=>true;
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(x.delegated,['[data-rc786-open-file]']);
 assert.equal(x.called.length,0,'No new or different server-rendered PDF may be requested');
 assert.equal(x.alerts.length,0);
});

test('RC1623 P0: stale local POD pointer recovers different exact stored original on 404',async()=>{
 const x=setup({staleLocalId:true,serverManifestFiles:[
  {id:'automatic-pod-fresh002',kind:'automatic-pod',renderLayout:'RC1595',uploadedAt:'2026-10-22T13:00:00Z'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,3);
 assert.match(x.called[0].url,/file=automatic-pod-test001/);
 assert.match(x.called[1].url,/manifest=1/);
 assert.match(x.called[2].url,/file=automatic-pod-fresh002/);
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic&')),false);
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('RC1623 P0: stale local POD cannot retry identical missing file or regenerate',async()=>{
 const x=setup({staleLocalId:true,serverManifestFiles:[
  {id:'automatic-pod-test001',kind:'automatic-pod',renderLayout:'RC1595'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,2);
 assert.equal(x.alerts.length,1);
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic&')),false);
});

test('RC1622: stale browser POD checks server manifest but never regenerates an absent original',async()=>{
 const x=setup({withoutStoredFile:true});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,1);
 assert.match(x.called[0].url,/\/api\/pickup-pod\?manifest=1&token=/);
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic')),false);
 assert.equal(x.alerts.length,1);
 assert.match(x.alerts[0],/gespeicherte POD-Version/);
});

test('RC1622: signed exact RC1595 POD on server is recovered despite missing local metadata',async()=>{
 const x=setup({withoutStoredFile:true,serverManifestFiles:[
  {id:'automatic-pod-test001',kind:'automatic-pod',renderLayout:'RC1595',uploadedAt:'2026-10-22T12:00:00Z'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,2);
 assert.match(x.called[0].url,/manifest=1/);
 assert.equal(x.called[1].url,'/api/pickup-pod?file=automatic-pod-test001&token=authorized-test-token');
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic&')),false);
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('RC1622 P0: immutable signed RC1600 server PDF remains downloadable when RC1595 does not exist',async()=>{
 const hash='a'.repeat(64),id='automatic-pod-'+hash.slice(0,16);
 const x=setup({withoutStoredFile:true,serverManifestFiles:[
  {id,kind:'automatic-pod',layoutVersion:'RC1600-SIGNED-LOADING-LIST-V4',source:'pickup-confirm-v3',hash,uploadedAt:'2026-10-22T12:00:00Z'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,2);
 assert.match(x.called[0].url,/manifest=1/);
 assert.equal(x.called[1].url,'/api/pickup-pod?file='+id+'&token=authorized-test-token');
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic&')),false);
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('RC1622 P0: unverified server PDF metadata cannot substitute the signed original',async()=>{
 const x=setup({withoutStoredFile:true,serverManifestFiles:[
  {id:'automatic-pod-aaaaaaaaaaaaaaaa',kind:'automatic-pod',layoutVersion:'RC1600-SIGNED-LOADING-LIST-V4',source:'pickup-confirm-v3',hash:'wrong'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,1);
 assert.equal(x.alerts.length,1);
});

test('RC1622: server manifest must not select a different or unverified render layout',async()=>{
 const x=setup({withoutStoredFile:true,serverManifestFiles:[
  {id:'untrusted-pod-01',kind:'automatic-pod',renderLayout:'RC1594'}
 ]});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,1);
 assert.equal(x.alerts.length,1);
});

test('RC1616: overview POD opens the existing signed PDF bytes without the document panel or server regeneration',async()=>{
 const x=setup({withSignedInline:true});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.called.length,1);
 assert.match(x.called[0].url,/^data:application\/pdf;base64,/);
 assert.equal(x.called.some(c=>String(c.url).includes('file=automatic')),false);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
 assert.equal(x.alerts.length,0);
});

test('RC1630: overview POD without QR token uses the working Ladeliste & CMR POD renderer',async()=>{
 const rendered=[];
 const x=setup({withToken:false,createPodBlob:async(sh)=>{rendered.push(sh.ref);return{blob:new Blob([Buffer.from('%PDF-1.7\n'+'r'.repeat(1200))],{type:'application/pdf'}),name:'POD_8LSUHW_Ladeliste_mit_Unterschrift.pdf'}}});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.deepEqual(rendered,['8LSUHW']);
 assert.equal(x.called.length,0);
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('RC1630: missing stored original falls back to the Ladeliste & CMR renderer instead of failing',async()=>{
 const rendered=[];
 const x=setup({withoutStoredFile:true,createPodBlob:async(sh)=>{rendered.push(sh.ref);return{blob:new Blob([Buffer.from('%PDF-1.7\n'+'r'.repeat(1200))],{type:'application/pdf'})}}});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.match(x.called[0].url,/manifest=1/);
 assert.deepEqual(rendered,['8LSUHW']);
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('RC1630: stored original still wins over the renderer',async()=>{
 const rendered=[];
 const x=setup({createPodBlob:async()=>{rendered.push(true);return null}});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(rendered.length,0);
 assert.equal(x.called[0].url,'/api/pickup-pod?file=automatic-pod-test001&token=authorized-test-token');
 assert.equal(x.alerts.length,0);
});

test('RC1630: renderer refusal (no real signature) is reported, never swallowed',async()=>{
 const x=setup({withToken:false,createPodBlob:async()=>{throw new Error('Es liegt noch kein echter POD mit digitaler Unterschrift vor.')}});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(x.alerts.length,1);
 assert.match(x.alerts[0],/kein echter POD/);
});


test('P0: signed automatic POD opens from its immutable authenticated Azure blob even without pickup token',async()=>{
 const x=setup({withToken:false,withStoredAutomaticBlob:true});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(x.storedCalls.length,1,'The exact existing signed document must be read');
 assert.equal(x.called.length,0,'No stale QR token or on-demand regeneration needed');
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('P0: a damaged automatic POD cannot be silently opened when its SHA-256 differs',async()=>{
 const x=setup({withToken:false,withStoredAutomaticBlob:true,corruptStoredAutomaticBlob:true});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(x.storedCalls.length,1);
 assert.equal(x.downloaded.length,0);
 assert.equal(x.alerts.length,1);
});

test('P0: manually uploaded POD in podFiles can open without the old signed loading-list filename',async()=>{
 const x=setup({withToken:false,withManualPod:true});
 x.click({target:{closest:()=>x.button},preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(x.alerts.length,0);
 assert.ok(x.downloaded.includes('POD_8LSUHW_Ladeliste_unterschrieben.pdf'));
});

test('P0: signed POD without storage label is recognized by the authenticated document viewer',()=>{
 const source1059=fs.readFileSync(new URL('../assets/rc1059-document-blob.js',import.meta.url),'utf8'),window={location:{hostname:'exporthub360.com'}};
 vm.runInNewContext(source1059,{window,URL},{filename:'rc1059-document-blob.js'});
 const name='rc995/production/'+ 'a'.repeat(64)+'/automatic/POD_8LSUHW_Ladeliste_unterschrieben.pdf';
 assert.equal(window.ExportHUBDocumentBlob1059.isBlobDocument({kind:'automatic-pod',blobName:name}),true);
 assert.equal(window.ExportHUBDocumentBlob1059.isBlobDocument({kind:'not-a-pod',blobName:name}),false);
 assert.equal(window.ExportHUBDocumentBlob1059.isBlobDocument({kind:'automatic-pod',blobName:'rc995/testservice/'+ 'a'.repeat(64)+'/automatic/x.pdf'}),true);
});
