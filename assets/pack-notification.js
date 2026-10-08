(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const catalog=window.ExportHubPackagingCatalog;
  const state={stationToken:'',sessionId:'',stationName:'',idempotencyKey:'',documents:[],submitLocked:false,selectedCustomer:null,customCustomerConfirmed:false,customerSearchTimer:null,customerQuerySeq:0};
  const els={form:$('packForm'),loading:$('packLoading'),error:$('packError'),station:$('packStation'),customer:$('packCustomer'),customerResults:$('packCustomerResults'),customerManual:$('packCustomerManual'),customerManualConfirm:$('packCustomerManualConfirm'),customerSelected:$('packCustomerSelected'),delivery:$('packDeliveryNote'),type:$('packPackageType'),count:$('packPackageCount'),weight:$('packWeight'),rows:$('packPackageRows'),files:$('packDocuments'),fileList:$('packDocumentList'),note:$('packNote'),submit:$('packSubmit'),hint:$('packValidationHint'),success:$('packSuccess'),successRef:$('packSuccessReference'),successCustomer:$('packSuccessCustomer'),restart:$('packRestart')};

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
  function populatePackageTypes(){
    const current=els.type.value;
    els.type.innerHTML='<option value="">Bitte wählen</option>';
    if(!catalog||typeof catalog.list!=='function')return;
    for(const entry of catalog.list()){
      const option=document.createElement('option');option.value=entry.label;option.textContent=entry.label;els.type.appendChild(option);
    }
    if(current&&catalog.get(current))els.type.value=catalog.get(current).label;
  }
  function selectedPackageEntry(){return catalog&&typeof catalog.get==='function'?catalog.get(els.type.value):null;}
  function applyPackageDimensions(){
    const entry=catalog.get(els.type.value);if(!entry)return;
    for(const row of packageRows()){
      const length=row.querySelector('[data-dim="length"]'),width=row.querySelector('[data-dim="width"]'),height=row.querySelector('[data-dim="height"]');
      if(length)length.value=String(entry.length);
      if(width)width.value=String(entry.width);
      if(height&&entry.height != null)height.value=String(entry.height);
    }
    validateForm();
  }
  function renderPackages(){
    const count=Math.max(1,Math.min(99,Number(els.count.value)||1));
    const prior=packageRows().map(row=>({l:row.querySelector('[data-dim="length"]')?.value||'',w:row.querySelector('[data-dim="width"]')?.value||'',h:row.querySelector('[data-dim="height"]')?.value||''}));
    const entry=selectedPackageEntry();
    els.rows.innerHTML='';
    for(let i=0;i<count;i++){
      const dimensions=prior[i]||{l:entry?String(entry.length):'',w:entry?String(entry.width):'',h:entry&&entry.height!=null?String(entry.height):''};
      const row=document.createElement('article');row.className='pack-package';row.dataset.packPackage=String(i+1);
      row.innerHTML=`<h3>Packstück ${i+1}</h3><div class="pack-package-grid"><label>Länge *<input data-dim="length" type="number" min="0.01" step="0.01" inputmode="decimal" value="${dimensions.l}" required></label><label>Breite *<input data-dim="width" type="number" min="0.01" step="0.01" inputmode="decimal" value="${dimensions.w}" required></label><label>Höhe *<input data-dim="height" type="number" min="0.01" step="0.01" inputmode="decimal" value="${dimensions.h}" required></label></div>`;
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
  function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`;}
  function collectPackages(){return packageRows().map((row,index)=>({packageNo:index+1,length:positive(row.querySelector('[data-dim="length"]')?.value),width:positive(row.querySelector('[data-dim="width"]')?.value),height:positive(row.querySelector('[data-dim="height"]')?.value),unit:'cm'}));}
  function customerReady(){return !!state.selectedCustomer||state.customCustomerConfirmed;}
  function valid(){
    if(!state.sessionId||!els.customer.value.trim()||!customerReady()||!els.delivery.value.trim()||!els.type.value)return false;
    const count=Number(els.count.value);if(!Number.isInteger(count)||count<1||!positive(els.weight.value))return false;
    const rows=collectPackages();if(rows.length!==count||rows.some(x=>!x.length||!x.width||!x.height))return false;
    return state.documents.length>0;
  }
  function validateForm(){const ok=valid()&&!state.submitLocked;els.submit.disabled=!ok;els.hint.textContent=ok?'Bereit zum Senden.':'Bitte Kunde bestätigen, alle Pflichtfelder, Maße und mindestens einen Lieferschein erfassen.';return ok;}
  function fileToData(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({id:crypto.randomUUID(),name:file.name,mimeType:file.type,size:file.size,data:String(reader.result||'')});reader.onerror=()=>reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`));reader.readAsDataURL(file);});}
  async function api(action,payload){const res=await fetch(`/api/pack-notification?action=${encodeURIComponent(action)}`,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});const data=await res.json().catch(()=>({}));if(!res.ok||data.ok===false){const err=new Error(data.message||`HTTP ${res.status}`);err.code=data.code||'PACK_REQUEST_FAILED';throw err;}return data;}
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
  async function startSession(){
    clearError();state.stationToken=tokenFromPath();state.idempotencyKey=crypto.randomUUID();
    if(!state.stationToken){els.loading.hidden=true;showError('Ungültiger QR-Code: Packtisch-Token fehlt.');return;}
    try{const data=await api('session',{stationToken:state.stationToken});state.sessionId=data.sessionId;state.stationName=data.stationName||'Packtisch';els.station.textContent=state.stationName;els.loading.hidden=true;els.form.hidden=false;renderPackages();validateForm();}
    catch(err){els.loading.hidden=true;showError(err.message||'Pack-Session konnte nicht erstellt werden.');}
  }
  async function submit(event){
    event.preventDefault();if(state.submitLocked||!validateForm())return;
    state.submitLocked=true;validateForm();clearError();els.submit.textContent='Wird gesendet …';
    try{
      const selected=state.selectedCustomer;
      const payload={stationToken:state.stationToken,sessionId:state.sessionId,idempotencyKey:state.idempotencyKey,customer:els.customer.value.trim(),customerId:selected?selected.id:'',customerAccount:selected?selected.account:'',customerSource:selected?'master':'manual',deliveryNoteReference:els.delivery.value.trim(),packageType:els.type.value,packageCount:Number(els.count.value),totalWeight:Number(els.weight.value),packages:collectPackages(),note:els.note.value.trim(),documents:state.documents};
      const data=await api('submit',payload);els.form.hidden=true;els.success.hidden=false;els.successRef.textContent=data.reference||'–';els.successCustomer.textContent=payload.customer;els.station.textContent=state.stationName;history.replaceState(null,'',location.pathname);
    }catch(err){state.submitLocked=false;els.submit.textContent='An ExportHUB senden';showError(err.message||'Packmeldung konnte nicht gesendet werden.');validateForm();}
  }
  els.customer.addEventListener('input',scheduleCustomerSearch);
  els.customer.addEventListener('focus',()=>{if(els.customer.value.trim().length>=2&&!state.selectedCustomer&&!state.customCustomerConfirmed)scheduleCustomerSearch();});
  els.customerManualConfirm.addEventListener('click',()=>{if(els.customer.value.trim().length<2)return;state.selectedCustomer=null;state.customCustomerConfirmed=true;clearCustomerResults();els.customerManual.hidden=true;els.customerSelected.textContent=`Manueller Kunde · ${els.customer.value.trim()}`;els.customerSelected.hidden=false;validateForm();});
  els.type.addEventListener('change',applyPackageDimensions);
  els.count.addEventListener('input',renderPackages);
  els.form.addEventListener('input',event=>{if(event.target!==els.customer)validateForm();});
  els.form.addEventListener('change',validateForm);
  els.form.addEventListener('submit',submit);
  els.files.addEventListener('change',async()=>{clearError();try{const files=Array.from(els.files.files||[]);const converted=[];for(const file of files)converted.push(await fileToData(file));state.documents=[...state.documents,...converted];els.files.value='';renderDocuments();}catch(err){showError(err.message);}});
  els.fileList.addEventListener('click',event=>{const button=event.target.closest('[data-remove-file]');if(!button)return;state.documents.splice(Number(button.dataset.removeFile),1);renderDocuments();});
  els.restart.addEventListener('click',()=>location.reload());
  populatePackageTypes();
  startSession();
})();
