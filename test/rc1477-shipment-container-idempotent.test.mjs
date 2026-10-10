import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1014-shipment-overview.js','utf8');

function element(tag='div'){
  const attrs=new Map();
  const el={tagName:String(tag).toUpperCase(),className:'',children:[],textContent:'',parentNode:null,
    setAttribute(name,value){attrs.set(name,String(value));},
    getAttribute(name){return attrs.get(name)||null;},
    appendChild(node){node.parentNode=this;this.children.push(node);return node;},
    addEventListener(){},
    remove(){if(this.parentNode&&this.parentNode.children)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;},
    querySelector(selector){
      const match=node=>{
        if(selector==='[data-rc1014-shipment-meta]')return node.getAttribute&&node.getAttribute('data-rc1014-shipment-meta')==='1';
        if(selector==='[data-rc1259-container-docs]')return node.getAttribute&&node.getAttribute('data-rc1259-container-docs')==='1';
        if(selector.startsWith('.'))return String(node.className||'').split(/\s+/).includes(selector.slice(1));
        return false;
      };
      const walk=nodes=>{for(const node of nodes){if(match(node))return node;const nested=walk(node.children||[]);if(nested)return nested;}return null;};
      return walk(this.children);
    },
    querySelectorAll(){return[];}
  };
  return el;
}

function makeHarness(){
  const card=element('article');
  card.dataset={shipmentId:'REF001'};
  card.textContent='REF001';
  let containerAppends=0,containerRemoves=0;
  const originalAppend=card.appendChild.bind(card);
  card.appendChild=node=>{
    if(node.getAttribute&&node.getAttribute('data-rc1259-container-docs')==='1'){
      containerAppends++;
      const originalRemove=node.remove.bind(node);
      node.remove=()=>{containerRemoves++;originalRemove();};
    }
    return originalAppend(node);
  };
  const body={getAttribute(name){return name==='data-exporthub-view'?'shipmentoverview':'';}};
  const doc={
    body,
    querySelectorAll(){return[card];},
    createElement(tag){return element(tag);},
    getElementById(){return null;}
  };
  const root={document:doc,location:{hostname:'prod.test'},addEventListener(){},setTimeout(){return 1;},clearTimeout(){},console,URL,
    ExportHUBI18n:{t(key,vars){if(key==='shipmentOverview.created')return`Erstellt: ${vars.date}`;if(key==='shipmentOverview.colli')return`Colli: ${vars.count}`;return key;}}
  };
  vm.runInNewContext(runtime,{globalThis:root,console,Date,URL,setTimeout:root.setTimeout,clearTimeout:root.clearTimeout});
  return {api:root.ExportHUBRC1014ShipmentOverview,card,getAppends:()=>containerAppends,getRemoves:()=>containerRemoves};
}

test('RC1477: identische Container-Dokumentation wird beim zweiten Overview-Enhance nicht entfernt und neu aufgebaut',()=>{
  const h=makeHarness();
  const shipment={id:'REF001',reference:'REF001',sealNumber:'SEAL-4711',containerDocumentationRequired:true,createdAt:'2026-10-10T10:00:00Z',totalColli:2};
  assert.equal(h.api.enhanceShipmentOverview([shipment]),1);
  assert.equal(h.getAppends(),1);
  assert.equal(h.getRemoves(),0);
  assert.equal(h.api.enhanceShipmentOverview([shipment]),1);
  assert.equal(h.getAppends(),1,'zweiter identischer Enhance darf kein neues Container-Panel anhängen');
  assert.equal(h.getRemoves(),0,'zweiter identischer Enhance darf das bestehende Panel nicht entfernen');
});
