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
    const sh=shipment||{},subPhotos=arr(sh.subShipments).flatMap(sub=>arr(sub&&sub.containerPhotos)),photos=[],seenPhotos=new Set();
    arr(sh.containerPhotos).concat(subPhotos).forEach(photo=>{
      const key=q(photo&&photo.blobName)||q(photo&&photo.id);
      if(!key||seenPhotos.has(key))return;
      seenPhotos.add(key);photos.push(photo);
    });
    const mode=q(sh.transportMode||sh.transportType||sh.shippingMode||sh.shipmentMode).toLowerCase();
    const required=sh.containerDocumentationRequired===true||sh.seaContainerDocumentationRequired===true;
    const seal=q(sh.sealNumber||sh.containerSealNumber||sh.siegelnummer);
    return{mode,required,seal,photos,count:photos.length,multiTruck:subPhotos.length>0,complete:['loaded','number','sealed'].every(kind=>photos.some(p=>q(p&&p.kind).toLowerCase()===kind))};
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
    try{
      const rt=root.ExportHUBClean&&root.ExportHUBClean.runtime||{},active=q(rt.authToken||rt.token||rt.sessionToken);
      if(active)return active;
    }catch(_){}
    // Reloads can clear runtime credentials while the authenticated tab
    // session is still valid. Read only the established ExportHUB session,
    // never scan unrelated browser storage or start a second login.
    try{
      const raw=root.sessionStorage&&root.sessionStorage.getItem('exporthub_rc301_tab_session');
      if(!raw)return'';
      const session=JSON.parse(raw),token=q(session&&session.token);
      if(!token||!session.user)return'';
      const environment=q(session.environment||session.dataEnvironment).toLowerCase();
      return !environment||environment===currentEnvironment()?token:'';
    }catch(_){return''}
  }

  function apiHeaders(){
    const token=authToken();if(!token)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');
    return{'Accept':'*/*','Cache-Control':'no-cache','X-ExportHUB-Token':token,'X-ExportHUB-Session':token,'Authorization':'Bearer '+token,'X-ExportHUB-Environment':currentEnvironment()};
  }

  async function fetchContainerBlob(shipment,photo){
    const url=photoUrl(shipment,photo,false),res=await root.fetch(url,{method:'GET',headers:apiHeaders(),credentials:'same-origin',cache:'no-store',redirect:'manual'});
    const responseUrl=q(res&&res.url).toLowerCase(),type=q(res&&res.headers&&res.headers.get&&res.headers.get('content-type')).toLowerCase();
    // The existing ExportHUB session must stay in place. Never interpret a
    // Microsoft login redirect or a fallback HTML page as a saved photo.
    if(!res||res.redirected===true||res.type==='opaqueredirect'||/login\.microsoftonline\.com|\/\.auth\/|\/login(?:[/?]|$)/.test(responseUrl)||/^(?:text\/html|application\/xhtml\+xml)/.test(type)){
      throw new Error('Der Fotoserver hat zur Anmeldung umgeleitet oder HTML statt eines Fotos geliefert.');
    }
    if(!res.ok){let msg='Containerfoto konnte nicht geladen werden.';try{const d=await res.json();msg=q(d&&d.message)||msg}catch(_){}throw new Error(msg)}
    const blob=await res.blob(),mime=q(blob&&blob.type||type).toLowerCase();
    if(!/^image\/(?:jpeg|png|webp)(?:\s*;|$)/.test(mime)||!blob||!blob.size){
      throw new Error('Der Fotoserver hat keine gültige Bilddatei geliefert.');
    }
    return blob;
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

  let closeActiveContainerPhotoPreview=null;

  function showContainerPhotoPreview(url,photo,trigger){
    if(closeActiveContainerPhotoPreview)closeActiveContainerPhotoPreview();
    const doc=root.document,overlay=doc.createElement('div'),dialog=doc.createElement('section');
    const header=doc.createElement('div'),title=doc.createElement('strong');
    const closeButton=doc.createElement('button'),image=doc.createElement('img');
    const previousFocus=doc.activeElement;
    overlay.className='rc1259-photo-preview';
    overlay.setAttribute('data-rc1934-photo-preview','1');
    dialog.className='rc1259-photo-preview-dialog';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label',q(photo&&photo.name||photo&&photo.label)||tr('common.open'));
    header.className='rc1259-photo-preview-header';
    title.textContent=q(photo&&photo.name)||'Containerfoto';
    closeButton.type='button';
    closeButton.textContent=tr('common.close');
    closeButton.setAttribute('aria-label',tr('common.close'));
    image.className='rc1259-photo-preview-image';
    image.alt=q(photo&&photo.label||photo&&photo.name)||'Containerfoto';
    image.src=url;
    let closed=false;
    function close(){
      if(closed)return;
      closed=true;
      doc.removeEventListener('keydown',onKey,true);
      root.removeEventListener('exporthub:viewchange',close);
      overlay.remove();
      URL.revokeObjectURL(url);
      if(closeActiveContainerPhotoPreview===close)closeActiveContainerPhotoPreview=null;
      const focusTarget=trigger&&trigger.isConnected?trigger:previousFocus&&previousFocus.isConnected?previousFocus:null;
      if(focusTarget&&typeof focusTarget.focus==='function')focusTarget.focus();
    }
    function onKey(event){
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key==='Tab'){
        // A one-control modal must not let keyboard focus escape to the page.
        event.preventDefault();closeButton.focus();
      }
    }
    closeButton.addEventListener('click',close);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
    doc.addEventListener('keydown',onKey,true);
    root.addEventListener('exporthub:viewchange',close,{once:true});
    header.appendChild(title);header.appendChild(closeButton);
    dialog.appendChild(header);dialog.appendChild(image);
    overlay.appendChild(dialog);doc.body.appendChild(overlay);
    closeActiveContainerPhotoPreview=close;
    closeButton.focus();
  }

  async function openContainerPhoto(shipment,photo,download,trigger){
    try{
      const blob=await fetchContainerBlob(shipment,photo),url=URL.createObjectURL(blob);
      // Do not display an old shipment after an asynchronous request and navigation.
      if(trigger&&trigger.isConnected===false){URL.revokeObjectURL(url);return false;}
      if(download){
        const a=root.document.createElement('a');
        a.href=url;a.download=q(photo&&photo.name)||'Containerfoto.jpg';
        root.document.body.appendChild(a);a.click();a.remove();
        setTimeout(function(){try{URL.revokeObjectURL(url)}catch(_){}},30000);
      }else{
        showContainerPhotoPreview(url,photo,trigger);
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
    const ref=shipmentReference(shipment),id=q(photo&&photo.id),sid=shipmentId(shipment);
    if(!ref||!id)return'';
    return '/api/container-document?reference='+encodeURIComponent(ref)+'&file='+encodeURIComponent(id)+'&shipmentId='+encodeURIComponent(sid)+'&environment='+encodeURIComponent(currentEnvironment())+(download?'&download=1':'');
  }

  function createContainerCard(doc,shipment){
    const meta=containerMeta(shipment),wrap=doc.createElement('div');
    wrap.className='rc1259-container-docs';
    wrap.setAttribute('data-rc1259-container-docs','1');
    const head=doc.createElement('div');head.className='rc1259-container-head';
    const title=doc.createElement('strong');title.textContent='🚢 Container-Dokumentation';
    const status=doc.createElement('span');status.className='rc1259-container-status';status.textContent=(meta.required?'Pflicht · ':'')+'Fotos '+meta.count+(meta.multiTruck?' gesamt':'/3')+(meta.seal?' · Siegel '+meta.seal:'');
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
        const open=doc.createElement('button');open.type='button';open.textContent='Ansehen';open.addEventListener('click',()=>openContainerPhoto(shipment,photo,false,open));
        const down=doc.createElement('button');down.type='button';down.textContent='Herunterladen';down.addEventListener('click',()=>openContainerPhoto(shipment,photo,true,down));
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
    const fingerprint=JSON.stringify([shipmentReference(shipment),meta.required,meta.seal,meta.photos.map(photo=>[q(photo&&photo.id),q(photo&&photo.kind),q(photo&&photo.label),q(photo&&photo.name),q(photo&&photo.blobName),q(photo&&photo.uploadedAt)])]);
    if(panel&&panel.getAttribute&&panel.getAttribute('data-rc1477-container-fingerprint')===fingerprint)return true;
    if(panel&&typeof panel.remove==='function')panel.remove();
    if(typeof card.appendChild!=='function'||typeof doc.createElement!=='function')return false;
    panel=createContainerCard(doc,shipment);
    if(panel&&panel.setAttribute)panel.setAttribute('data-rc1477-container-fingerprint',fingerprint);
    card.appendChild(panel);lastMutationAt=Date.now();return true;
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
    const wanted=q(s.shipmentViewId||s.selectedShipmentId||s.activeShipmentId||s.currentShipmentId).toUpperCase();
    const explicitRef=q(s.shipmentViewRef||s.selectedShipmentRef||s.currentShipmentRef).toUpperCase();
    if(wanted||explicitRef){
      const all=arr(s.shipments).concat(arr(s.savedShipments),arr(s.salesSharedShipments),arr(s.sharedShipments));
      const matches=all.filter(sh=>obj(sh)&&
        (!explicitRef||shipmentReference(sh)===explicitRef)&&
        (!wanted||shipmentReference(sh)===wanted||shipmentId(sh)===wanted));
      const refs=new Set(matches.map(sh=>shipmentReference(sh)).filter(Boolean));
      // Contradictory view keys or recycled IDs must never select a foreign REF.
      return refs.size===1?matches[0]:null;
    }
    return activeShipment(s);
  }

  function manualPickupIdentity(sh){return shipmentReference(sh)+'|'+shipmentId(sh)}

  // Browser state may still contain the pre-pickup shipment while the server
  // has already synchronized its three photos to savedShipments. Only combine
  // evidence from copies with the same internal ID AND reference.
  function containerShipmentForDetail(sh,s){
    const id=shipmentId(sh),ref=shipmentReference(sh);
    if(!id||!ref)return sh;
    const candidates=arr(s&&s.shipments).concat(arr(s&&s.savedShipments)).filter(other=>
      obj(other)&&shipmentId(other)===id&&shipmentReference(other)===ref);
    let selected=sh;
    const evidence=other=>containerMeta(other).count;
    const stamp=other=>Date.parse(q(other&&other.containerDocumentationUpdatedAt))||0;
    candidates.forEach(other=>{
      if(evidence(other)>evidence(selected)||(evidence(other)===evidence(selected)&&evidence(other)>0&&stamp(other)>stamp(selected)))selected=other;
    });
    if(selected===sh)return sh;
    return Object.assign({},sh,{
      containerPhotos:arr(selected.containerPhotos),
      subShipments:arr(selected.subShipments),
      sealNumber:q(selected.sealNumber||selected.containerSealNumber||sh.sealNumber||sh.containerSealNumber),
      containerDocumentationRequired:sh.containerDocumentationRequired===true||selected.containerDocumentationRequired===true
    });
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

  function inShipmentDetailView(doc){
    const body=doc&&doc.body,bodyView=q(body&&body.getAttribute&&body.getAttribute('data-exporthub-view')).toLowerCase();
    const s=state(),stateView=q(s&&(s.view||s.currentView||s.activeView||s.page)).toLowerCase();
    return stateView==='shipmentview'||bodyView==='shipmentview';
  }

  function manualPickupMeta(shipment){
    const sh=shipment||{};
    return{
      date:q(sh.customerAvisPickupDate||sh.avisPickupDate||sh.plannedPickupDate||sh.pickupDate),
      timeFrom:q(sh.customerAvisPickupTimeFrom||sh.avisPickupTimeFrom),
      timeTo:q(sh.customerAvisPickupTimeTo||sh.avisPickupTimeTo),
      plate:q(sh.customerAvisPickupPlate||sh.avisPickupPlate||sh.pickupLicensePlate||sh.licensePlate||sh.vehicleLicensePlate||sh.kennzeichen),
      carrier:q(sh.manualPickupCarrierName||sh.pickupCarrierName||sh.pickupSpeditionName||sh.carrierName||sh.speditionName||sh.carrier||sh.spedition),
      shipmentNumber:q(sh.manualPickupShipmentNumber||sh.pickupShipmentNumber||sh.carrierShipmentNumber||sh.trackingNumber),
      bookedAt:q(sh.manualPickupBookedAt),
      bookedBy:q(sh.manualPickupBookedBy)
    };
  }

  function manualPickupClosed(shipment){
    const sh=shipment||{};
    if(q(sh.actualPickupAt||sh.pickedUpAt||sh.pickupConfirmedAt||sh.qrPickupConfirmedAt||sh.pickupCompletedAt||sh.actualPickupDate))return true;
    return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|picked up|pod available|completed|archived)$/i.test(q(sh.status||sh.shipmentStatus||sh.processStatus||sh.pickupStatus));
  }

  async function manualPickupApi(action,shipment,payload){
    const body=Object.assign({
      action,
      shipmentId:shipmentId(shipment),
      reference:shipmentReference(shipment),
      environment:currentEnvironment()
    },payload||{});
    const headers=Object.assign({'Content-Type':'application/json'},apiHeaders());
    const res=await root.fetch('/api/customer-avis',{method:'POST',headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify(body)});
    let data={};try{data=await res.json()}catch(_){}
    if(!res.ok){const err=new Error(q(data&&data.message)||'Manuelle Abholbuchung fehlgeschlagen.');err.code=q(data&&data.code);err.status=res.status;throw err}
    return data||{};
  }

  function setManualPickupStatus(panel,message,kind){
    const status=panel&&panel.querySelector&&panel.querySelector('[data-rc1370-status]');if(!status)return;
    status.textContent=q(message);status.setAttribute('data-state',kind||'info');
  }

  async function loadManualPickupAvailability(panel,shipment,date,selected){
    const select=panel&&panel.querySelector&&panel.querySelector('[data-rc1370-slot]');if(!select)return false;
    const safeDate=q(date),wanted=q(selected),identity=manualPickupIdentity(shipment);
    if(panel.dataset.rc1370ShipmentIdentity!==identity)return false;
    const requestSeq=String((Number(panel.dataset.rc1370RequestSequence)||0)+1);
    panel.dataset.rc1370RequestSequence=requestSeq;
    select.disabled=true;select.innerHTML='<option value="">'+tr('manualPickup.loadingSlots')+'</option>';
    if(!safeDate){select.innerHTML='<option value="">'+tr('manualPickup.selectDateFirst')+'</option>';select.disabled=false;return false}
    try{
      const data=await manualPickupApi('manual-availability',shipment,{pickupDate:safeDate});
      if(panel.dataset.rc1370ShipmentIdentity!==identity||panel.dataset.rc1370RequestSequence!==requestSeq)return false;
      const availability=data&&data.availability||{},slots=arr(availability.slots);
      select.innerHTML='<option value="">'+tr('manualPickup.selectSlot')+'</option>';
      slots.forEach(slot=>{
        const option=root.document.createElement('option'),value=q(slot.from)+'|'+q(slot.to);
        option.value=value;option.textContent=tr('manualPickup.slotRemaining',{from:q(slot.from),to:q(slot.to),remaining:String(Number(slot.remaining)||0)});
        option.disabled=slot.available!==true&&value!==wanted;select.appendChild(option);
      });
      if(wanted&&Array.from(select.options||[]).some(o=>o.value===wanted&&!o.disabled))select.value=wanted;
      select.disabled=false;panel.dataset.rc1370AvailabilityDate=safeDate;return true;
    }catch(e){
      if(panel.dataset.rc1370ShipmentIdentity!==identity||panel.dataset.rc1370RequestSequence!==requestSeq)return false;
      select.innerHTML='<option value="">'+tr('manualPickup.slotsFailedShort')+'</option>';select.disabled=false;
      setManualPickupStatus(panel,tr('manualPickup.slotsFailed'),'error');return false;
    }
  }

  function createManualPickupPanel(doc){
    const panel=doc.createElement('section');panel.className='rc1370-manual-pickup';panel.setAttribute('data-rc1370-manual-pickup','1');
    panel.innerHTML='<div class="rc1370-manual-head"><div><strong>'+tr('manualPickup.title')+'</strong><span>'+tr('manualPickup.help')+'</span></div><span class="rc1370-manual-badge">'+tr('manualPickup.badge')+'</span></div><div class="rc1370-manual-grid"><label>'+tr('manualPickup.date')+'<input type="date" data-rc1370-date></label><label>'+tr('manualPickup.timeSlot')+'<select data-rc1370-slot><option value="">'+tr('manualPickup.selectDateFirst')+'</option></select></label><label>'+tr('manualPickup.carrier')+'<input type="text" data-rc1370-carrier maxlength="160" autocomplete="off" placeholder="'+tr('manualPickup.carrier')+'"></label><label>'+tr('manualPickup.shipmentNumber')+'<input type="text" data-rc1370-shipment-number maxlength="120" autocomplete="off" placeholder="'+tr('manualPickup.shipmentNumberPlaceholder')+'"></label><label>'+tr('manualPickup.plate')+' <span class="rc1370-optional">('+tr('common.optional')+')</span><input type="text" data-rc1370-plate maxlength="40" autocomplete="off" placeholder="'+tr('manualPickup.platePlaceholder')+'"></label></div><div class="rc1370-manual-actions"><button type="button" data-rc1370-save>'+tr('manualPickup.save')+'</button><span data-rc1370-status role="status" aria-live="polite"></span></div>';
    const date=panel.querySelector('[data-rc1370-date]'),slot=panel.querySelector('[data-rc1370-slot]'),carrier=panel.querySelector('[data-rc1370-carrier]'),number=panel.querySelector('[data-rc1370-shipment-number]'),plate=panel.querySelector('[data-rc1370-plate]'),save=panel.querySelector('[data-rc1370-save]');
    [date,slot,carrier,number,plate].forEach(input=>{if(input)input.addEventListener('input',()=>{panel.dataset.rc1370Dirty='1'})});
    if(date)date.addEventListener('change',()=>{panel.dataset.rc1370Dirty='1';const sh=viewShipment(state());if(sh)loadManualPickupAvailability(panel,sh,date.value,'')});
    if(save)save.addEventListener('click',async()=>{
      const sh=viewShipment(state());if(!sh||panel.dataset.rc1370ShipmentIdentity!==manualPickupIdentity(sh))return setManualPickupStatus(panel,tr('manualPickup.shipmentMissing'),'error');
      const requestIdentity=manualPickupIdentity(sh);
      if(manualPickupClosed(sh))return setManualPickupStatus(panel,tr('manualPickup.alreadyPicked'),'error');
      const dateValue=q(date&&date.value),slotValue=q(slot&&slot.value),parts=slotValue.split('|'),carrierValue=q(carrier&&carrier.value),numberValue=q(number&&number.value),plateValue=q(plate&&plate.value);
      if(!dateValue)return setManualPickupStatus(panel,tr('manualPickup.dateRequired'),'error');
      if(parts.length!==2||!parts[0]||!parts[1])return setManualPickupStatus(panel,tr('manualPickup.slotRequired'),'error');
      if(!carrierValue)return setManualPickupStatus(panel,tr('manualPickup.carrierRequired'),'error');
      if(!numberValue)return setManualPickupStatus(panel,tr('manualPickup.shipmentNumberRequired'),'error');
      save.disabled=true;setManualPickupStatus(panel,tr('manualPickup.saving'),'info');
      try{
        const result=await manualPickupApi('manual-appointment',sh,{pickupDate:dateValue,timeFrom:parts[0],timeTo:parts[1],plate:plateValue,carrier:carrierValue,shipmentNumber:numberValue});
        if(q(result&&result.reference)&&q(result.reference).toUpperCase()!==shipmentReference(sh))throw new Error('SHIPMENT_IDENTITY_MISMATCH');
        if(panel.dataset.rc1370ShipmentIdentity!==requestIdentity||manualPickupIdentity(viewShipment(state()))!==requestIdentity)return;
        const values=result&&result.values||{};Object.assign(sh,values);
        try{root.dispatchEvent(new CustomEvent('exporthub:shipment-updated',{detail:{reference:shipmentReference(sh),manualPickup:true}}))}catch(_){}
        panel.dataset.rc1370Dirty='';setManualPickupStatus(panel,tr('manualPickup.saved',{date:dateValue,from:parts[0],to:parts[1]}),'ok');
        await loadManualPickupAvailability(panel,sh,dateValue,parts[0]+'|'+parts[1]);
      }catch(e){
        setManualPickupStatus(panel,tr('manualPickup.failed'),'error');
        if(e&&e.code==='PICKUP_SLOT_FULL')await loadManualPickupAvailability(panel,sh,dateValue,'');
      }finally{save.disabled=false}
    });
    return panel;
  }

  function enhanceManualPickupBooking(){
    const doc=root.document;if(!doc||!inShipmentDetailView(doc)||typeof doc.getElementById!=='function')return false;
    const sh=viewShipment(state());if(!sh)return false;
    const docsCard=doc.getElementById('rc786ReferenceFilesCard'),host=docsCard&&docsCard.parentNode;if(!host||typeof host.insertBefore!=='function')return false;
    let panel=doc.querySelector&&doc.querySelector('[data-rc1370-manual-pickup]');
    if(!panel){panel=createManualPickupPanel(doc);host.insertBefore(panel,docsCard);lastMutationAt=Date.now()}
    const identity=manualPickupIdentity(sh);
    if(panel.dataset.rc1370ShipmentIdentity!==identity){
      panel.dataset.rc1370ShipmentIdentity=identity;
      panel.dataset.rc1370Dirty='';
      panel.dataset.rc1370AvailabilityDate='';
      panel.dataset.rc1370RequestSequence=String((Number(panel.dataset.rc1370RequestSequence)||0)+1);
      const oldSlot=panel.querySelector('[data-rc1370-slot]');
      if(oldSlot)oldSlot.innerHTML='<option value="">'+tr('manualPickup.selectDateFirst')+'</option>';
      setManualPickupStatus(panel,'','info');
    }
    const meta=manualPickupMeta(sh),closed=manualPickupClosed(sh),date=panel.querySelector('[data-rc1370-date]'),slot=panel.querySelector('[data-rc1370-slot]'),carrier=panel.querySelector('[data-rc1370-carrier]'),number=panel.querySelector('[data-rc1370-shipment-number]'),plate=panel.querySelector('[data-rc1370-plate]'),save=panel.querySelector('[data-rc1370-save]');
    if(!panel.dataset.rc1370Dirty){
      if(date&&doc.activeElement!==date)date.value=meta.date||'';
      if(carrier&&doc.activeElement!==carrier)carrier.value=meta.carrier||'';
      if(number&&doc.activeElement!==number)number.value=meta.shipmentNumber||'';
      if(plate&&doc.activeElement!==plate)plate.value=meta.plate||'';
      const selected=meta.timeFrom&&meta.timeTo?meta.timeFrom+'|'+meta.timeTo:'';
      if(meta.date&&panel.dataset.rc1370AvailabilityDate!==meta.date)loadManualPickupAvailability(panel,sh,meta.date,selected);
      else if(slot&&selected&&Array.from(slot.options||[]).some(o=>o.value===selected&&!o.disabled))slot.value=selected;
    }
    [date,slot,carrier,number,plate,save].forEach(el=>{if(el)el.disabled=closed||(el===slot&&!q(date&&date.value))});
    if(closed)setManualPickupStatus(panel,tr('manualPickup.alreadyPicked'),'locked');
    else if(meta.bookedAt&&!panel.dataset.rc1370Dirty)setManualPickupStatus(panel,meta.bookedBy?tr('manualPickup.bookedBy',{name:meta.bookedBy}):tr('manualPickup.booked'),'ok');
    return true;
  }

  function enhanceShipmentDetailedView(){
    const doc=root.document;if(!doc||!inShipmentDetailView(doc))return false;
    const s=state(),source=viewShipment(s);if(!source)return false;
    const sh=containerShipmentForDetail(source,s);
    const meta=containerMeta(sh),shouldShow=meta.required||meta.seal||meta.photos.length;
    const old=doc.querySelector&&doc.querySelector('[data-rc1259-container-detail]');
    if(!shouldShow){if(old&&typeof old.remove==='function'){old.remove();lastMutationAt=Date.now()}return false}
    const fingerprint=JSON.stringify([shipmentReference(sh),meta.required,meta.seal,meta.photos.map(photo=>[q(photo&&photo.id),q(photo&&photo.kind),q(photo&&photo.label),q(photo&&photo.name),q(photo&&photo.blobName),q(photo&&photo.uploadedAt)])]);
    if(old&&old.getAttribute&&old.getAttribute('data-rc1259-detail-fingerprint')===fingerprint)return true;
    const docsCard=doc.getElementById&&doc.getElementById('rc786ReferenceFilesCard');
    const host=docsCard&&docsCard.parentNode;
    if(!host||typeof host.insertBefore!=='function')return false;
    if(old&&typeof old.remove==='function')old.remove();
    const panel=createContainerCard(doc,sh);
    panel.classList.add('rc1259-container-detail');
    panel.setAttribute('data-rc1259-container-detail','1');
    panel.setAttribute('data-rc1259-detail-fingerprint',fingerprint);
    if(docsCard.nextSibling)host.insertBefore(panel,docsCard.nextSibling);else host.appendChild(panel);
    lastMutationAt=Date.now();
    return true;
  }

  function createConfigPanel(doc){
    const panel=doc.createElement('div');
    panel.className='rc1259-container-config';
    panel.setAttribute('data-rc1259-container-config','1');
    panel.innerHTML='<div class="rc1259-config-title"><strong>🚢 '+tr('container.configTitle')+'</strong><span>'+tr('container.configHelpShort')+'</span></div><div class="rc1259-config-grid"><label>'+tr('container.transportMode')+'<select data-rc1259-transport><option value="">'+tr('container.notSet')+'</option><option value="road">'+tr('container.road')+'</option><option value="air">'+tr('container.air')+'</option><option value="sea">'+tr('container.sea')+'</option></select></label><label>'+tr('container.seal',{seal:''}).replace(/\s*\{\{seal\}\}\s*/,'').trim()+' <span class="rc1259-field-note">('+tr('common.optional')+')</span><input type="text" data-rc1259-seal autocomplete="off" maxlength="120" placeholder="ABCD123456"></label><label class="rc1259-required-label"><input type="checkbox" data-rc1259-required> '+tr('container.requiredDocumentation')+'</label></div><div class="rc1259-config-help">'+tr('container.configHelp')+'</div>';
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


  // RC1877: simple in-page FIX binding, backed solely by authenticated server
  // reads/writes. Never mutate a shipment locally or open another window.
  const bindingCopy={
    de:{title:'Sammeltransport verknüpfen',intro:'Hauptsendung einem festen Abholziel zuordnen. Einzelne REF und Dokumente bleiben unverändert.',
      target:'FIX-Abholziel',date:'Abholtag',choose:'Abholziel auswählen',save:'Verknüpfen',change:'Ändern',
      confirm:'Änderung bestätigen',refresh:'Aktualisieren',current:'Aktuelle Verknüpfung:',none:'Noch nicht verknüpft',
      loading:'Lade gespeicherte Zuordnung…',saved:'Zuordnung gespeichert und erneut geladen.',
      locked:'Nur berechtigte Planer können diese Zuordnung ändern.',noDate:'Bitte zuerst das Abholdatum der Hauptsendung erfassen.',
      noTargets:'Keine passenden FIX-Abholziele vorhanden.',failed:'Zuordnung konnte nicht geladen oder gespeichert werden.',
      notRegistered:'Die Hauptsendung muss zuerst für die QR-Abholung angemeldet werden.',
      conflict:'Die Zuordnung wurde zwischenzeitlich geändert. Bitte aktualisieren.',wrongDate:'Abholdatum oder Wochentag stimmt nicht mit der Hauptsendung überein.',
      confirmHelp:'Das bestehende Abholziel wird geändert. Noch einmal bestätigen.',
      note:'Keine Änderungen an QR, POD, ABD, Avis oder Sendungsstatus.'},
    en:{title:'Link grouped pickup',intro:'Link this main shipment to a fixed pickup destination. Individual references and documents remain unchanged.',
      target:'Fixed pickup destination',date:'Pickup date',choose:'Select pickup destination',save:'Link',change:'Change',
      confirm:'Confirm change',refresh:'Refresh',current:'Current assignment:',none:'Not linked yet',
      loading:'Loading saved assignment…',saved:'Assignment saved and reloaded.',
      locked:'Only authorized planners can change this assignment.',noDate:'Enter the main shipment pickup date first.',
      noTargets:'No matching fixed pickup destinations.',failed:'Assignment could not be loaded or saved.',
      notRegistered:'Register this main shipment for QR pickup first.',
      conflict:'The assignment has changed. Refresh before continuing.',wrongDate:'Pickup date or weekday does not match the main shipment.',
      confirmHelp:'This changes an existing pickup destination. Confirm once more.',
      note:'No changes to QR, POD, customs documents, avis or shipment status.'},
    pl:{title:'Połącz odbiór zbiorczy',intro:'Przypisz przesyłkę główną do stałego miejsca odbioru. Numery REF i dokumenty pozostaną bez zmian.',
      target:'Stałe miejsce odbioru',date:'Data odbioru',choose:'Wybierz miejsce odbioru',save:'Połącz',change:'Zmień',
      confirm:'Potwierdź zmianę',refresh:'Odśwież',current:'Aktualne przypisanie:',none:'Jeszcze nieprzypisane',
      loading:'Wczytywanie przypisania…',saved:'Przypisanie zapisane i ponownie wczytane.',
      locked:'Tylko uprawnieni planiści mogą zmieniać przypisanie.',noDate:'Najpierw podaj datę odbioru przesyłki głównej.',
      noTargets:'Brak pasujących stałych miejsc odbioru.',failed:'Nie udało się wczytać lub zapisać przypisania.',
      notRegistered:'Najpierw zarejestruj przesyłkę główną do odbioru QR.',
      conflict:'Przypisanie zostało zmienione. Odśwież dane.',wrongDate:'Data lub dzień tygodnia nie pasuje do przesyłki.',
      confirmHelp:'Zmiana istniejącego miejsca odbioru. Potwierdź ponownie.',
      note:'Bez zmian w QR, POD, dokumentach celnych, awizacji i statusie przesyłki.'},
    es:{title:'Vincular recogida agrupada',intro:'Asigna el envío principal a una recogida fija. Las referencias y documentos no cambian.',
      target:'Destino de recogida fija',date:'Fecha de recogida',choose:'Seleccionar destino',save:'Vincular',change:'Cambiar',
      confirm:'Confirmar cambio',refresh:'Actualizar',current:'Asignación actual:',none:'Sin asignación',
      loading:'Cargando asignación…',saved:'Asignación guardada y recargada.',
      locked:'Solo los planificadores autorizados pueden cambiarla.',noDate:'Indica primero la fecha de recogida del envío principal.',
      noTargets:'No hay destinos de recogida compatibles.',failed:'No se pudo cargar o guardar la asignación.',
      notRegistered:'Registra primero el envío principal para la recogida QR.',
      conflict:'La asignación ha cambiado. Actualiza los datos.',wrongDate:'La fecha o el día no coincide con el envío principal.',
      confirmHelp:'Se cambiará el destino actual. Confirma de nuevo.',
      note:'Sin cambios en QR, POD, aduanas, avisos ni estado del envío.'},
    fr:{title:'Associer un enlèvement groupé',intro:'Reliez l’envoi principal à un enlèvement fixe. Les références et documents restent inchangés.',
      target:'Destination d’enlèvement fixe',date:'Date d’enlèvement',choose:'Choisir la destination',save:'Associer',change:'Modifier',
      confirm:'Confirmer la modification',refresh:'Actualiser',current:'Association actuelle :',none:'Aucune association',
      loading:'Chargement de l’association…',saved:'Association enregistrée puis rechargée.',
      locked:'Seuls les planificateurs autorisés peuvent la modifier.',noDate:'Renseignez d’abord la date d’enlèvement de l’envoi principal.',
      noTargets:'Aucune destination d’enlèvement compatible.',failed:'Impossible de charger ou d’enregistrer l’association.',
      notRegistered:'Enregistrez d’abord l’envoi principal pour l’enlèvement QR.',
      conflict:'L’association a changé. Actualisez les données.',wrongDate:'La date ou le jour ne correspond pas à l’envoi principal.',
      confirmHelp:'La destination actuelle sera modifiée. Confirmez à nouveau.',
      note:'Aucun changement des QR, POD, documents douaniers, avis ou statuts.'},
    it:{title:'Collega ritiro raggruppato',intro:'Collega la spedizione principale a un ritiro fisso. Riferimenti e documenti restano invariati.',
      target:'Destinazione di ritiro fissa',date:'Data del ritiro',choose:'Seleziona destinazione',save:'Collega',change:'Modifica',
      confirm:'Conferma modifica',refresh:'Aggiorna',current:'Assegnazione attuale:',none:'Non ancora collegata',
      loading:'Caricamento assegnazione…',saved:'Assegnazione salvata e ricaricata.',
      locked:'Solo i pianificatori autorizzati possono modificarla.',noDate:'Inserisci prima la data di ritiro della spedizione principale.',
      noTargets:'Nessuna destinazione di ritiro compatibile.',failed:'Impossibile caricare o salvare l’assegnazione.',
      notRegistered:'Registra prima la spedizione principale per il ritiro QR.',
      conflict:'L’assegnazione è cambiata. Aggiorna i dati.',wrongDate:'La data o il giorno non corrisponde alla spedizione principale.',
      confirmHelp:'La destinazione corrente verrà modificata. Conferma ancora.',
      note:'Nessuna modifica a QR, POD, dogana, avvisi o stato della spedizione.'}
  };
  function bt(key){
    let language='de';try{language=q(root.ExportHUBI18n&&root.ExportHUBI18n.language&&root.ExportHUBI18n.language()).toLowerCase()}catch(_){}
    const copy=bindingCopy[language]||bindingCopy.de;
    return copy[key]||bindingCopy.de[key]||key;
  }
  function bindingShipmentDate(sh){
    return q(sh&&(sh.plannedPickupDate||sh.pickupDate||sh.pickdate)).slice(0,10);
  }
  function bindingStatus(panel,message,kind){
    const status=panel&&panel.querySelector&&panel.querySelector('[data-rc1877-status]');
    if(status){status.textContent=q(message);status.dataset.kind=kind||'info'}
  }
  function bindingCss(doc){
    if(doc.getElementById('rc1877-binding-style'))return;
    const link=doc.createElement('link');link.id='rc1877-binding-style';link.rel='stylesheet';
    link.href='/assets/rc1877-pickup-binding.css';
    (doc.head||doc.documentElement).appendChild(link);
  }
  function bindingLabels(panel){
    for(const key of ['title','intro','refresh','note']){
      const el=panel.querySelector('[data-rc1877-'+key+']');
      if(el)el.textContent=bt(key);
    }
  }
  async function bindingFetch(url,method,body){
    const headers=Object.assign({'Accept':'application/json'},apiHeaders());
    if(body)headers['Content-Type']='application/json';
    const res=await root.fetch(url,{method:method||'GET',headers,
      credentials:'same-origin',cache:'no-store',redirect:'manual',
      ...(body?{body:JSON.stringify(body)}:{})});
    if(!res||res.redirected===true||res.type==='opaqueredirect'||
       /\/\.auth\/|login\.microsoftonline\.com/i.test(q(res.url||'')))throw new Error('AUTH_REDIRECT');
    let data={};try{data=await res.json()}catch(_){throw new Error('NON_JSON_RESPONSE')}
    if(!res.ok||data.ok!==true){const e=new Error('REQUEST_REJECTED');e.code=q(data.code);throw e}
    return data;
  }
  function bindingWeekday(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(q(value)))return 0;
    const date=new Date(value+'T12:00:00Z');
    return Number.isNaN(date.getTime())?0:(date.getUTCDay()||7);
  }
  function bindingSelectWeekday(panel){
    const date=panel.querySelector('[data-rc1877-date]'),select=panel.querySelector('[data-rc1877-target]');
    if(!select)return;
    const weekday=bindingWeekday(date&&date.value);
    Array.from(select.options||[]).forEach(option=>{
      const day=Number(option.dataset.weekday)||0;
      if(day)option.disabled=!!weekday&&day!==weekday;
    });
    if(select.selectedOptions&&select.selectedOptions[0]&&select.selectedOptions[0].disabled)select.value='';
  }
  async function loadShipmentBinding(panel,shipment){
    const identity=manualPickupIdentity(shipment);
    if(panel.dataset.rc1877Identity!==identity)return false;
    const save=panel.querySelector('[data-rc1877-save]'),select=panel.querySelector('[data-rc1877-target]'),
      date=panel.querySelector('[data-rc1877-date]'),current=panel.querySelector('[data-rc1877-current]');
    if(!save||!select||!date||!current)return false;
    save.disabled=true;bindingStatus(panel,bt('loading'));
    const request=String((Number(panel.dataset.rc1877Request)||0)+1);
    panel.dataset.rc1877Request=request;
    try{
      const results=await Promise.all([bindingFetch('/api/fixed-pickups','GET'),
        bindingFetch('/api/pickup-transport-bindings','GET')]);
      if(panel.dataset.rc1877Identity!==identity||panel.dataset.rc1877Request!==request)return false;
      const fixedData=results[0],stored=results[1],rows=arr(stored.bindings);
      const matching=rows.filter(item=>q(item.shipmentId).toUpperCase()===shipmentId(shipment)&&
        q(item.reference).toUpperCase()===shipmentReference(shipment));
      if(matching.length>1)throw new Error('DUPLICATE_BINDING');
      const binding=matching[0]||null,targets=arr(fixedData.items).filter(item=>item&&item.active!==false);
      select.innerHTML='';
      const empty=root.document.createElement('option');empty.value='';empty.textContent=bt('choose');
      select.appendChild(empty);
      targets.forEach(target=>{
        const option=root.document.createElement('option');option.value=q(target.id);
        option.textContent=q(target.siteLabel);option.dataset.weekday=String(Number(target.weekday)||0);
        select.appendChild(option);
      });
      panel.dataset.rc1877Revision=String(stored.revision);
      panel.dataset.rc1877Current=binding?q(binding.pickupTargetId):'';
      panel.dataset.rc1877CanEdit=stored.canEdit===true?'1':'0';
      panel.dataset.rc1877Confirm='';
      if(binding)date.value=q(binding.pickupDate);
      else date.value=bindingShipmentDate(shipment);
      if(binding&&targets.some(item=>q(item.id)===q(binding.pickupTargetId)))select.value=q(binding.pickupTargetId);
      else if(!binding&&targets.some(item=>q(item.id)===q(shipment.pickupTargetId)))select.value=q(shipment.pickupTargetId);
      bindingSelectWeekday(panel);
      current.textContent=bt('current')+' '+(binding?(
        targets.find(item=>q(item.id)===q(binding.pickupTargetId))?.siteLabel||binding.pickupTargetId
      ):bt('none'));
      save.textContent=binding?bt('change'):bt('save');
      save.disabled=stored.canEdit!==true||!targets.length||!q(date.value);
      if(stored.canEdit!==true)bindingStatus(panel,bt('locked'));
      else if(!targets.length)bindingStatus(panel,bt('noTargets'),'error');
      else if(!q(date.value))bindingStatus(panel,bt('noDate'),'error');
      else bindingStatus(panel,'');
      return true;
    }catch(_){
      if(panel.dataset.rc1877Identity===identity&&panel.dataset.rc1877Request===request){
        save.disabled=true;bindingStatus(panel,bt('failed'),'error');
      }
      return false;
    }
  }
  function bindingErrorText(code){
    if(code==='TRANSPORT_NOT_REGISTERED')return bt('notRegistered');
    if(code==='BINDING_REVISION_CONFLICT'||code==='BINDING_CONCURRENT_UPDATE'||
       code==='BINDING_OVERRIDE_CONFIRMATION_REQUIRED')return bt('conflict');
    if(code==='TRANSPORT_DATE_MISMATCH'||code==='TRANSPORT_FIX_WRONG_DAY')return bt('wrongDate');
    return bt('failed');
  }
  function makeShipmentBinding(doc){
    const panel=doc.createElement('section');
    panel.className='rc1877-binding';panel.setAttribute('data-rc1877-binding','1');
    panel.innerHTML='<div class="rc1877-binding__head"><h3 data-rc1877-title></h3></div>'+
      '<p class="rc1877-binding__intro" data-rc1877-intro></p>'+
      '<div class="rc1877-binding__grid"><label><span data-rc1877-target-label></span>'+
      '<select data-rc1877-target></select></label><label><span data-rc1877-date-label></span>'+
      '<input type="date" data-rc1877-date></label></div>'+
      '<div class="rc1877-binding__current" data-rc1877-current></div>'+
      '<div class="rc1877-binding__actions"><button type="button" data-rc1877-save></button>'+
      '<button type="button" data-rc1877-refresh></button></div>'+
      '<span data-rc1877-status role="status" aria-live="polite"></span>'+
      '<div class="rc1877-binding__note" data-rc1877-note></div>';
    const select=panel.querySelector('[data-rc1877-target]'),
      date=panel.querySelector('[data-rc1877-date]'),
      save=panel.querySelector('[data-rc1877-save]'),
      refresh=panel.querySelector('[data-rc1877-refresh]');
    for(const control of [select,date])if(control)control.addEventListener('change',()=>{
      panel.dataset.rc1877Confirm='';save.textContent=bt('save');
      bindingSelectWeekday(panel);
    });
    if(refresh)refresh.addEventListener('click',()=>{
      const sh=viewShipment(state());if(sh&&manualPickupIdentity(sh)===panel.dataset.rc1877Identity)
        loadShipmentBinding(panel,sh);
    });
    if(save)save.addEventListener('click',async()=>{
      const sh=viewShipment(state()),identity=sh&&manualPickupIdentity(sh);
      if(!sh||identity!==panel.dataset.rc1877Identity||panel.dataset.rc1877CanEdit!=='1')return;
      const target=q(select&&select.value),day=q(date&&date.value),
        current=q(panel.dataset.rc1877Current),revision=Number(panel.dataset.rc1877Revision);
      if(!target||!day||!Number.isSafeInteger(revision)){
        return bindingStatus(panel,bt('failed'),'error');
      }
      if(!bindingWeekday(day))return bindingStatus(panel,bt('wrongDate'),'error');
      if(current&&current!==target&&panel.dataset.rc1877Confirm!==target+'|'+day){
        panel.dataset.rc1877Confirm=target+'|'+day;save.textContent=bt('confirm');
        return bindingStatus(panel,bt('confirmHelp'));
      }
      const confirmOverride=!!current&&current!==target;
      save.disabled=true;refresh.disabled=true;bindingStatus(panel,bt('loading'));
      try{
        await bindingFetch('/api/pickup-transport-bindings','POST',{
          shipmentId:shipmentId(sh),pickupTargetId:target,pickupDate:day,
          expectedRevision:revision,confirmOverride,
          reason:confirmOverride?'Abholziel nach Bestätigung geändert':'Hauptsendung als Sammeltransport verknüpft'
        });
        if(panel.dataset.rc1877Identity!==identity)return;
        const loaded=await loadShipmentBinding(panel,sh);
        if(!loaded)throw new Error('READBACK_FAILED');
        bindingStatus(panel,bt('saved'),'ok');
        try{root.dispatchEvent(new CustomEvent('exporthub:shipment-updated',{
          detail:{reference:shipmentReference(sh),pickupTransportBinding:true}}))}catch(_){}
      }catch(e){
        if(panel.dataset.rc1877Identity===identity)
          bindingStatus(panel,bindingErrorText(q(e&&e.code)),'error');
      }finally{save.disabled=panel.dataset.rc1877CanEdit!=='1'||!q(select&&select.value)||!q(date&&date.value);
        refresh.disabled=false;panel.dataset.rc1877Confirm=''}
    });
    bindingLabels(panel);
    return panel;
  }
  function enhancePickupTransportBinding(){
    const doc=root.document;
    if(!doc||!inShipmentDetailView(doc)||typeof doc.getElementById!=='function')return false;
    const sh=viewShipment(state());if(!sh||!shipmentId(sh)||!shipmentReference(sh))return false;
    const anchor=doc.getElementById('rc786ReferenceFilesCard'),host=anchor&&anchor.parentNode;
    if(!host||typeof host.insertBefore!=='function')return false;
    bindingCss(doc);
    let panel=doc.querySelector('[data-rc1877-binding]');
    if(!panel){panel=makeShipmentBinding(doc);host.insertBefore(panel,anchor);lastMutationAt=Date.now()}
    const identity=manualPickupIdentity(sh);
    if(panel.dataset.rc1877Identity!==identity){
      panel.dataset.rc1877Identity=identity;
      panel.dataset.rc1877Request='';
      panel.dataset.rc1877Confirm='';
      bindingLabels(panel);
      const targetLabel=panel.querySelector('[data-rc1877-target-label]');
      const dateLabel=panel.querySelector('[data-rc1877-date-label]');
      if(targetLabel)targetLabel.textContent=bt('target');
      if(dateLabel)dateLabel.textContent=bt('date');
      const refresh=panel.querySelector('[data-rc1877-refresh]');
      if(refresh)refresh.textContent=bt('refresh');
      loadShipmentBinding(panel,sh);
    }
    return true;
  }

  function scheduleEnhance(){
    if(!root.document||timer)return false;
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>{fn();return 1});
    timer=schedule(()=>{timer=0;enhanceShipmentOverview();enhanceShipmentConfig();enhanceManualPickupBooking();enhancePickupTransportBinding();enhanceShipmentDetailedView();},0);
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
    root.addEventListener('exporthub:language-changed',()=>{
      const panel=root.document&&root.document.querySelector&&root.document.querySelector('[data-rc1877-binding]');
      if(panel&&typeof panel.remove==='function')panel.remove();scheduleEnhance();
    });
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
    enhanceManualPickupBooking,
    enhancePickupTransportBinding,
    enhanceShipmentDetailedView,
    viewShipment,
    manualPickupIdentity,
    manualPickupMeta,
    writeContainerConfig
  });
})(globalThis);
