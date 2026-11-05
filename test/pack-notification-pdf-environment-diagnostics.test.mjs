import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const viewer=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
const pack=fs.readFileSync('assets/pack-notification-shipment.js','utf8');

function viewerAt(hostname,environment){
  const root={location:{hostname,origin:'https://'+hostname},ExportHUBClean:{runtime:{environment}}};
  vm.runInNewContext(viewer,{window:root,URL,Uint8Array});
  return root.ExportHUBDocumentBlob1059;
}
function detail(){
  const root={};
  const source=pack.replace('  root.ExportHUBPackShipment=Object.freeze(',
    '  root.__P0_PACK_DOCUMENT_FAILURE_DETAIL__=packDocumentFailureDetail;root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(source,pack);
  vm.runInNewContext(source,{window:root,URL,Uint8Array,setTimeout,clearTimeout,Date,Intl});
  return root.__P0_PACK_DOCUMENT_FAILURE_DETAIL__;
}
test('P0 production document API cannot inherit stale TESTSERVICE runtime on official production domain',()=>{
  for(const host of ['www.exporthub360.de','exporthub360.de','www.exporthub360.com','exporthub360.com','wonderful-forest-0f315e310.westeurope.6.azurestaticapps.net','wonderful-forest-0f315e310.azurestaticapps.net']){
    const helper=viewerAt(host,'testservice');
    assert.equal(helper.environment(),'production',host);
    const blob='rc1059/production/aa/'+('a'.repeat(64));
    assert.match(helper.endpoint({blobName:blob}),/environment=production$/);
  }
});
test('P0 TESTSERVICE documents retain isolated TESTSERVICE scope',()=>{
  assert.equal(viewerAt('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','testservice').environment(),'testservice');
});
test('P0 Pack PDF errors show safe actionable HTTP/auth/PDF category without exposing token or blob path',()=>{
  const classify=detail();
  assert.equal(classify(new Error('Lieferschein konnte nicht geladen werden (HTTP 404)')),' (HTTP 404)');
  assert.equal(classify({code:'DOCUMENT_API_LOGIN_REDIRECT',message:'redirect'}),' (DOCUMENT_API_LOGIN_REDIRECT)');
  assert.equal(classify({code:'DOCUMENT_NOT_PDF',message:'invalid signature'}),' (DOCUMENT_NOT_PDF)');
  assert.equal(classify(new Error('ExportHUB login required.')),' (ExportHUB login required)');
  assert.equal(classify(new Error('Invalid ExportHUB document reference')),' (Invalid ExportHUB document reference)');
  assert.equal(classify(new Error('Original document is unavailable')),' (Document unavailable)');
  assert.equal(classify(new Error('Authorization: Bearer SECRET rc1059/production/aa/SENSITIVE')),'');
});


test('P0 protected Pack PDF fetch on production host uses Bearer token without cookies and verifies PDF original bytes',async()=>{
  const name='rc1059/production/aa/'+('a'.repeat(64));
  const requests=[];
  const expected=Buffer.from('%PDF-1.7\n% Fixture only\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
  const root={
    location:{hostname:'www.exporthub360.de',origin:'https://www.exporthub360.de'},
    ExportHUBClean:{runtime:{environment:'testservice',authToken:'stale-testservice-token'}},
    sessionStorage:{getItem:()=>JSON.stringify({environment:'production',token:'fixture-production-token',user:{id:'fixture-user'}})},
    fetch:async (url,options)=>{
      requests.push({url,options});
      return{ok:true,status:200,type:'basic',url:'https://www.exporthub360.de'+url,redirected:false,
        headers:{get:()=> 'application/pdf'},
        blob:async()=>new Blob([expected],{type:'application/pdf'})};
    }
  };
  vm.runInNewContext(viewer,{window:root,URL,Uint8Array});
  const bytes=await root.ExportHUBDocumentBlob1059.fetchBytes({blobName:name,name:'DNC3019228203.pdf',storage:'blob'});
  assert.deepEqual(Buffer.from(bytes),expected);
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/environment=production$/);
  assert.match(requests[0].url,/^\/api\/exporthub-document\?/);
  assert.equal(requests[0].options.credentials,'omit');
  assert.equal(requests[0].options.redirect,'manual');
  assert.equal(requests[0].options.headers.Authorization,'Bearer fixture-production-token');
});

test('P0 missing production session never falls back to stale TESTSERVICE runtime token',()=>{
  const root={
    location:{hostname:'www.exporthub360.de',origin:'https://www.exporthub360.de'},
    ExportHUBClean:{runtime:{environment:'testservice',authToken:'stale-testservice-token'}},
    sessionStorage:{getItem:()=>null}
  };
  vm.runInNewContext(viewer,{window:root,URL,Uint8Array});
  assert.throws(()=>root.ExportHUBDocumentBlob1059.headers(),/login required/i);
});

test('P0 actual Pack shipment Open button displays HTTP failure category rather than swallowing it',async()=>{
  const code=pack.replace('  root.ExportHUBPackShipment=Object.freeze(',
    '  root.__P0_RENDER__=renderPendingLieferscheine;root.ExportHUBPackShipment=Object.freeze(');
  assert.notEqual(code,pack);
  function node(tag){
    return{tagName:tag,children:[],attrs:{},style:{},listeners:{},parent:null,
      setAttribute(k,v){this.attrs[k]=String(v);},
      addEventListener(name,callback){this.listeners[name]=callback;},
      appendChild(child){child.parent=this;this.children.push(child);return child;},
      remove(){if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this);},
      querySelector(selector){return selector==='#rc1680PackDeliveryFiles'
        ?this.children.find(c=>c.id==='rc1680PackDeliveryFiles')||null:null;}
    };
  }
  const section=node('section');
  const docFile={name:'DNC3019228203.pdf',blobName:'rc1059/production/aa/'+('a'.repeat(64)),storage:'blob'};
  const notification={id:'PN-FIXTURE',reference:'PK-FIXTURE',documents:[docFile]};
  const state={packNotifications:[notification],shipment:{packNotificationId:'PN-FIXTURE',packNotificationRef:'PK-FIXTURE',deliveryFiles:[]}};
  const root={
    document:{getElementById:id=>id==='rc363BlockDocuments'?section:null,createElement:node},
    __EXPORTHUB_GET_STATE__:()=>state,
    addEventListener(){},
    ExportHUBDocumentBlob1059:{async open(){throw new Error('Protected document fetch failed (HTTP 404)')}}
  };
  vm.runInNewContext(code,{window:root,URL,Uint8Array,Date,Intl,setTimeout,clearTimeout});
  const prefill=root.ExportHUBPackShipment.shipmentPrefill(notification);
  state.shipment.deliveryFiles=prefill.deliveryFiles;
  assert.equal(root.__P0_RENDER__(prefill),true);
  const panel=section.children[0],row=panel.children[1];
  const open=row.children.find(c=>c.tagName==='button'&&c.textContent==='Open');
  assert.ok(open);
  open.listeners.click({preventDefault(){},stopPropagation(){}});
  await new Promise(resolve=>setTimeout(resolve,0));
  const feedback=row.children.find(c=>c.attrs.role==='status');
  assert.match(feedback.textContent,/HTTP 404/);
  assert.doesNotMatch(feedback.textContent,/blob=|fixture-token/);
});
