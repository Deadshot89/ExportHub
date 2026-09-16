(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  let remembered=[];
  let timer=0;
  let lastRememberSignature='';
  let lastMutationAt=0;
  root.__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__=true;

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

  function formatPickupDate(value){
    const raw=q(value);
    if(!raw)return '';
    const ymd=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if(ymd)return `${ymd[3]}.${ymd[2]}.${ymd[1]}`;
    const date=new Date(raw);
    if(Number.isNaN(date.getTime()))return raw;
    const day=String(date.getDate()).padStart(2,'0');
    const month=String(date.getMonth()+1).padStart(2,'0');
    return `${day}.${month}.${date.getFullYear()}`;
  }

  function customerPickupMeta(shipment){
    const sh=shipment||{};
    const rawDate=q(sh.customerAvisPickupDate||sh.avisPickupDate);
    if(!rawDate)return {date:'',timeFrom:'',timeTo:'',label:''};
    const date=formatPickupDate(rawDate);
    const timeFrom=q(sh.customerAvisPickupTimeFrom||sh.avisPickupTimeFrom);
    const timeTo=q(sh.customerAvisPickupTimeTo||sh.avisPickupTimeTo);
    let window='';
    if(timeFrom&&timeTo)window=timeFrom+'–'+timeTo;
    else if(timeFrom)window='ab '+timeFrom;
    else if(timeTo)window='bis '+timeTo;
    return {date,timeFrom,timeTo,label:'Kunden-Abholung: '+date+(window?' · '+window:'')};
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
    const rows=[sh.colli,sh.collis,sh.packages,sh.packagingRows,sh.rows].find(Array.isArray)||[];
    if(!rows.length)return 0;
    return rows.reduce((sum,row)=>sum+rowQuantity(row),0);
  }

  function shipmentMeta(shipment){
    const created=shipmentCreatedDate(shipment);
    const colli=shipmentColliCount(shipment);
    const customerPickup=customerPickupMeta(shipment);
    return {
      created,
      colli,
      customerPickupDate:customerPickup.date,
      customerPickupTimeFrom:customerPickup.timeFrom,
      customerPickupTimeTo:customerPickup.timeTo,
      createdLabel:`Erfasst: ${created}`,
      colliLabel:`Colli: ${colli}`,
      customerPickupLabel:customerPickup.label
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
    if(meta.customerPickupLabel){
      const pickup=doc.createElement('span');
      pickup.className='rc1014-shipment-customer-pickup';
      pickup.setAttribute('data-rc1127-customer-pickup','1');
      pickup.textContent=meta.customerPickupLabel;
      row.appendChild(pickup);
    }
    return row;
  }

  function enhanceShipmentOverview(shipments=remembered){
    const doc=root.document;
    if(!doc||typeof doc.querySelectorAll!=='function'||!inShipmentOverview(doc))return 0;
    const selectors='.rc524-shipment-card,.rc485-overview-card,.rc229-shipment-card,.shipment-card,.overview-card,[data-shipment-id],[data-shipment-ref],[data-ref],[data-reference]';
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
        let pickup=row.querySelector&&row.querySelector('.rc1014-shipment-customer-pickup');
        if(created&&created.textContent!==meta.createdLabel){created.textContent=meta.createdLabel;lastMutationAt=Date.now()}
        if(colli&&colli.textContent!==meta.colliLabel){colli.textContent=meta.colliLabel;lastMutationAt=Date.now()}
        if(meta.customerPickupLabel){
          if(!pickup&&typeof doc.createElement==='function'){
            pickup=doc.createElement('span');
            pickup.className='rc1014-shipment-customer-pickup';
            pickup.setAttribute('data-rc1127-customer-pickup','1');
            row.appendChild(pickup);
            lastMutationAt=Date.now()
          }
          if(pickup&&pickup.textContent!==meta.customerPickupLabel){pickup.textContent=meta.customerPickupLabel;lastMutationAt=Date.now()}
        }else if(pickup&&typeof pickup.remove==='function'){pickup.remove();lastMutationAt=Date.now()}
      }else if(typeof card.appendChild==='function'){
        row=createMeta(doc,meta);
        card.appendChild(row);
        lastMutationAt=Date.now();
      }
      if(row){
        card.setAttribute&&card.setAttribute('data-rc1014-shipment-enhanced','1');
        enhanced++;
      }
    });
    return enhanced;
  }

  function scheduleEnhance(){
    if(!root.document||timer)return false;
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>{fn();return 1});
    timer=schedule(()=>{timer=0;enhanceShipmentOverview();},0);
    return true;
  }

  function signatureOf(shipments){
    return arr(shipments).map(sh=>{const meta=shipmentMeta(sh);return [shipmentId(sh),shipmentReference(sh),meta.createdLabel,meta.colliLabel,meta.customerPickupLabel].join('|')}).join('||');
  }

  function remember(shipments){
    remembered=arr(shipments).slice();
    const sig=signatureOf(remembered),changed=sig!==lastRememberSignature;
    lastRememberSignature=sig;
    if(changed||Date.now()-lastMutationAt>750)scheduleEnhance();
    return remembered.length;
  }

  function onRendered(){
    if(Date.now()-lastMutationAt<750)return false;
    return scheduleEnhance();
  }

  if(root.addEventListener){
    root.addEventListener('exporthub:rendered',onRendered);
    ['exporthub:viewchange','exporthub:shipment-updated','exporthub:overview-updated'].forEach(name=>root.addEventListener(name,scheduleEnhance));
  }

  root.ExportHUBRC1014ShipmentOverview=Object.freeze({
    shipmentCreatedDate,
    shipmentColliCount,
    formatPickupDate,
    customerPickupMeta,
    shipmentMeta,
    remember,
    enhanceShipmentOverview
  });
})(globalThis);
