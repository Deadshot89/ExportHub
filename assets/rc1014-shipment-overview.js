(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  let remembered=[];
  let timer=0;

  function positiveNumber(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?n:0;
  }

  function shipmentCreatedDate(shipment){
    const sh=shipment||{};
    const raw=sh.createdAt||sh.created||sh.createdOn||sh.createdDate||sh.savedAt||'';
    if(!raw)return '—';
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return '—';
    const day=String(date.getDate()).padStart(2,'0');
    const month=String(date.getMonth()+1).padStart(2,'0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  function rowQuantity(row){
    if(typeof row==='number')return positiveNumber(row);
    const item=row||{};
    const explicit=positiveNumber(item.quantity||item.count||item.qty||item.amount||item.numberOfPackages||item.packageCount);
    return explicit||1;
  }

  function shipmentColliCount(shipment){
    const sh=shipment||{};
    const total=positiveNumber(sh.totalColli);
    if(total)return total;
    const count=positiveNumber(sh.colliCount);
    if(count)return count;
    const rows=[sh.colli,sh.collis,sh.packages,sh.packagingRows].find(Array.isArray)||[];
    if(!rows.length)return 0;
    return rows.reduce((sum,row)=>sum+rowQuantity(row),0);
  }

  function shipmentMeta(shipment){
    const created=shipmentCreatedDate(shipment);
    const colli=shipmentColliCount(shipment);
    return {
      created,
      colli,
      createdLabel:`Erfasst: ${created}`,
      colliLabel:`Colli: ${colli}`
    };
  }

  function shipmentId(shipment){
    const sh=shipment||{};
    return q(sh.id||sh.shipmentId||sh.reference||sh.ref||sh.shipmentRef).toUpperCase();
  }

  function shipmentReference(shipment){
    const sh=shipment||{};
    return q(sh.reference||sh.ref||sh.shipmentRef||sh.id||sh.shipmentId).toUpperCase();
  }

  function cardShipment(card,shipments){
    if(!card)return null;
    const ds=card.dataset||{};
    const ids=[ds.shipmentId,ds.shipment,ds.id,ds.shipmentRef,ds.ref,ds.reference].map(v=>q(v).toUpperCase()).filter(Boolean);
    let hit=arr(shipments).find(sh=>ids.includes(shipmentId(sh))||ids.includes(shipmentReference(sh)));
    if(hit)return hit;
    const text=q(card.textContent).toUpperCase();
    if(!text)return null;
    return arr(shipments).find(sh=>{
      const ref=shipmentReference(sh);
      return ref&&text.includes(ref);
    })||null;
  }

  function inShipmentOverview(doc){
    const body=doc&&doc.body;
    if(!body||typeof body.getAttribute!=='function')return false;
    return q(body.getAttribute('data-exporthub-view')).toLowerCase()==='shipmentoverview';
  }

  function createMeta(doc,meta){
    const row=doc.createElement('div');
    row.className='rc1014-shipment-meta';
    row.setAttribute('data-rc1014-shipment-meta','1');
    const created=doc.createElement('span');
    created.className='rc1014-shipment-created';
    created.textContent=meta.createdLabel;
    const colli=doc.createElement('span');
    colli.className='rc1014-shipment-colli';
    colli.textContent=meta.colliLabel;
    row.appendChild(created);
    row.appendChild(colli);
    return row;
  }

  function enhanceShipmentOverview(shipments=remembered){
    const doc=root.document;
    if(!doc||typeof doc.querySelectorAll!=='function'||!inShipmentOverview(doc))return 0;
    const selectors='.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference],.card';
    const cards=Array.from(doc.querySelectorAll(selectors));
    let enhanced=0;
    cards.forEach(card=>{
      const shipment=cardShipment(card,shipments);
      if(!shipment)return;
      const meta=shipmentMeta(shipment);
      let row=card.querySelector&&card.querySelector('[data-rc1014-shipment-meta]');
      if(row){
        const created=row.querySelector&&row.querySelector('.rc1014-shipment-created');
        const colli=row.querySelector&&row.querySelector('.rc1014-shipment-colli');
        if(created)created.textContent=meta.createdLabel;
        if(colli)colli.textContent=meta.colliLabel;
      }else if(typeof card.appendChild==='function'){
        row=createMeta(doc,meta);
        card.appendChild(row);
      }
      if(row){
        card.setAttribute&&card.setAttribute('data-rc1014-shipment-enhanced','1');
        enhanced++;
      }
    });
    return enhanced;
  }

  function scheduleEnhance(){
    if(!root.document)return;
    if(timer&&typeof root.clearTimeout==='function')root.clearTimeout(timer);
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>fn());
    timer=schedule(()=>{timer=0;enhanceShipmentOverview();},0);
  }

  function remember(shipments){
    remembered=arr(shipments).slice();
    scheduleEnhance();
    return remembered.length;
  }

  if(root.addEventListener){
    ['exporthub:rendered','exporthub:viewchange','exporthub:shipment-updated','exporthub:overview-updated'].forEach(name=>root.addEventListener(name,scheduleEnhance));
  }

  root.ExportHUBRC1014ShipmentOverview=Object.freeze({
    shipmentCreatedDate,
    shipmentColliCount,
    shipmentMeta,
    remember,
    enhanceShipmentOverview
  });
})(globalThis);
