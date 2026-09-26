(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const tr=(key,vars)=>{try{return root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'?root.ExportHUBI18n.t(key,vars):key}catch(_){return key}};
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  let remembered=[];
  let timer=0;
  let lastRememberSignature='';
  let lastMutationAt=0;
  root.__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__=true;
  root.__EXPORTHUB_RC1259_CONTAINER_DOCUMENTATION__=true;

  function state(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{}}catch(_){}
    return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||{};
  }

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

  function containerMeta(shipment){
    const sh=shipment||{},photos=arr(sh.containerPhotos);
    const mode=q(sh.transportMode||sh.transportType||sh.shippingMode||sh.shipmentMode).toLowerCase();
    const required=sh.containerDocumentationRequired===true||sh.seaContainerDocumentationRequired===true;
    const seal=q(sh.sealNumber||sh.containerSealNumber||sh.siegelnummer);
    return{mode,required,seal,photos,count:photos.length,complete:['loaded','number','sealed'].every(kind=>photos.some(p=>q(p&&p.kind).toLowerCase()===kind))};
  }

  function shipmentMeta(shipment){
    const created=shipmentCreatedDate(shipment);
    const colli=shipmentColliCount(shipment);
    const customerPickup=customerPickupMeta(shipment);
    const container=containerMeta(shipment);
    return {
      created,
      colli,
      customerPickupDate:customerPickup.date,
      customerPickupTimeFrom:customerPickup.timeFrom,
      customerPickupTimeTo:customerPickup.timeTo,
      createdLabel:tr('shipmentOverview.created',{date:created}),
      colliLabel:tr('shipmentOverview.colli',{count:colli}),
      customerPickupLabel:customerPickup.label,
      container
    };
  }

  function shipmentId(shipment){
    const sh=shipment||{};
    return q(sh.id||sh.shipmentId||sh.reference||sh.ref||sh.shipmentRef).toUpperCase();
  }

  function shipmentReference(shipment){
    const sh=shipment||{};
    return q(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId).toUpperCase();
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

  function currentEnvironment(){
    try{return /-testservice\./i.test(String(root.location&&root.location.hostname||''))?'testservice':'production'}catch(_){return'production'}
  }

  function authToken(){
    const rt=root.ExportHUBClean&&root.ExportHUBClean.runtime||{};
    return q(rt.authToken||rt.sessionToken||'');
  }

  function apiHeaders(){
    const token=authToken();if(!token)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');
    return{'Accept':'*/*','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':currentEnvironment()};
  }

  async function fetchContainerBlob(shipment,photo){
    const url=photoUrl(shipment,photo,false),res=await root.fetch(url,{method:'GET',headers:apiHeaders(),credentials:'same-origin',cache:'no-store'});
    if(!res.ok){let msg='Containerfoto konnte nicht geladen werden.';try{const d=await res.json();msg=q(d&&d.message)||msg}catch(_){}throw new Error(msg)}
    return res.blob();
  }

  function hydrateContainerImages(panel,shipment){
    if(!panel||!panel.querySelectorAll)return;
    Array.from(panel.querySelectorAll('img[data-rc1259-photo-id]')).forEach(async img=>{
      const id=q(img.getAttribute('data-rc1259-photo-id')),photo=containerMeta(shipment).photos.find(p=>q(p&&p.id)===id);
      if(!photo)return;
      try{
        const blob=await fetchContainerBlob(shipment,photo),url=URL.createObjectURL(blob);
        img.onload=function(){setTimeout(function(){try{URL.revokeObjectURL(url)}catch(_){}},0)};
        img.src=url;
      }catch(e){img.alt=(img.alt||'Containerfoto')+' · nicht ladbar'}
    });
  }

  async function openContainerPhoto(shipment,photo,download){
    try{
      const blob=await fetchContainerBlob(shipment,photo),url=URL.createObjectURL(blob);
      if(download){
        const a=root.document.createElement('a');a.href=url;a.download=q(photo&&photo.name)||'Containerfoto.jpg';root.document.body.appendChild(a);a.click();a.remove();setTimeout(function(){try{URL.revokeObjectURL(url)}catch(_){}},30000)
      }else{
        const w=root.open(url,'_blank','noopener');if(!w)setTimeout(function(){try{URL.revokeObjectURL(url)}catch(_){}},30000);else setTimeout(function(){try{URL.revokeObjectURL(url)}catch(_){}},120000)
      }
    }catch(e){try{root.alert('Containerfoto konnte nicht geöffnet werden.\n\n'+q(e&&e.message||e))}catch(_){}}
    return false;
  }

  function inShipmentOverview(doc){
    const body=doc&&doc.body;
    if(!body||typeof body.getAttribute!=='function')return false;
    return q(body.getAttribute('data-exporthub-view')).toLowerCase()==='shipmentoverview';
  }

  function inShipmentView(doc){
    const body=doc&&doc.body;
    if(!body||typeof body.getAttribute!=='function')return false;
    return q(body.getAttribute('data-exporthub-view')).toLowerCase()==='shipment';
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

  function photoUrl(shipment,photo,download){
    const ref=shipmentReference(shipment),id=q(photo&&photo.id);
    if(!ref||!id)return'';
    return '/api/container-document?reference='+encodeURIComponent(ref)+'&file='+encodeURIComponent(id)+'&environment='+encodeURIComponent(currentEnvironment())+(download?'&download=1':'');
  }

  function createContainerCard(doc,shipment){
    const meta=containerMeta(shipment),wrap=doc.createElement('div');
    wrap.className='rc1259-container-docs';
    wrap.setAttribute('data-rc1259-container-docs','1');
    const head=doc.createElement('div');head.className='rc1259-container-head';
    const title=doc.createElement('strong');title.textContent='🚢 Container-Dokumentation';
    const status=doc.createElement('span');status.className='rc1259-container-status';status.textContent=(meta.required?'Pflicht · ':'')+'Fotos '+meta.count+'/3'+(meta.seal?' · Siegel '+meta.seal:'');
    head.appendChild(title);head.appendChild(status);wrap.appendChild(head);
    if(meta.seal){
      const seal=doc.createElement('div');seal.className='rc1259-seal-search';seal.textContent='Siegelnummer: '+meta.seal;seal.setAttribute('data-container-seal',meta.seal);wrap.appendChild(seal);
    }
    if(meta.photos.length){
      const grid=doc.createElement('div');grid.className='rc1259-photo-grid';
      meta.photos.forEach(photo=>{
        const item=doc.createElement('div');item.className='rc1259-photo-item';
        const img=doc.createElement('img');img.alt=q(photo.label||photo.name)||'Containerfoto';img.loading='lazy';img.setAttribute('data-rc1259-photo-id',q(photo.id));
        const label=doc.createElement('b');label.textContent=q(photo.label||photo.name)||'Containerfoto';
        const actions=doc.createElement('div');actions.className='rc1259-photo-actions';
        const open=doc.createElement('button');open.type='button';open.textContent='Ansehen';open.addEventListener('click',()=>openContainerPhoto(shipment,photo,false));
        const down=doc.createElement('button');down.type='button';down.textContent='Herunterladen';down.addEventListener('click',()=>openContainerPhoto(shipment,photo,true));
        actions.appendChild(open);actions.appendChild(down);item.appendChild(img);item.appendChild(label);item.appendChild(actions);grid.appendChild(item);
      });
      wrap.appendChild(grid);
      setTimeout(function(){hydrateContainerImages(wrap,shipment)},0);
    }
    return wrap;
  }

  function enhanceContainerCard(card,shipment,doc){
    const meta=containerMeta(shipment);
    let panel=card.querySelector&&card.querySelector('[data-rc1259-container-docs]');
    const shouldShow=meta.required||meta.seal||meta.photos.length;
    if(!shouldShow){if(panel&&typeof panel.remove==='function'){panel.remove();lastMutationAt=Date.now()}return false}
    if(panel&&typeof panel.remove==='function')panel.remove();
    if(typeof card.appendChild!=='function'||typeof doc.createElement!=='function')return false;
    panel=createContainerCard(doc,shipment);card.appendChild(panel);lastMutationAt=Date.now();return true;
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
      enhanceContainerCard(card,shipment,doc);
      if(row){
        card.setAttribute&&card.setAttribute('data-rc1014-shipment-enhanced','1');
        enhanced++;
      }
    });
    return enhanced;
  }

  function activeShipment(s){
    s=s||state();
    if(obj(s.shipment))return s.shipment;
    try{if(typeof root.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){const sh=root.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(obj(sh))return sh}}catch(_){}
    for(const sh of [s.currentShipment,s.selectedShipment,root.ExportHUBClean&&root.ExportHUBClean.runtime&&root.ExportHUBClean.runtime.shipment])if(obj(sh))return sh;
    return null;
  }

  function viewShipment(s){
    s=s||state();
    const wanted=q(s.shipmentViewId||s.selectedShipmentId||s.activeShipmentId).toUpperCase();
    if(wanted){
      const hit=arr(s.shipments).find(sh=>[shipmentId(sh),shipmentReference(sh)].includes(wanted));
      if(hit)return hit;
    }
    return activeShipment(s);
  }

  function shipmentTargets(s,active){
    const ref=shipmentReference(active),out=[];
    [active,s&&s.shipment,s&&s.currentShipment,s&&s.selectedShipment,root.ExportHUBClean&&root.ExportHUBClean.runtime&&root.ExportHUBClean.runtime.shipment].forEach(sh=>{
      if(!obj(sh)||out.includes(sh))return;
      if(sh===active||sh===(s&&s.shipment)||(ref&&shipmentReference(sh)===ref))out.push(sh);
    });
    return out;
  }

  function writeContainerConfig(mode,required,seal){
    const s=state(),active=activeShipment(s);if(!active)return false;
    mode=q(mode).toLowerCase();required=mode==='sea'&&required===true;
    const sealProvided=arguments.length>=3,sealValue=q(seal);
    shipmentTargets(s,active).forEach(sh=>{
      sh.transportMode=mode;
      sh.transportType=mode;
      sh.containerDocumentationRequired=required;
      if(sealProvided){
        sh.sealNumber=sealValue;
        sh.containerSealNumber=sealValue;
        sh.siegelnummer=sealValue;
      }
      sh.containerDocumentationUpdatedAt=new Date().toISOString();
    });
    try{
      const api=root.ExportHUBClean;
      if(api&&typeof api.queueSave==='function')Promise.resolve(api.queueSave('container-documentation-config')).catch(()=>{});
    }catch(_){}
    try{root.dispatchEvent(new CustomEvent('exporthub:shipment-updated',{detail:{reference:shipmentReference(active),containerDocumentation:true,sealNumber:sealProvided?sealValue:undefined}}))}catch(_){}
    return true;
  }

  function enhanceShipmentDetailedView(){
    const doc=root.document;if(!doc||!inShipmentView(doc))return false;
    const sh=viewShipment(state());if(!sh)return false;
    const meta=containerMeta(sh),shouldShow=meta.required||meta.seal||meta.photos.length;
    const old=doc.querySelector&&doc.querySelector('[data-rc1259-container-detail]');
    if(!shouldShow){if(old&&typeof old.remove==='function'){old.remove();lastMutationAt=Date.now()}return false}
    const docsCard=doc.getElementById&&doc.getElementById('rc786ReferenceFilesCard');
    const host=docsCard&&docsCard.parentNode;
    if(!host||typeof host.insertBefore!=='function')return false;
    if(old&&typeof old.remove==='function')old.remove();
    const panel=createContainerCard(doc,sh);
    panel.classList.add('rc1259-container-detail');
    panel.setAttribute('data-rc1259-container-detail','1');
    if(docsCard.nextSibling)host.insertBefore(panel,docsCard.nextSibling);else host.appendChild(panel);
    lastMutationAt=Date.now();
    return true;
  }

  function createConfigPanel(doc){
    const panel=doc.createElement('div');
    panel.className='rc1259-container-config';
    panel.setAttribute('data-rc1259-container-config','1');
    panel.innerHTML='<div class="rc1259-config-title"><strong>🚢 '+tr('container.configTitle')+'</strong><span>'+tr('container.configHelpShort')+'</span></div><div class="rc1259-config-grid"><label>'+tr('container.transportMode')+'<select data-rc1259-transport><option value="">'+tr('container.notSet')+'</option><option value="road">'+tr('container.road')+'</option><option value="air">'+tr('container.air')+'</option><option value="sea">'+tr('container.sea')+'</option></select></label><label>'+tr('container.seal')+' <span class="rc1259-field-note">('+tr('common.optional')+')</span><input type="text" data-rc1259-seal autocomplete="off" maxlength="120" placeholder="ABCD123456"></label><label class="rc1259-required-label"><input type="checkbox" data-rc1259-required> '+tr('container.requiredDocumentation')+'</label></div><div class="rc1259-config-help">'+tr('container.configHelp')+'</div>';
    const select=panel.querySelector('[data-rc1259-transport]'),seal=panel.querySelector('[data-rc1259-seal]'),check=panel.querySelector('[data-rc1259-required]');
    const save=()=>writeContainerConfig(select&&select.value,check&&check.checked,seal&&seal.value);
    if(select)select.addEventListener('change',()=>{const sea=select.value==='sea';if(check){check.disabled=!sea;if(!sea)check.checked=false}save()});
    if(check)check.addEventListener('change',save);
    if(seal)seal.addEventListener('change',save);
    return panel;
  }

  function enhanceShipmentConfig(){
    const doc=root.document;if(!doc||!inShipmentView(doc)||typeof doc.getElementById!=='function')return false;
    const host=doc.getElementById('rc363BlockShipment');if(!host)return false;
    let panel=host.querySelector&&host.querySelector('[data-rc1259-container-config]');
    if(!panel){if(typeof doc.createElement!=='function')return false;panel=createConfigPanel(doc);const target=host.querySelector&&host.querySelector('.rc363-process-body')||host;target.appendChild(panel);lastMutationAt=Date.now()}
    const sh=activeShipment(state());if(!sh)return true;
    const meta=containerMeta(sh),select=panel.querySelector&&panel.querySelector('[data-rc1259-transport]'),seal=panel.querySelector&&panel.querySelector('[data-rc1259-seal]'),check=panel.querySelector&&panel.querySelector('[data-rc1259-required]');
    if(select&&doc.activeElement!==select&&select.value!==meta.mode)select.value=meta.mode||'';
    if(seal&&doc.activeElement!==seal&&seal.value!==meta.seal)seal.value=meta.seal||'';
    if(check){check.disabled=(select?select.value:meta.mode)!=='sea';if(doc.activeElement!==check)check.checked=meta.required===true;if(check.disabled&&check.checked)check.checked=false}
    return true;
  }

  function scheduleEnhance(){
    if(!root.document||timer)return false;
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>{fn();return 1});
    timer=schedule(()=>{timer=0;enhanceShipmentOverview();enhanceShipmentConfig();enhanceShipmentDetailedView();},0);
    return true;
  }

  function signatureOf(shipments){
    return arr(shipments).map(sh=>{const meta=shipmentMeta(sh),cm=meta.container;return [shipmentId(sh),shipmentReference(sh),meta.createdLabel,meta.colliLabel,meta.customerPickupLabel,cm.mode,cm.required?'1':'0',cm.seal,cm.photos.map(p=>q(p&&p.kind)+':'+q(p&&p.uploadedAt)).join(',')].join('|')}).join('||');
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
    ['exporthub:viewchange','exporthub:shipment-updated','exporthub:overview-updated','exporthub:state-loaded','exporthub:shipment-saved'].forEach(name=>root.addEventListener(name,scheduleEnhance));
  }

  root.ExportHUBRC1014ShipmentOverview=Object.freeze({
    shipmentCreatedDate,
    shipmentColliCount,
    formatPickupDate,
    customerPickupMeta,
    containerMeta,
    shipmentMeta,
    remember,
    enhanceShipmentOverview,
    enhanceShipmentConfig,
    enhanceShipmentDetailedView,
    writeContainerConfig
  });
})(globalThis);
