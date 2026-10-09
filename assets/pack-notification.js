(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const catalog=window.ExportHubPackagingCatalog;
  const state={stationToken:'',sessionId:'',stationName:'',idempotencyKey:'',documents:[],submitLocked:false,draftSaveLocked:false,activeDraftId:'',selectedCustomer:null,customCustomerConfirmed:false,customerSearchTimer:null,customerQuerySeq:0,packagingMaster:[]};
  const els={home:$('packHome'),newShipment:$('packNewShipment'),draftGrid:$('packDraftGrid'),draftEmpty:$('packDraftEmpty'),form:$('packForm'),formMode:$('packFormMode'),backHome:$('packBackHome'),saveDraft:$('packSaveDraft'),loading:$('packLoading'),error:$('packError'),station:$('packStation'),customer:$('packCustomer'),customerResults:$('packCustomerResults'),customerManual:$('packCustomerManual'),customerManualConfirm:$('packCustomerManualConfirm'),customerSelected:$('packCustomerSelected'),deliveryRef:$('packDeliveryNoteReference'),type:$('packPackageType'),count:$('packPackageCount'),weight:$('packWeight'),rows:$('packPackageRows'),files:$('packDocuments'),fileList:$('packDocumentList'),note:$('packNote'),submit:$('packSubmit'),hint:$('packValidationHint'),success:$('packSuccess'),successRef:$('packSuccessReference'),successCustomer:$('packSuccessCustomer'),restart:$('packRestart')};

  function tokenFromPath(){
    const parts=location.pathname.split('/').filter(Boolean);
    const index=parts.findIndex(x=>x.toLowerCase()==='pack');
    if(index>=0&&parts[index+1])return decodeURIComponent(parts[index+1]);
    return new URLSearchParams(location.search).get('token')||'';
  }
  function showError(message){els.error.textContent=String(message||'Unbekannter Fehler');els.error.hidden=false;}
  function clearError(){els.error.hidden=true;els.error.textContent='';}
  function positive(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
  function packageRows(){return Array.from(els.rows.querySelectorAll('[data-pack-package]'));}
  function normalizePackagingName(value){return String(value==null?'':value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
  function masterPackagingEntry(raw){
    const name=String(raw&&raw.name||'').trim();if(!name)return null;
    const length=positive(raw&&raw.length),width=positive(raw&&raw.width),height=positive(raw&&raw.height)||null;
    if(!length||!width)return null;
    return{key:normalizePackagingName(name),label:name,length,width,height,source:String(raw&&raw.source||'master')};
  }
  function packagingSortRank(entry){
    const label=String(entry&&entry.label||'').trim();
    const key=normalizePackagingName(label);
    const preferred={
      europalette:10,europallet:10,europalette12080:10,
      einwegpalette:20,
      industriepalette:30,
      dusseldorferpalette:40,
      kunststoffpalette:50,
      palettengestell:60
    };
    if(Object.prototype.hasOwnProperty.call(preferred,key))return preferred[key];
    const eMatch=key.match(/^e([0-6])$/);if(eMatch)return 100+Number(eMatch[1]);
    if(key.includes('gestapelteuropalette'))return 200;
    if(key.includes('gestapelteeinwegpalette'))return 210;
    if(key.includes('gestapelteindustriepalette'))return 220;
    return 500;
  }
  function mergePackagingOptions(){
    const merged=[],seen=new Set();
    const master=(Array.isArray(state.packagingMaster)?state.packagingMaster:[]).map(masterPackagingEntry).filter(Boolean);
    for(const entry of master.filter(item=>item.source === 'fixed')){const key=normalizePackagingName(entry.label);if(!seen.has(key)){seen.add(key);merged.push(entry);}}
    for(const entry of master.filter(item=>item.source !== 'fixed')){const key=normalizePackagingName(entry.label);if(!seen.has(key)){seen.add(key);merged.push(entry);}}
    if(catalog&&typeof catalog.list==='function')for(const fallback of catalog.list()){
      const key=normalizePackagingName(fallback.label);if(seen.has(key))continue;seen.add(key);merged.push(Object.assign({},fallback,{source:'fallback'}));
    }
    return merged.sort((a,b)=>{
      const rank=packagingSortRank(a)-packagingSortRank(b);if(rank)return rank;
      return String(a.label||'').localeCompare(String(b.label||''),'de',{numeric:true,sensitivity:'base'});
    });
  }
  function populatePackageTypes(){
    const current=els.type.value;
    els.type.innerHTML='<option value="">Bitte wählen</option>';
    const options=mergePackagingOptions();
    for(const entry of options){const option=document.createElement('option');option.value=entry.label;option.textContent=entry.label;els.type.appendChild(option);}
    if(current&&options.some(entry=>entry.label===current))els.type.value=current;
  }
  function selectedPackageEntry(){
    const value=normalizePackagingName(els.type.value);
    return mergePackagingOptions().find(entry=>normalizePackagingName(entry.label)===value)||null;
  }
  function applyPackageDimensions(){
    const entry=selectedPackageEntry();if(!entry)return;
    for(const row of packageRows()){
      const length=row.querySelector('[data-dim="length"]'),width=row.querySelector('[data-dim="width"]'),height=row.querySelector('[data-dim="height"]');
      if(length)length.value=String(entry.length);
      if(width)width.value=String(entry.width);
      if(height&&entry.height != null)height.value=String(entry.height);
    }
    validateForm();
  }
  function renderPackages(savedPackages){
    const count=Math.max(1,Math.min(99,Number(els.count.value)||1));
    const current=packageRows().map(row=>({length:row.querySelector('[data-dim="length"]')?.value||'',width:row.querySelector('[data-dim="width"]')?.value||'',height:row.querySelector('[data-dim="height"]')?.value||''}));
    const prior=Array.isArray(savedPackages)?savedPackages:current;
    const entry=selectedPackageEntry();
    els.rows.innerHTML='';
    for(let i=0;i<count;i++){
      const raw=prior[i]||{};
      const dimensions={l:raw.length||raw.l||(entry?String(entry.length):''),w:raw.width||raw.w||(entry?String(entry.width):''),h:raw.height||raw.h||(entry&&entry.height!=null?String(entry.height):'')};
      const row=document.createElement('article');row.className='pack-package';row.dataset.packPackage=String(i+1);
      row.innerHTML=`<h3>Packstück ${i+1}</h3><div class="pack-package-grid"><label>Länge *<input data-dim="length" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(dimensions.l)}" required></label><label>Breite *<input data-dim="width" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(dimensions.w)}" required></label><label>Höhe *<input data-dim="height" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(dimensions.h)}" required></label></div>`;
      els.rows.appendChild(row);
    }
    validateForm();
  }
  function renderDocuments(){
    els.fileList.innerHTML='';
    state.documents.forEach((file,index)=>{
      const row=document.createElement('div');row.className='pack-document';
      row.innerHTML=`<span><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span><button type="button" data-remove-file="${index}" aria-label="${escapeHtml(file.name)} entfernen">Entfernen</button>`;
      els.fileList.appendChild(row);
    });
    validateForm();
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`;}
  function collectPackages(){return packageRows().map((row,index)=>({packageNo:index+1,length:positive(row.querySelector('[data-dim="length"]')?.value),width:positive(row.querySelector('[data-dim="width"]')?.value),height:positive(row.querySelector('[data-dim="height"]')?.value),unit:'cm'}));}
  function derivedDocumentReference(){return state.documents.map(file=>String(file&&file.name||'').trim()).filter(Boolean).join(', ').slice(0,200);}
  function customerReady(){return !!state.selectedCustomer||state.customCustomerConfirmed;}
  function isEssentraSelected(){return !!state.selectedCustomer&&/\bessentra\b/i.test(String(state.selectedCustomer.name||els.customer.value||''));}
  function finalDeliveryReference(){return String(els.deliveryRef.value||'').trim()||derivedDocumentReference();}
  function valid(){
    if(!state.sessionId||!els.customer.value.trim()||!customerReady()||!els.type.value)return false;
    const count=Number(els.count.value);if(!Number.isInteger(count)||count<1||!positive(els.weight.value))return false;
    const rows=collectPackages();if(rows.length!==count||rows.some(x=>!x.length||!x.width||!x.height))return false;
    if(!isEssentraSelected()&&!finalDeliveryReference()&&!state.documents.length)return false;
    return true;
  }
  function validateForm(){const ok=valid()&&!state.submitLocked;els.submit.disabled=!ok;if(state.submitLocked)els.hint.textContent='Packmeldung wird gesendet …';else if(ok)els.hint.textContent='Bereit zum Senden. Entwurf kann weiterhin gespeichert werden.';else if(!isEssentraSelected()&&!finalDeliveryReference()&&!state.documents.length)els.hint.textContent='Für externe Kunden DNC/Lieferscheinnummer eingeben oder Lieferschein hochladen.';else els.hint.textContent='Für den Versand bitte Kunde bestätigen und alle Pflichtfelder sowie Maße ausfüllen.';return ok;}
  function fileToData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({id:crypto.randomUUID(),name:file.name,mimeType:file.type,size:file.size,data:String(reader.result||'')});reader.onerror=()=>reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`));reader.readAsDataURL(file);});}
  async function api(action,payload){const res=await fetch(`/api/pack-notification?action=${encodeURIComponent(action)}`,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok||data.ok===false){const err=new Error(data.message||`HTTP ${res.status}`);err.code=data.code||'PACK_REQUEST_FAILED';throw err;}return data;}
  async function loadPackagingMaster(){
    try{const data=await api('packaging-list',{stationToken:state.stationToken});state.packagingMaster=Array.isArray(data.packaging)?data.packaging:[];}
    catch(_){state.packagingMaster=[];}
    populatePackageTypes();
  }
  function clearCustomerResults(){els.customerResults.innerHTML='';els.customerResults.hidden=true;}
  function showManualCustomer(){const value=els.customer.value.trim();els.customerManual.hidden=value.length<2||!!state.selectedCustomer||state.customCustomerConfirmed;els.customerSelected.hidden=true;}
  function selectCustomer(customer){state.selectedCustomer={id:String(customer.id||''),account:String(customer.account||''),name:String(customer.name||'')};state.customCustomerConfirmed=false;els.customer.value=state.selectedCustomer.name;clearCustomerResults();els.customerManual.hidden=true;els.customerSelected.textContent=`${state.selectedCustomer.name}${state.selectedCustomer.account?` · ${state.selectedCustomer.account}`:''}`;els.customerSelected.hidden=false;validateForm();}
  function renderCustomerResults(customers){clearCustomerResults();const list=Array.isArray(customers)?customers:[];if(!list.length){showManualCustomer();validateForm();return;}for(const customer of list){const button=document.createElement('button');button.type='button';button.dataset.customerId=String(customer.id||'');button.innerHTML=`<strong>${escapeHtml(customer.name||'')}</strong><small>${escapeHtml(customer.account||'')}</small>`;button.addEventListener('click',()=>selectCustomer(customer));els.customerResults.appendChild(button);}els.customerResults.hidden=false;els.customerManual.hidden=true;}
  function scheduleCustomerSearch(){
    state.selectedCustomer=null;state.customCustomerConfirmed=false;els.customerSelected.hidden=true;clearCustomerResults();els.customerManual.hidden=true;validateForm();
    clearTimeout(state.customerSearchTimer);const query=els.customer.value.trim();if(query.length<2)return;
    const seq=++state.customerQuerySeq;
    state.customerSearchTimer=setTimeout(async()=>{try{const data=await api('customer-search',{stationToken:state.stationToken,query});if(seq!==state.customerQuerySeq)return;renderCustomerResults(data.customers);}catch(err){if(seq!==state.customerQuerySeq)return;clearCustomerResults();showManualCustomer();}},250);
  }
  async function ensureSession(){
    if(state.sessionId)return;
    const data=await api('session',{stationToken:state.stationToken});state.sessionId=data.sessionId;state.stationName=data.stationName||state.stationName||'Packtisch';state.idempotencyKey=crypto.randomUUID();els.station.textContent=state.stationName;
  }
  function resetForm(){
    state.activeDraftId='';state.documents=[];state.selectedCustomer=null;state.customCustomerConfirmed=false;state.submitLocked=false;state.draftSaveLocked=false;state.idempotencyKey=crypto.randomUUID();
    els.customer.value='';els.deliveryRef.value='';els.type.value='';els.count.value='1';els.weight.value='';els.note.value='';els.customerSelected.hidden=true;els.customerManual.hidden=true;clearCustomerResults();renderPackages([]);renderDocuments();els.submit.textContent='An ExportHUB senden';els.saveDraft.textContent='Entwurf speichern';els.formMode.textContent='Neue Sendung';
  }
  function draftPayload(){const selected=state.selectedCustomer;return{id:state.activeDraftId,customer:els.customer.value.trim(),customerId:selected?selected.id:'',customerAccount:selected?selected.account:'',customerSource:selected?'master':'manual',deliveryNoteReference:String(els.deliveryRef.value||'').trim(),packageType:els.type.value,packageCount:Number(els.count.value)||0,totalWeight:Number(els.weight.value)||0,packages:collectPackages(),note:els.note.value.trim(),documents:state.documents};}
  function renderDraftCards(drafts){
    const list=Array.isArray(drafts)?drafts:[];els.draftGrid.innerHTML='';els.draftEmpty.hidden=list.length>0;
    for(const draft of list){const card=document.createElement('button');card.type='button';card.className='pack-draft-card';card.dataset.draftId=String(draft.id||'');card.innerHTML=`<span class="pack-draft-customer">${escapeHtml(draft.customer||'Ohne Kunde')}</span><span class="pack-draft-meta"><span><small>Ref</small><strong>${escapeHtml(draft.deliveryNoteReference||'—')}</strong></span><span><small>Anzahl Paletten</small><strong>${Number(draft.packageCount)||0}</strong></span></span><span class="pack-draft-open">Weiterbearbeiten →</span>`;els.draftGrid.appendChild(card);}
  }
  async function loadDrafts(){const data=await api('draft-list',{stationToken:state.stationToken});renderDraftCards(data.drafts);}
  async function showHome(){clearError();els.form.hidden=true;els.success.hidden=true;els.home.hidden=false;try{await loadDrafts();}catch(err){showError(err.message||'Offene Sendungen konnten nicht geladen werden.');}}
  async function openNewShipment(){clearError();try{await ensureSession();resetForm();els.home.hidden=true;els.success.hidden=true;els.form.hidden=false;validateForm();els.customer.focus();}catch(err){showError(err.message||'Neue Sendung konnte nicht gestartet werden.');}}
  async function openDraft(draftId){
    clearError();try{await ensureSession();const data=await api('draft-get',{stationToken:state.stationToken,draftId});const draft=data.draft||{};state.activeDraftId=String(draft.id||'');state.documents=Array.isArray(draft.documents)?draft.documents:[];state.submitLocked=false;state.draftSaveLocked=false;state.idempotencyKey=crypto.randomUUID();els.customer.value=String(draft.customer||'');els.deliveryRef.value=String(draft.deliveryNoteReference||'');els.type.value=String(draft.packageType||'');els.count.value=String(Math.max(1,Number(draft.packageCount)||1));els.weight.value=draft.totalWeight?String(draft.totalWeight):'';els.note.value=String(draft.note||'');
      if(draft.customerSource==='master'&&draft.customerId){state.selectedCustomer={id:String(draft.customerId),account:String(draft.customerAccount||''),name:String(draft.customer||'')};state.customCustomerConfirmed=false;els.customerSelected.textContent=`${state.selectedCustomer.name}${state.selectedCustomer.account?` · ${state.selectedCustomer.account}`:''}`;els.customerSelected.hidden=false;}else{state.selectedCustomer=null;state.customCustomerConfirmed=!!els.customer.value.trim();els.customerSelected.textContent=els.customer.value.trim()?`Manueller Kunde · ${els.customer.value.trim()}`:'';els.customerSelected.hidden=!state.customCustomerConfirmed;}
      els.customerManual.hidden=true;clearCustomerResults();renderPackages(draft.packages);renderDocuments();els.formMode.textContent='Entwurf weiterbearbeiten';els.home.hidden=true;els.success.hidden=true;els.form.hidden=false;validateForm();
    }catch(err){showError(err.message||'Entwurf konnte nicht geöffnet werden.');}
  }
  async function saveDraft(){
    if(state.draftSaveLocked)return;state.draftSaveLocked=true;clearError();els.saveDraft.disabled=true;els.saveDraft.textContent='Speichert …';
    try{await ensureSession();const data=await api('draft-save',{stationToken:state.stationToken,sessionId:state.sessionId,draft:draftPayload()});state.activeDraftId=String(data.draft&&data.draft.id||state.activeDraftId);els.formMode.textContent='Entwurf weiterbearbeiten';els.hint.textContent='Entwurf gespeichert. Er ist jetzt an allen Packtischen sichtbar.';els.saveDraft.textContent='Gespeichert ✓';setTimeout(()=>{els.saveDraft.textContent='Entwurf speichern';},1200);}
    catch(err){showError(err.message||'Entwurf konnte nicht gespeichert werden.');els.saveDraft.textContent='Entwurf speichern';}
    finally{state.draftSaveLocked=false;els.saveDraft.disabled=false;}
  }
  async function startPage(){
    clearError();state.stationToken=tokenFromPath();
    if(!state.stationToken){els.loading.hidden=true;showError('Ungültiger QR-Code: Packtisch-Token fehlt.');return;}
    try{await ensureSession();await loadPackagingMaster();els.loading.hidden=true;await showHome();}
    catch(err){els.loading.hidden=true;showError(err.message||'Packseite konnte nicht geladen werden.');}
  }
  async function submit(event){
    event.preventDefault();if(state.submitLocked||!validateForm())return;
    state.submitLocked=true;validateForm();clearError();els.submit.textContent='Wird gesendet …';
    try{
      const selected=state.selectedCustomer;
      const payload={stationToken:state.stationToken,sessionId:state.sessionId,idempotencyKey:state.idempotencyKey,draftId:state.activeDraftId,customer:els.customer.value.trim(),customerId:selected?selected.id:'',customerAccount:selected?selected.account:'',customerSource:selected?'master':'manual',deliveryNoteReference:finalDeliveryReference(),packageType:els.type.value,packageCount:Number(els.count.value),totalWeight:Number(els.weight.value),packages:collectPackages(),note:els.note.value.trim(),documents:state.documents};
      const data=await api('submit',payload);els.form.hidden=true;els.success.hidden=false;els.successRef.textContent=data.reference||'–';els.successCustomer.textContent=payload.customer;els.station.textContent=state.stationName;state.sessionId='';state.activeDraftId='';history.replaceState(null,'',location.pathname);
    }catch(err){state.submitLocked=false;els.submit.textContent='An ExportHUB senden';showError(err.message||'Packmeldung konnte nicht gesendet werden.');validateForm();}
  }
  els.customer.addEventListener('input',scheduleCustomerSearch);
  els.customer.addEventListener('focus',()=>{if(els.customer.value.trim().length>=2&&!state.selectedCustomer&&!state.customCustomerConfirmed)scheduleCustomerSearch();});
  els.customerManualConfirm.addEventListener('click',()=>{if(els.customer.value.trim().length<2)return;state.selectedCustomer=null;state.customCustomerConfirmed=true;clearCustomerResults();els.customerManual.hidden=true;els.customerSelected.textContent=`Manueller Kunde · ${els.customer.value.trim()}`;els.customerSelected.hidden=false;validateForm();});
  els.type.addEventListener('change',applyPackageDimensions);
  els.count.addEventListener('input',()=>renderPackages());
  els.form.addEventListener('input',event=>{if(event.target!==els.customer)validateForm();});
  els.form.addEventListener('change',validateForm);
  els.form.addEventListener('submit',submit);
  els.files.addEventListener('change',async()=>{clearError();try{const files=Array.from(els.files.files||[]);const converted=[];for(const file of files)converted.push(await fileToData(file));state.documents=[...state.documents,...converted];els.files.value='';renderDocuments();}catch(err){showError(err.message);}});
  els.fileList.addEventListener('click',event=>{const button=event.target.closest('[data-remove-file]');if(!button)return;state.documents.splice(Number(button.dataset.removeFile),1);renderDocuments();});
  els.newShipment.addEventListener('click',openNewShipment);
  els.backHome.addEventListener('click',showHome);
  els.saveDraft.addEventListener('click',saveDraft);
  els.draftGrid.addEventListener('click',event=>{const card=event.target.closest('[data-draft-id]');if(card)openDraft(card.dataset.draftId);});
  els.restart.addEventListener('click',showHome);
  populatePackageTypes();
  startPage();
})();
