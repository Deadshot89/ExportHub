(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBStandaloneEvidence)return;
const FIELDS=[
 ['shipmentNumber','text'],['customer','text'],['dispatchDate','date'],
 ['colli','number'],['weightKg','number'],
 ['carrier','text'],['trackingNumber','text'],['exporthubRef','text'],
 ['remarks','textarea']
];
const state={view:'list',record:null,records:[],continuation:null,busy:false,search:'',loading:false,listToken:0,serial:0,searchRun:0,scanning:false,uploading:false,canDelete:false,canRegisterCustomer:false,expandedComplaintId:''};
let galleryRecord='',galleryUrls=new Map(),galleryLoads=new Map(),closeGalleryDialog=null;
function language(){try{return String(w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language()||'de').toLowerCase().slice(0,2)}catch(_){return'de'}}
function t(k){const p=w.ExportHUBEvidenceI18n||{},lang=language();return p[lang]&&p[lang][k]||p.de&&p.de[k]||k}
function make(tag,cls,value){const e=d.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
function button(label,action,primary){const b=make('button',primary?'eh1903-primary':'',label);b.type='button';b.addEventListener('click',action);return b}
function host(){return d.getElementById('content')}
function root(){return d.getElementById('eh1903-root')}
function active(){return d.body&&d.body.getAttribute('data-exporthub-view')==='shipmentevidence'}
function status(message,error){const el=root()&&root().querySelector('[data-eh1903-status]');if(el){el.textContent=message||'';el.setAttribute('data-error',error?'true':'false')}}
function headers(){const r=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},token=r.authToken||r.token||r.sessionToken||'';const h={'Accept':'application/json','Content-Type':'application/json'};if(token)h['X-ExportHUB-Token']=String(token);return h}
async function request(method,params){let url='/api/shipment-evidence',options={method,headers:headers(),credentials:'same-origin',cache:'no-store'};if(method==='GET')url+='?'+new URLSearchParams(params);else options.body=JSON.stringify(params);const response=await fetch(url,options);let value;try{value=await response.json()}catch(_){value={}}if(!response.ok||value.ok!==true)throw new Error(value.message||'HTTP '+response.status);return value}
async function fileRequest(id,file){const url='/api/shipment-evidence?'+new URLSearchParams({action:'file',id,fileId:file.id,...(file.complaintId?{complaintId:file.complaintId}:{})});const response=await fetch(url,{headers:headers(),credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);return response.blob()}
const isPhoto=file=>/^image\/(jpeg|png)$/.test(String(file&&file.mime||'').toLowerCase());
function syncGallery(recordId){
 const scope=recordId||'';if(scope===galleryRecord)return;
 if(closeGalleryDialog)closeGalleryDialog();
 galleryUrls.forEach(url=>URL.revokeObjectURL(url));galleryUrls.clear();galleryLoads.clear();galleryRecord=scope;
}
function inlinePhoto(id,file,img){
 const scope=galleryRecord;
 if(galleryUrls.has(file.id)){img.src=galleryUrls.get(file.id);return}
 let job=galleryLoads.get(file.id);
 if(!job){
  job=fileRequest(id,file).then(blob=>{
   if(scope!==galleryRecord||!/^image\/(jpeg|png)$/.test(blob.type))return null;
   const url=URL.createObjectURL(blob);galleryUrls.set(file.id,url);return url;
  }).catch(()=>null);
  galleryLoads.set(file.id,job);
 }
 job.then(url=>{if(scope===galleryRecord&&img.isConnected&&url)img.src=url});
}
async function downloadEvidence(id,file){
 try{
  const blob=await fileRequest(id,file),url=URL.createObjectURL(blob),link=make('a');
  link.href=url;link.download=file.name;d.body.appendChild(link);link.click();link.remove();
  w.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){status(e.message,true)}
}
function dateText(s){try{return s?new Date(s).toLocaleDateString(language()==='de'?'de-DE':'en-GB'):''}catch(_){return s}}
function hero(title,desc){const h=make('header','eh1903-hero');h.appendChild(make('h1',null,title));h.appendChild(make('p','eh1903-muted',desc));return h}
function initPage(){const container=host();if(!container)return null;const app=make('main');app.id='eh1903-root';container.replaceChildren(app);d.body.setAttribute('data-exporthub-view','shipmentevidence');return app}
function showList(){syncGallery('');state.serial++;state.view='list';state.record=null;state.canDelete=false;state.canRegisterCustomer=false;const app=initPage();if(!app)return;app.appendChild(hero(t('title'),t('intro')));
 const actions=make('div','eh1903-actions');actions.appendChild(button(t('new'),()=>showForm(null),true));
 const publicLink=make('a','eh1903-public-link',t('publicPage'));
 publicLink.href='/sendungsdokumentation';publicLink.target='_self';actions.appendChild(publicLink);
 actions.appendChild(button(t('copyPublicLink'),async()=>{
  const url=new URL('/sendungsdokumentation',w.location.href).href;
  try{await w.navigator.clipboard.writeText(url);status(t('linkCopied'),false)}
  catch(_){status(url,false)}
 }));
 app.appendChild(actions);
 const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('list')));
 const search=make('input');search.type='search';search.placeholder=t('search');search.value=state.search;search.setAttribute('aria-label',t('search'));panel.appendChild(search);
 const fullSearch=button(t('searchAll'),()=>scanAll());panel.appendChild(fullSearch);
 const list=make('div','eh1903-list');panel.appendChild(list);app.appendChild(panel);
 const more=button(t('loadMore'),()=>loadList(false));more.hidden=!state.continuation;panel.appendChild(more);
 fullSearch.hidden=!state.continuation||!state.search.trim();
 const message=make('p','eh1903-status');message.setAttribute('data-eh1903-status','');message.setAttribute('aria-live','polite');app.appendChild(message);
 function updateRows(){list.replaceChildren();more.hidden=!state.continuation;fullSearch.hidden=!state.continuation||!state.search.trim();const term=state.search.toLowerCase().trim();
  const matches=state.records.filter(r=>!term||[r.id,r.fields&&r.fields.customer,r.fields&&r.fields.shipmentNumber,r.fields&&r.fields.trackingNumber,r.fields&&r.fields.exporthubRef].some(x=>String(x||'').toLowerCase().includes(term)));
  if(!matches.length){list.appendChild(make('p','eh1903-muted',t('none')));return}
  matches.forEach(r=>{
    const row=make('div','eh1903-row eh1903-record-row'),data=make('div','eh1903-record-grid'),fields=r.fields||{};
    const cell=(label,value,cls)=>{
      const section=make('div','eh1903-record-cell'+(cls?' '+cls:''));
      section.appendChild(make('span','eh1903-record-label',label));
      section.appendChild(make('strong','eh1903-record-value',value==null||value===''?'–':value));
      data.appendChild(section);return section
    };
    const ref=cell(t(fields.exporthubRef?'refShort':'documentationRefShort'),fields.exporthubRef||r.id,'eh1903-record-ref');
    if(fields.exporthubRef)ref.appendChild(make('span','eh1903-record-sub',t('documentationRefShort')+': '+r.id));
    const customer=cell(t('customer'),fields.customer||'–','eh1903-record-customer');
    if(fields.shipmentNumber)customer.appendChild(make('span','eh1903-record-sub',t('shipmentNumber')+': '+fields.shipmentNumber));
    cell(t('dispatchDate'),dateText(fields.dispatchDate));
    cell(t('colli'),fields.colli);
    cell(t('weightKg'),fields.weightKg==null||fields.weightKg===''?'–':fields.weightKg+' kg');
    const statuses=make('div','eh1903-record-cell eh1903-record-complaints');
    statuses.appendChild(make('span','eh1903-record-label',t('complaintStatus')));
    const cases=(r.complaints||[]).filter(Boolean),counts={offen:0,in_pruefung:0,abgeschlossen:0};
    cases.forEach(c=>{counts[c.state==='abgeschlossen'?'abgeschlossen':c.state==='in_pruefung'?'in_pruefung':'offen']++});
    const chips=make('div','eh1903-status-chips');
    if(!cases.length)chips.appendChild(make('span','eh1903-record-sub',t('noComplaintsShort')));
    for(const statusKey of ['offen','in_pruefung','abgeschlossen']){
      if(!counts[statusKey])continue;
      const chip=make('span','eh1903-status-chip',t(statusKey==='abgeschlossen'?'complaintCompleted':statusKey)+' · '+counts[statusKey]);
      chip.setAttribute('data-complaint-state',statusKey);chips.appendChild(chip);
    }
    statuses.appendChild(chips);data.appendChild(statuses);
    row.appendChild(data);row.appendChild(button(t('edit'),()=>openRecord(r.id)));list.appendChild(row)
  });
 }
 search.addEventListener('input',()=>{state.search=search.value;state.searchRun++;updateRows()});updateRows();
}
async function loadList(reset){if(state.loading&&!reset)return false;state.loading=true;const listToken=++state.listToken;const serial=++state.serial;if(reset){state.records=[];state.continuation=null}if(state.view==='list')status(t('loading'),false);
 try{const result=await request('GET',{action:'list',...(reset?{}:state.continuation?{continuation:state.continuation}:{})});
  if(serial!==state.serial)return false;
  const merged=new Map([...state.records,...result.records].map(x=>[x.id,x]));
  state.records=[...merged.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  state.continuation=result.continuation||null;
  if(state.view==='list'&&active())showList();
  return true;
 }catch(e){if(serial===state.serial&&state.view==='list')status(e.message,true);return false}
 finally{if(listToken===state.listToken)state.loading=false}}
async function scanAll(){
 if(state.scanning||state.loading||!state.continuation||!state.search.trim())return;
 const run=++state.searchRun;state.scanning=true;
 try{
  while(run===state.searchRun&&state.view==='list'&&active()&&state.continuation){
   const ok=await loadList(false);
   if(!ok)break;
   if(run===state.searchRun&&state.continuation)status(t('searching'),false);
  }
 }finally{
  state.scanning=false;
  if(run===state.searchRun&&state.view==='list'&&active()&&!state.continuation)status(t('searchFinished'),false);
 }
}
function labelField(grid,key,kind,value){const label=make('label',key==='remarks'?'eh1903-wide':'',t(key));
 const el=make(kind==='textarea'?'textarea':'input');el.setAttribute('data-evidence-field',key);
 if(kind!=='textarea')el.type=kind;if(key==='colli'||key==='weightKg'){el.min='0';el.step=key==='colli'?'1':'0.001';}
 el.value=value==null?'':value;label.appendChild(el);grid.appendChild(label);return el}
function readFields(app){const values={};app.querySelectorAll('[data-evidence-field]').forEach(el=>values[el.getAttribute('data-evidence-field')]=String(el.value||'').trim());return values}
async function write(action,extra,expectedId){
 if(state.busy||state.view!=='form'||!active())return null;
 const originalId=state.record&&state.record.id||null;
 if(expectedId&&expectedId!==originalId)return null;
 const serial=state.serial;state.busy=true;status(t('saving'),false);
 try{
  // A file upload or complaint submission must not discard edited shipment fields.
  // Persist the current form first, on the same document ID and revision.
  if(originalId&&action!=='save'&&action!=='create'){
   const currentRoot=root();
   if(currentRoot&&currentRoot.querySelector('[data-evidence-field]')){
    const draft=Object.assign({},state.record&&state.record.fields||{},readFields(currentRoot));
    const stored=state.record&&state.record.fields||{};
    const changed=FIELDS.some(([key])=>String(draft[key]||'').trim()!==String(stored[key]||'').trim());
    if(changed){
     const updated=await request('POST',{action:'save',id:originalId,expectedRevision:state.record.revision,fields:draft});
     if(serial!==state.serial||state.view!=='form'||!active()||(state.record&&state.record.id)!==originalId)return null;
     state.record=updated.record;
    }
   }
  }
  if(serial!==state.serial||state.view!=='form'||!active()||(state.record&&state.record.id||null)!==originalId)return null;
  const payload={action,...extra};if(originalId){payload.id=originalId;payload.expectedRevision=state.record.revision}
  const result=await request('POST',payload);
  if(serial===state.serial&&state.view==='form'&&active()&&
    (state.record&&state.record.id||null)===originalId){
   state.record=result.record;if(typeof result.canDelete==='boolean')state.canDelete=result.canDelete;if(typeof result.canRegisterCustomer==='boolean')state.canRegisterCustomer=result.canRegisterCustomer;showForm(state.record);
   status(action==='create'?t('created'):action==='upload'?t('verifyingUpload'):t('saved'),false);
  }
  return result;
 }catch(e){if(serial===state.serial&&active())status(e.message,true);return null}
 finally{state.busy=false}
}
function showForm(record){state.searchRun++;state.view='form';if(record!==undefined){state.record=record;if(!record){state.canDelete=false;state.canRegisterCustomer=false;}}const app=initPage();if(!app)return;
 const r=state.record||null;app.appendChild(hero(t('title'),t('independent')));
 const actions=make('div','eh1903-actions');actions.appendChild(button(t('back'),()=>{showList();loadList(true)}));app.appendChild(actions);
 if(r){
  const reference=make('section','eh1903-panel');
  reference.appendChild(make('p','eh1903-muted',t('docId')));
  reference.appendChild(make('strong',null,r.id));
  reference.appendChild(button(t('copyReference'),async()=>{
   try{await w.navigator.clipboard.writeText(r.id);status(t('referenceCopied'),false)}
   catch(_){status(r.id,false)}
  }));
  app.appendChild(reference);
 }else app.appendChild(make('p','eh1903-muted',t('referencePending')));
 if(r&&r.fields&&r.fields.customerMode==='pending'){
  const pending=make('p','eh1903-muted',t('customerPendingMessage'));
  app.appendChild(pending);
  if(state.canRegisterCustomer){
   actions.appendChild(button(t('registerCustomer'),async()=>{
    if(state.busy||!w.confirm(t('registerCustomerConfirm')))return;
    state.busy=true;status(t('saving'),false);
    try{
     const response=await request('POST',{action:'register-customer',id:r.id,expectedRevision:r.revision});
     if(state.record&&state.record.id===r.id){
      state.record=response.record;state.canRegisterCustomer=response.canRegisterCustomer===true;
      showForm(state.record);status(t('customerRegistered'),false);
     }
    }catch(e){status(e.message,true)}finally{state.busy=false}
   },true));
  }
 }
 if(r&&state.canDelete){
  actions.appendChild(button(t('deleteRecord'),async()=>{
   if(state.busy||!w.confirm(t('deleteConfirm')))return;
   const current=r.id;state.busy=true;status(t('saving'),false);
   try{
    await request('POST',{action:'delete',id:current,expectedRevision:r.revision});
    if(state.record&&state.record.id===current){showList();await loadList(true);status(t('deletedRecord'),false)}
   }catch(e){status(e.message,true)}finally{state.busy=false}
  }));
 }
 const card=make('section','eh1903-panel');card.appendChild(make('h2',null,t('edit')));
 card.appendChild(make('p','eh1903-muted',t('required')));
 const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const grid=make('div','eh1903-grid'),defaults={dispatchDate:today};
 FIELDS.forEach(([key,kind])=>labelField(grid,key,kind,r&&r.fields&&r.fields[key]||defaults[key]||''));
 card.appendChild(grid);
 // An independent DOK is not automatically a shipment REF. Explain the exact
 // link requirement instead of silently implying its files appear in a REF folder.
 const linkedRef=grid.querySelector('[data-evidence-field="exporthubRef"]');
 if(linkedRef){
  const hint=make('p','eh1903-muted',t('notLinked'));
  hint.setAttribute('role','note');
  const updateHint=()=>{hint.hidden=!!String(linkedRef.value||'').trim()};
  linkedRef.addEventListener('input',updateHint);updateHint();card.appendChild(hint);
 }
 const act=make('div','eh1903-actions');act.appendChild(button(t('save'),async()=>{
  const current=Object.assign({},r&&r.fields||{},readFields(app));if(!current.customer||!current.shipmentNumber||!current.dispatchDate){status(t('required'),true);return}
  await write(r?'save':'create',{fields:current});
 },true));card.appendChild(act);
 app.appendChild(card);app.appendChild(uploadsPanel(r));app.appendChild(complaintsPanel(r));app.appendChild(historyPanel(r));
 const note=make('p','eh1903-status');note.setAttribute('data-eh1903-status','');note.setAttribute('aria-live','polite');app.appendChild(note);
}
function uploadsPanel(record){const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('files')));panel.appendChild(make('p','eh1903-muted',t('info')));
 const grid=make('div','eh1903-uploads');
 for(const [kind,key,accept] of [['foto','uploadPhotos','image/jpeg,image/png'],['lieferschein','uploadNotes','application/pdf,image/jpeg,image/png']]){
  const cell=make('div','eh1903-upload'),label=make('label',null,t(key)),input=make('input');input.type='file';input.accept=accept;input.multiple=true;input.addEventListener('change',async()=>{
   const selected=[...input.files];input.value='';
   if(!selected.length)return;
   if(state.uploading||state.busy){status(t('uploadBusy'),true);return}
   state.uploading=true;
   try{
    // A new record has no DOK ID yet. Create it from the visible fields before
    // uploading so files can never be attached to the previous document.
    let docId=state.record&&state.record.id||null;
    if(!docId){
     const current=readFields(root());
     if(!current.customer||!current.shipmentNumber||!current.dispatchDate){status(t('required'),true);return}
     const created=await write('create',{fields:current});
     if(!created||!created.record||!created.record.id)return;
     docId=created.record.id;
    }
    for(const file of selected){
     if(!state.record||state.record.id!==docId||state.view!=='form'||!active())break;
     if(file.size>15*1024*1024){status(file.name+' · 15 MB',true);continue}
     try{
      status(t('uploading'),false);
      const ids=new Set((state.record.files||[]).map(f=>f.id));
      const base64=await asBase64(file);
      const uploaded=await write('upload',{kind,fileName:file.name,base64},docId);
      if(!uploaded)break;
      const entry=(uploaded.record&&uploaded.record.files||[]).find(f=>!ids.has(f.id)&&f.kind===kind&&Number(f.size)===file.size);
      if(!entry){status(t('uploadUnverified'),true);break}
      const check=await request('GET',{action:'get',id:docId});
      const verified=check.record&&check.record.id===docId&&(check.record.files||[]).some(f=>f.id===entry.id&&Number(f.size)===file.size&&f.kind===kind);
      if(!verified){status(t('uploadUnverified'),true);break}
      if(!state.record||state.record.id!==docId||state.view!=='form'||!active())break;
      state.record=check.record;
      showForm(check.record);
      status(file.name+' · '+t('uploadVerified'),false);
     }catch(e){status(t('uploadUnverified')+' '+e.message,true);break}
    }
   }finally{state.uploading=false}
  });label.appendChild(input);cell.appendChild(label);grid.appendChild(cell)}
 panel.appendChild(grid);
 if(!record){panel.appendChild(make('p','eh1903-muted',t('uploadAutoCreate')));return panel}
 syncGallery(record.id);
 const gallery=make('div','eh1903-photo-grid');
 (record.files||[]).filter(file=>file.kind!=='reklamation').forEach(file=>{
  if(isPhoto(file)){
   const card=make('div','eh1903-photo-card'),trigger=button(t('preview'),()=>preview(record.id,file));
   trigger.classList.add('eh1903-photo-trigger');trigger.setAttribute('aria-label',t('preview')+': '+file.name);
   trigger.dataset.evidencePhotoOpen=file.id;
   const frame=make('div','eh1903-photo-frame'),img=make('img','eh1903-photo-thumb');
   img.alt=file.name;img.loading='lazy';img.decoding='async';
   img.addEventListener('load',()=>frame.classList.add('eh1903-photo-loaded'));
   frame.appendChild(make('span','eh1903-photo-placeholder',t('loading')));frame.appendChild(img);
   trigger.replaceChildren(frame);card.appendChild(trigger);
   const name=make('span','eh1903-photo-caption',file.name);name.title=file.name;card.appendChild(name);
   card.appendChild(button(t('download'),()=>downloadEvidence(record.id,file)));
   gallery.appendChild(card);inlinePhoto(record.id,file,img);
  }else{
   const row=make('div','eh1903-file');row.appendChild(make('span',null,file.name));
   row.appendChild(button(t('preview'),()=>preview(record.id,file)));
   row.appendChild(button(t('download'),()=>downloadEvidence(record.id,file)));
   panel.appendChild(row);
  }
 });
 if(gallery.childElementCount)panel.insertBefore(gallery,panel.querySelector('.eh1903-file'));
 return panel}
function asBase64(file){return file.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(out)})}
async function preview(id,file){
 const currentRoot=root();if(!currentRoot)return;status(t('loading'),false);
 const scope=galleryRecord;
 try{
  const blob=await fileRequest(id,file);
  if(scope!==galleryRecord||!currentRoot.isConnected)return;
  const url=URL.createObjectURL(blob),overlay=make('div','eh1903-dialog');
  const inner=make('div','eh1903-dialog-inner'),actions=make('div','eh1903-actions');
  const previous=d.activeElement;
  let closed=false;
  function close(){
   if(closed)return;closed=true;d.removeEventListener('keydown',onKey);
   overlay.remove();URL.revokeObjectURL(url);if(closeGalleryDialog===close)closeGalleryDialog=null;
   if(previous&&previous.isConnected)previous.focus();
  }
  function onKey(e){if(e.key==='Escape'){e.preventDefault();close()}}
  if(closeGalleryDialog)closeGalleryDialog();
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label',t('preview')+': '+file.name);overlay.dataset.evidencePhotoDialog='';
  actions.appendChild(button(t('download'),()=>{
   const link=make('a');link.href=url;link.download=file.name;d.body.appendChild(link);link.click();link.remove()
  }));
  const closeButton=button(t('close'),close,true);actions.appendChild(closeButton);inner.appendChild(actions);
  const media=make(file.mime==='application/pdf'?'iframe':'img');
  media.src=url;if(media.tagName==='IMG')media.alt=file.name;else media.title=file.name;
  inner.appendChild(media);overlay.appendChild(inner);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  currentRoot.appendChild(overlay);d.addEventListener('keydown',onKey);closeGalleryDialog=close;
  closeButton.focus();status('',false);
 }catch(e){status(e.message,true)}
}
function complaintsPanel(record){
 const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('complaints')));
 if(!record){panel.appendChild(make('p','eh1903-muted',t('uploadFirst')));return panel}
 const complaints=record.complaints||[];
 if(!complaints.length)panel.appendChild(make('p','eh1903-muted',t('noComplaints')));
 const categories=['schaden','fehlmenge','falscher_artikel','verspaetung','dokumentenfehler','sonstiges'];
 function choice(field,options,value){
  const el=make('select');el.setAttribute('data-complaint-field',field);
  options.forEach(key=>{const o=make('option',null,t(key));o.value=key;o.selected=key===value;el.appendChild(o)});
  return el;
 }
 complaints.slice().reverse().forEach(c=>{
  const details=make('details','eh1903-complaint'),summary=make('summary',null,dateText(c.reportedDate)+' · '+(c.createdBy||'')+' · '+t(c.category||'sonstiges')+' · '+t(c.state==='abgeschlossen'?'complaintCompleted':c.state));
  const openKey=record.id+':'+c.id;
  if(state.expandedComplaintId===openKey)details.open=true;
  details.addEventListener('toggle',()=>{
   if(!details.isConnected)return;
   if(details.open)state.expandedComplaintId=openKey;
   else if(state.expandedComplaintId===openKey)state.expandedComplaintId='';
  });
  details.appendChild(summary);details.appendChild(make('p',null,c.text));
  const statusSelect=make('select');statusSelect.setAttribute('aria-label',t('state'));
  (c.state==='abgeschlossen'?['abgeschlossen','in_pruefung']:['offen','in_pruefung'])
   .forEach(st=>{const o=make('option',null,t(st==='abgeschlossen'?'complaintCompleted':st));o.value=st;o.selected=c.state===st;statusSelect.appendChild(o)});
  statusSelect.addEventListener('change',async()=>{
   const changed=await write('complaint-status',{complaintId:c.id,state:statusSelect.value});
   if(!changed)statusSelect.value=c.state;
  });
  const statusRow=make('div','eh1903-complaint-toolbar');statusRow.appendChild(make('span',null,t('state')+': '));statusRow.appendChild(statusSelect);
  details.appendChild(statusRow);
  const files=(record.files||[]).filter(f=>f.complaintId===c.id&&f.kind==='reklamation');
  const attachments=make('div','eh1903-complaint-attachments');attachments.appendChild(make('h3',null,t('complaintAttachments')));
  const upload=make('input');upload.type='file';upload.multiple=true;upload.accept='application/pdf,image/jpeg,image/png';
  upload.setAttribute('aria-label',t('complaintAttachments'));upload.disabled=c.state==='abgeschlossen';
  upload.addEventListener('change',async()=>{
   state.expandedComplaintId=openKey;
   const selected=[...upload.files];upload.value='';
   if(!selected.length)return;
   if(state.uploading||state.busy){status(t('uploadBusy'),true);return}
   state.uploading=true;
   try{
    for(const file of selected){
     if(!state.record||state.record.id!==record.id||state.view!=='form')break;
     if(file.size>15*1024*1024||file.size===0){status(file.name+' · '+t('complaintFileLimit'),true);continue}
     const ids=new Set((state.record.files||[]).map(f=>f.id));
     const uploaded=await write('upload',{kind:'reklamation',complaintId:c.id,fileName:file.name,base64:await asBase64(file)},record.id);
     if(!uploaded)break;
     const entry=(uploaded.record.files||[]).find(f=>f.complaintId===c.id&&!ids.has(f.id)&&f.size===file.size);
     const check=await request('GET',{action:'get',id:record.id});
     if(!entry||!(check.record.files||[]).some(f=>f.id===entry.id&&f.complaintId===c.id)){
      status(t('uploadUnverified'),true);break
     }
     state.record=check.record;showForm(check.record);status(file.name+' · '+t('uploadVerified'),false);
    }
   }catch(e){status(e.message,true)}finally{state.uploading=false}
  });
  attachments.appendChild(upload);
  const gallery=make('div','eh1903-complaint-files');
  files.forEach(file=>{
   const row=make('div','eh1903-file');
   const attachChoice=make('input');
   attachChoice.type='checkbox';attachChoice.value=file.id;attachChoice.dataset.complaintAiFile=c.id;
   attachChoice.setAttribute('aria-label',t('selectForAi')+': '+file.name);
   attachChoice.disabled=Number(file.size)>4*1024*1024;
   const choiceLabel=make('label','eh1903-evidence-choice');choiceLabel.appendChild(attachChoice);
   choiceLabel.appendChild(make('span',null,t('selectForAi')));
   row.appendChild(choiceLabel);
   row.appendChild(make('span',null,file.name));
   row.appendChild(button(t('preview'),()=>preview(record.id,file)));
   row.appendChild(button(t('download'),()=>downloadEvidence(record.id,file)));
   gallery.appendChild(row);
  });attachments.appendChild(gallery);details.appendChild(attachments);
  const fieldGrid=make('div','eh1903-complaint-fields');
  function field(key,kind='textarea'){
   const label=make('label',null,t(key)),el=make(kind==='textarea'?'textarea':'input');
   if(kind!=='textarea')el.type=kind;
   el.value=c[key]||'';el.setAttribute('data-complaint-field',key);
   if(c.state==='abgeschlossen')el.disabled=true;
   label.appendChild(el);fieldGrid.appendChild(label);
  }
  function heading(key){fieldGrid.appendChild(make('h3','eh1903-section-heading',t(key)))}
  heading('complaintPlan');
  const categoryLabel=make('label',null,t('complaintCategory'));
  const category=choice('category',categories,c.category||'sonstiges');
  category.disabled=c.state==='abgeschlossen';categoryLabel.appendChild(category);fieldGrid.appendChild(categoryLabel);
  field('owner','text');field('dueDate','date');
  field('rootCause');field('immediateAction');field('correctiveAction');field('preventiveAction');
  heading('effectivenessReview');
  field('checkDate','date');field('checkMethod');field('checkSample');field('checkCriteria');
  field('effectivenessEvidence');
  const resultLabel=make('label',null,t('effectivenessResult'));
  const resultSelect=choice('effectivenessResult',['offen','wirksam','unwirksam'],c.effectivenessResult||'offen');
  resultSelect.disabled=c.state==='abgeschlossen';resultLabel.appendChild(resultSelect);fieldGrid.appendChild(resultLabel);
  if(c.verifiedBy)fieldGrid.appendChild(make('p','eh1903-muted',t('verifiedBy')+': '+c.verifiedBy+' · '+(c.verifiedOn||'')));
  heading('complaintReplies');field('customerDraft');field('carrierDraft');
  heading('complaintAnalysis');field('analysisText');
  details.appendChild(fieldGrid);
  const toolbar=make('div','eh1903-actions');
  if(c.state!=='abgeschlossen')toolbar.appendChild(button(t('saveComplaintPlan'),async()=>{
   const data={complaintId:c.id};
   details.querySelectorAll('[data-complaint-field]').forEach(el=>data[el.getAttribute('data-complaint-field')]=el.value);
   // Data and verification are saved with a single optimistic-concurrency revision.
   state.expandedComplaintId=openKey;
   const result=await write('complaint-update',data,record.id);
   if(!result&&details.isConnected)details.open=true;
  },true));
  // A verified case can be completed, but never with unsaved changed proof fields.
  if(c.state!=='abgeschlossen'){
   const done=button(t('markComplaintDone'),async()=>{
    const fields=[...details.querySelectorAll('[data-complaint-field]')];
    const dirty=fields.some(el=>String(el.value||'').trim()!==String(c[el.getAttribute('data-complaint-field')]||'').trim());
    if(dirty){status(t('saveComplaintFirst'),true);return}
    if(c.effectivenessResult!=='wirksam'||!c.verifiedBy||!c.verifiedOn){
     status(t('verifyBeforeDone'),true);return
    }
    if(!w.confirm(t('confirmComplaintDone')))return;
    state.expandedComplaintId=openKey;
    await write('complaint-status',{complaintId:c.id,state:'abgeschlossen'},record.id);
   });
   done.disabled=c.effectivenessResult!=='wirksam'||!c.verifiedBy||!c.verifiedOn;
   done.title=t(done.disabled?'verifyBeforeDone':'markComplaintDone');
   toolbar.appendChild(done);
  }
  const consentLabel=make('label','eh1903-consent'),consent=make('input');
  consent.type='checkbox';consentLabel.appendChild(consent);consentLabel.appendChild(make('span',null,t('complaintAiConsent')));
  toolbar.appendChild(consentLabel);
  const transferLabel=make('label','eh1903-consent'),transfer=make('input');
  transfer.type='checkbox';transferLabel.appendChild(transfer);
  transferLabel.appendChild(make('span',null,t('complaintFileAiConsent')));
  toolbar.appendChild(transferLabel);
  const answer=make('div','eh1903-complaint-advice');
  toolbar.appendChild(button(t('analyzeComplaint'),async()=>{
   if(state.busy||!state.record||state.record.id!==record.id)return;
   status(t('loading'),false);
   try{
    const selected=[...details.querySelectorAll('[data-complaint-ai-file]')].filter(el=>el.checked).map(el=>el.value);
    if(selected.length>2){status(t('aiFileSelectionLimit'),true);return}
    if(selected.length&&!transfer.checked){status(t('complaintFileAiConsent'),true);return}
    const result=await request('POST',{action:'complaint-analysis',id:record.id,expectedRevision:state.record.revision,
     complaintId:c.id,consent:consent.checked,shareFiles:transfer.checked,fileIds:selected,language:language()});
    if(!answer.isConnected||!state.record||state.record.id!==record.id)return;
    answer.replaceChildren(make('h4',null,result.mode==='ki'?t('aiDraft'):t('ruleDraft')));
    const proposal=result.suggestions||{};
    answer.appendChild(make('p','eh1903-muted',result.notice||''));
    if(result.text){
     const aiText=make('textarea');aiText.value=result.text;aiText.readOnly=false;
     aiText.setAttribute('aria-label',t('complaintAnalysis'));answer.appendChild(aiText);
     const analysisField=details.querySelector('[data-complaint-field="analysisText"]');
     if(analysisField)analysisField.value=aiText.value;
     aiText.addEventListener('input',()=>{if(analysisField)analysisField.value=aiText.value});
    }
    for(const key of ['possibleCause','immediateAction','correctiveAction','preventiveAction','checkMethod','checkCriteria','customerDraft','carrierDraft']){
     if(!proposal[key])continue;
     const row=make('div','eh1903-complaint-suggestion');
     row.appendChild(make('strong',null,t(key)));
     const value=make('p',null,proposal[key]);row.appendChild(value);
     if(key!=='possibleCause')row.appendChild(button(t('useSuggestion'),()=>{
      const field=details.querySelector('[data-complaint-field="'+key+'"]');
      if(field&&!field.disabled){field.value=proposal[key];status(t('suggestionNotSaved'),false)}
     }));
     answer.appendChild(row);
    }
    status(t('suggestionNotSaved'),false);
   }catch(e){status(e.message,true)}
  }));
  details.appendChild(toolbar);details.appendChild(answer);panel.appendChild(details);
 });
 const form=make('div','eh1903-complaint-new');form.appendChild(make('h3',null,t('complaintText')));
 const date=make('input');date.type='date';date.value=new Date().toISOString().slice(0,10);date.setAttribute('aria-label',t('complaintDate'));form.appendChild(date);
 const category=choice('category',['schaden','fehlmenge','falscher_artikel','verspaetung','dokumentenfehler','sonstiges'],'sonstiges');
 category.removeAttribute('data-complaint-field');category.setAttribute('aria-label',t('complaintCategory'));form.appendChild(category);
 const text=make('textarea');text.placeholder=t('complaintText');text.setAttribute('aria-label',t('complaintText'));form.appendChild(text);
 const acts=make('div','eh1903-actions');acts.appendChild(button(t('addComplaint'),()=>{
  if(!text.value.trim()){status(t('complaintText'),true);return}
  write('complaint',{text:text.value,reportedDate:date.value,category:category.value});
 },true));form.appendChild(acts);
 panel.appendChild(form);return panel
}
function historyPanel(record){const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('history')));
 if(record)(record.history||[]).slice(-25).reverse().forEach(x=>panel.appendChild(make('p','eh1903-muted',dateText(x.at)+' · '+x.by+' · '+x.action)));
 return panel}
async function openRecord(id){state.searchRun++;const serial=++state.serial;state.view='form';state.record=null;const app=initPage();if(!app)return;app.appendChild(hero(t('title'),t('loading')));
 try{const res=await request('GET',{action:'get',id});if(serial===state.serial&&state.view==='form'&&active()){state.canDelete=res.canDelete===true;state.canRegisterCustomer=res.canRegisterCustomer===true;showForm(res.record)}}
 catch(e){app.appendChild(make('p','eh1903-status',e.message));app.appendChild(button(t('back'),()=>showList()))}}
function open(){const app=host();if(!app)return false;state.serial++;state.view='list';state.record=null;showList();loadList(true);try{if(w.ExportHUBMobileMenu&&w.ExportHUBMobileMenu.isOpen())w.ExportHUBMobileMenu.close()}catch(_){}return true}
function ensureNav(){const nav=d.getElementById('nav');if(!nav)return;
 let node=nav.querySelector('[data-exporthub-evidence-nav]');if(!node){node=make('button');node.type='button';node.setAttribute('data-exporthub-evidence-nav','');node.setAttribute('data-index321-view','shipmentevidence');node.setAttribute('data-menu-accent','#4c7cce');node.style.setProperty('--menu-accent','#4c7cce');
 const existing=nav.querySelector('[data-exporthub-urgent-nav]')||nav.querySelector('[data-pack-notifications-nav]')||nav.querySelector('button');
 node.className=(existing&&existing.className||'').replace(/active|is-active|pack-notification-nav-entry|urgent-orders-nav-entry/g,'').trim();
 const icon=make('span','index308-nav-icon');icon.textContent='▣';const label=make('span','index308-nav-label');label.textContent=t('menu');
 node.appendChild(icon);node.appendChild(label);
 if(existing&&existing.parentNode===nav)nav.insertBefore(node,existing.nextSibling);else nav.appendChild(node);
 }else{const label=node.querySelector('.index308-nav-label');if(label)label.textContent=t('menu')}
 if(active()){
  // Core navigation may still carry an active marker from the previous view.
  nav.querySelectorAll(':scope>button.active').forEach(other=>{if(other!==node)other.classList.remove('active')});
  nav.querySelectorAll(':scope>button[aria-current="page"]').forEach(other=>{if(other!==node)other.removeAttribute('aria-current')});
  node.classList.add('active');node.setAttribute('aria-current','page');
 }else{node.classList.remove('active');node.removeAttribute('aria-current')}
}
d.addEventListener('click',function(e){const target=e.target&&e.target.closest&&e.target.closest('[data-exporthub-evidence-nav]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();open()},true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ensureNav,{once:true});else ensureNav();
function repair(){ensureNav();if(active()&&!root()&&!state.busy){if(state.view==='form')showForm(state.record);else showList()}}
if(w.addEventListener)['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(event=>w.addEventListener(event,repair));
if(w.setInterval)w.setInterval(()=>{if(!d.hidden&&!d.querySelector('[data-exporthub-evidence-nav]'))ensureNav()},1800);
w.ExportHUBStandaloneEvidence=Object.freeze({open,ensureNav,version:'RC1903'});
})(window,document);