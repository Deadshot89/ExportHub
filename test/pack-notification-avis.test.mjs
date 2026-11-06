import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(root={}){
  const source=fs.readFileSync('assets/pack-notification-avis.js','utf8');
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout}),{filename:'pack-notification-avis.js'});
  return root.ExportHUBPackAvis;
}
function shipment(){return{id:'sh-1',ref:'ABC123',packNotificationId:'pn-1',deliveryFiles:[
  {id:'d1',name:'LS1.pdf',source:'pack_notification',blobName:'rc1059/production/aa/'+('a'.repeat(64)),customerVisible:false,customerAvisVisible:false},
  {id:'d2',name:'LS2.pdf',source:'pack_notification',blobName:'rc1059/production/bb/'+('b'.repeat(64)),customerVisible:false,customerAvisVisible:false},
  {id:'other',name:'Other.pdf',source:'manual',customerAvisVisible:true}
]};}

test('pack documents are private by default for existing AVIS contract',()=>{
  const sh=shipment();
  for(const doc of sh.deliveryFiles.filter(d=>d.source==='pack_notification'))assert.equal(doc.customerAvisVisible,false);
  const customerAvis=fs.readFileSync('api/customer-avis/index.js','utf8');
  assert.match(customerAvis,/customerAvisVisible===false/);
});

test('setVisibility toggles only selected pack delivery note',()=>{
  const api=load(),sh=shipment();
  assert.equal(api.setVisibility(sh,'d1',true,'2026-10-08T11:30:00.000Z'),true);
  assert.equal(sh.deliveryFiles[0].customerAvisVisible,true);
  assert.equal(sh.deliveryFiles[0].customerVisible,true);
  assert.equal(sh.deliveryFiles[1].customerAvisVisible,false);
  assert.equal(sh.deliveryFiles[0].customerAvisVisibilityUpdatedAt,'2026-10-08T11:30:00.000Z');
});

test('publicPackDocuments returns only explicitly released pack documents',()=>{
  const api=load(),sh=shipment();
  api.setVisibility(sh,'d2',true,'2026-10-08T11:30:00.000Z');
  assert.deepEqual(api.publicPackDocuments(sh).map(x=>x.id),['d2']);
});

test('AVIS adapter renders a shipment panel only for pack-linked shipments and localizes visibility actions',()=>{
  const source=fs.readFileSync('assets/pack-notification-avis.js','utf8');
  assert.match(source,/renderPanel/);
  assert.match(source,/packNotificationId/);
  assert.match(source,/customerAvisVisible/);
  assert.match(source,/tr\('pack\.avis\.release'\)/);
  assert.match(source,/tr\('pack\.avis\.visible'\)/);
  assert.doesNotMatch(source,/Für AVIS freigeben|Auf AVIS sichtbar/,'AVIS action labels must come from the six-language pack catalog.');
});

test('AVIS controls are scoped to shipment views and never leak into inspections',()=>{
  const sh=shipment(),state={view:'inspections',currentShipment:sh};
  let view='inspections',panel=null;
  const content={id:'content',children:[],appendChild(el){this.children.push(el);el.parentNode=this;}};
  const host={id:'rc363BlockDocuments',children:[],appendChild(el){this.children.push(el);el.parentNode=this;}};
  const doc={
    body:{getAttribute(key){return key==='data-exporthub-view'?view:null;}},
    getElementById(id){
      if(id==='packAvisDocumentPanel')return panel&&panel.parentNode?panel:null;
      if(id==='rc363BlockDocuments')return view==='shipment'?host:null;
      if(id==='content')return content;
      return null;
    },
    createElement(){
      panel={id:'',className:'',parentNode:null,innerHTML:'',remove(){this.parentNode=null;}};
      return panel;
    },
    addEventListener(){}
  };
  const api=load({document:doc,__EXPORTHUB_GET_STATE__:()=>state});
  assert.equal(api.renderPanel(),false,'inspections must never render an AVIS panel');
  assert.equal(content.children.length,0,'global content must never receive the panel');
  state.view='shipment';view='shipment';
  assert.equal(api.renderPanel(),true);
  assert.equal(panel.parentNode,host);
  assert.match(panel.innerHTML,/LS1\.pdf/);
  const originalMarkup=panel.innerHTML;
  assert.equal(api.renderPanel(),true);
  assert.equal(panel.innerHTML,originalMarkup,'stable re-render keeps the same markup');
  state.view='inspections';view='inspections';
  assert.equal(api.renderPanel(),false);
  assert.equal(panel.parentNode,null,'navigation removes the obsolete AVIS panel');
});
