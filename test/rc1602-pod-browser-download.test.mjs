import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/rc1602-official-pod-server-download.js',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');

test('RC1602: canonical POD click handler registers as a capture listener before legacy browser renderer',()=>{
  assert.match(source,/addEventListener\('click',[\s\S]*,true\)/);
  assert.match(source,/stopImmediatePropagation\(\)/);
  assert.match(source,/file=automatic&token=/);
  assert.doesNotMatch(source,/html2canvas|createPodBlob|pdfBase64/);
  assert.match(builder,/injectImmediateRuntimeAfterHead\(html,RC1602_OFFICIAL_POD_SCRIPT_TAG/);
  assert.match(builder,/assets\/rc1602-official-pod-server-download\.js/);
});

function setup({withToken=true,status=200}={}){
  let click=null,called=[],alerts=[],urls=[],downloaded=[],popup=null;
  const sh={id:'id8',ref:'8LSUHW',pickupToken:withToken?'authorized-test-token':''};
  const button={disabled:false,dataset:{id:'id8'},textContent:'POD als PDF',
    matches:s=>s.includes('data-rc628-official-pod-download')};
  const document={
    addEventListener:(event,fn,capture)=>{if(event==='click'){assert.equal(capture,true);click=fn}},
    getElementById:()=>null,
    createElement:()=>({click(){downloaded.push(true)},remove(){},set href(value){urls.push(value)},set download(value){downloaded.push(value)}}),
    body:{appendChild(){}}
  };
  const pdf=Buffer.from('%PDF-1.7\n'+'x'.repeat(1100));
  const window={
    ExportHUBIndex240:{shipments:()=>[sh]},ExportHUBPickupPOD:{shipments:()=>[],syncOne:async()=>true},
    fetch:async(url,opts)=>{called.push({url,opts});return{ok:status===200,status,
      blob:async()=>new Blob([pdf],{type:'application/pdf'}),
      json:async()=>({code:'TEST_FAILED',message:'Test failure'})}},
    setTimeout:()=>{},alert:x=>alerts.push(x)
  };
  const URL={createObjectURL:()=>'/blob/server-pod',revokeObjectURL:()=>{}};
  vm.runInNewContext(source,{window,document,URL,Blob,Uint8Array,encodeURIComponent},{filename:'rc1602-pod.js'});
  return{click,button,called,alerts,urls,downloaded}
}

test('RC1602: reference 8LSUHW receives canonical server PDF, never client HTML screenshot',async()=>{
  const x=setup();
  let prevented=false,stopped=false;
  x.click({target:{closest:()=>x.button},preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true},stopPropagation(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prevented,true);assert.equal(stopped,true);
  assert.equal(x.called.length,1);
  assert.equal(x.called[0].url,'/api/pickup-pod?file=automatic&token=authorized-test-token');
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
