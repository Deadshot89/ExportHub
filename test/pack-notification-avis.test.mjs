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

function avisFixture(view,shared){
  const root={__EXPORTHUB_GET_STATE__:()=>shared,ExportHUBPackI18n:{t:key=>key}};
  const elements=new Map(),writes=[];
  const host={appendChild(node){elements.set(node.id,node);}};
  const body={getAttribute(key){return key==='data-exporthub-view'?view:null;}};
  root.document={
    body,
    addEventListener(){},
    getElementById(id){return elements.get(id)||(
      id==='content'||id==='rc363BlockDocuments'?host:null
    );},
    createElement(){
      const node={id:'',className:'',__packAvisRenderKey:null,remove(){elements.delete(this.id);}};
      Object.defineProperty(node,'innerHTML',{
        get(){return this._html||'';},
        set(value){writes.push(value);this._html=value;}
      });
      return node;
    }
  };
  return{api:load(root),root,elements,writes,host};
}
function threeNotes(){
  return ['DNC3019228460.pdf','DNC3019228465.pdf','DNC3019228500.pdf']
    .map((name,index)=>({
      id:'doc-'+index,name,source:'pack_notification',packNotificationId:'pn-neff',
      blobName:'rc1059/testservice/aa/'+String(index+1).repeat(64),
      customerAvisVisible:true,customerVisible:true
    }));
}
test('pack detail must never show AVIS controls from a stale shipment editor',()=>{
  const stale={id:'old-shipment',ref:'OLD001',packNotificationId:'pn-old',
    deliveryFiles:[{id:'old-note',source:'pack_notification',packNotificationId:'pn-old'}]};
  const shared={shipment:stale,packNotifications:[{id:'pn-neff',documents:threeNotes()}]};
  const fixture=avisFixture('packnotification',shared);
  assert.equal(fixture.api.renderPanel(),false);
  assert.equal(fixture.elements.has('packAvisDocumentPanel'),false);
  const panel=fixture.root.document.createElement('section');
  panel.id='packAvisDocumentPanel';fixture.elements.set(panel.id,panel);
  assert.equal(fixture.api.renderPanel(),false);
  assert.equal(fixture.elements.has('packAvisDocumentPanel'),false,'remove a previously injected stale panel');
});
test('saved shipment AVIS shows all three uploaded Neff PDFs rather than incomplete editor snapshot',()=>{
  const notes=threeNotes();
  const shared={
    shipmentViewId:'NEFF01',
    shipment:{id:'sh-neff',ref:'NEFF01',packNotificationId:'pn-neff',
      deliveryFiles:[notes[0]]},
    shipments:[{id:'sh-neff',ref:'NEFF01',packNotificationId:'pn-neff',
      packNotificationLinkedAt:'2026-11-06T12:00:00Z',deliveryFiles:notes}]
  };
  const fixture=avisFixture('shipmentview',shared);
  assert.equal(fixture.api.renderPanel(),true);
  const panel=fixture.elements.get('packAvisDocumentPanel');
  assert.match(panel.innerHTML,/<strong>3\/3<\/strong>/);
  assert.equal((panel.innerHTML.match(/data-pack-avis-doc=/g)||[]).length,3);
  for(const note of notes)assert.ok(panel.innerHTML.includes(note.name));
  assert.equal(fixture.api.renderPanel(),true);
  assert.equal(fixture.writes.length,1,'observer must not endlessly rewrite identical markup');
});
test('shipment editor recovers all Pack PDF entries only from matching saved REF and owner',()=>{
  const notes=threeNotes();
  const shared={
    shipment:{id:'sh-neff',ref:'NEFF01',packNotificationId:'pn-neff',
      packNotificationRef:'PK-NEFF',deliveryFiles:[notes[0]]},
    shipments:[
      {id:'sh-neff',ref:'NEFF01',packNotificationId:'pn-neff',
        packNotificationRef:'PK-NEFF',packNotificationLinkedAt:'2026-11-06T12:00:00Z',deliveryFiles:notes},
      {id:'sh-neff',ref:'NEFF02',packNotificationId:'pn-other',
        deliveryFiles:[{id:'foreign',source:'pack_notification',packNotificationId:'pn-other'}]}
    ]
  };
  const fixture=avisFixture('shipment',shared);
  assert.equal(fixture.api.renderPanel(),true);
  const html=fixture.elements.get('packAvisDocumentPanel').innerHTML;
  assert.equal((html.match(/data-pack-avis-doc=/g)||[]).length,3);
  assert.ok(!html.includes('foreign'));
  assert.equal(fixture.api.setVisibility(shared.shipments[0],'doc-1',false),true);
  assert.equal(fixture.api.publicPackDocuments(shared.shipments[0]).length,2);
  assert.equal(fixture.api.renderPanel(),true);
  assert.match(fixture.elements.get('packAvisDocumentPanel').innerHTML,/<strong>2\/3<\/strong>/);
  assert.equal(fixture.writes.length,2,'only changed selection causes one render');
});
