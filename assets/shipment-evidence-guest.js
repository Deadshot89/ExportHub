(function(w,d){
'use strict';
// Public-only entry. Never inject a button into ExportHUB's login card.
if(!w||!d||w.ExportHUBGuestEvidence)return;
const STORAGE='exporthub-shipment-evidence-own-v2';
const FIELDS=[
 ['shipmentNumber','text'],['dispatchDate','date'],
 ['colli','number'],['weightKg','number'],
 ['carrier','text'],['trackingNumber','text'],['remarks','textarea']
];
const languages=['de','en','pl','es','fr','it'];
let record=null,token='',busy=false,mode='new',lang='de',session=0;
let customerChoice=null,customerPending=false,draftFields={},customerNumberDraft='',customerNameDraft='';
function t(k){const p=w.ExportHUBEvidenceI18n||{};return p[lang]&&p[lang][k]||p.de&&p.de[k]||k}
function x(k){const p=w.ExportHUBEvidenceI18n||{},key='public'+k[0].toUpperCase()+k.slice(1);return p[lang]&&p[lang][key]||p.en&&p.en[key]||key}
function make(tag,cls,text){const el=d.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function button(label,fn,primary){const el=make('button',primary?'eh1903-primary':'',label);el.type='button';el.addEventListener('click',fn);return el}
function root(){return d.getElementById('eh1903-guest-root')}
function status(message,error){const r=root(),el=r&&r.querySelector('[data-guest-status]');if(el){el.textContent=message||'';el.dataset.error=error?'true':'false'}}
function records(){try{const value=JSON.parse(w.localStorage.getItem(STORAGE)||'[]');return Array.isArray(value)?value.filter(v=>v&&/^DOK-\d{8}-[A-F0-9]{8}$/.test(v.id)&&/^[A-Za-z0-9_-]{40,60}$/.test(v.token)).slice(0,40):[]}catch(_){return[]}}
function remember(rec,key){try{const all=records().filter(v=>v.id!==rec.id);all.unshift({id:rec.id,token:key,customer:rec.fields.customer,shipmentNumber:rec.fields.shipmentNumber,createdAt:rec.createdAt});w.localStorage.setItem(STORAGE,JSON.stringify(all.slice(0,40)))}catch(_){status(x('localSaveError'),true)}}
function readFields(){
 const values={};const node=root();if(!node)return values;
 node.querySelectorAll('[data-guest-field]').forEach(el=>values[el.dataset.guestField]=String(el.value||'').trim());
 if(customerPending){
  const number=node.querySelector('[data-guest-customer-number]'),name=node.querySelector('[data-guest-customer-name]');
  values.customerNumber=String(number&&number.value||'').trim().toUpperCase();
  values.customer=String(name&&name.value||'').trim();values.customerMode='pending';values.customerId='';
 }else if(customerChoice){
  values.customerNumber=customerChoice.number;
  values.customer=customerChoice.name;values.customerId=customerChoice.id;values.customerMode='existing';
 }
 return values;
}
function preserveDraft(){
 if(mode==='new'&&!record){draftFields=readFields();
  const number=root()&&root().querySelector('[data-guest-customer-lookup]');
  if(number)customerNumberDraft=String(number.value||'').trim();
  if(customerPending){customerNameDraft=draftFields.customer||'';customerNumberDraft=draftFields.customerNumber||customerNumberDraft;}
 }
}
function resetNew(){
 session++;record=null;token='';mode='new';customerChoice=null;customerPending=false;
 draftFields={};customerNumberDraft='';customerNameDraft='';render();
}
async function base64(file){const bytes=new Uint8Array(await file.arrayBuffer());let out='';for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(out)}
async function api(method,action,params,key=token){
 const headers={Accept:'application/json'};
 if(key)headers['X-ExportHUB-Evidence-Token']=key;
 let url='/api/shipment-evidence';
 const options={method,headers,cache:'no-store',credentials:'omit'};
 if(method==='GET')url+='?'+new URLSearchParams({action,...params});
 else{headers['Content-Type']='application/json';options.body=JSON.stringify({action,...params})}
 const response=await fetch(url,options);
 if(action==='public-file'){if(!response.ok)throw new Error('HTTP '+response.status);return response.blob()}
 let json={};try{json=await response.json()}catch(_){}
 if(!response.ok||json.ok!==true)throw new Error(json.message||'HTTP '+response.status);
 return json;
}
function navbar(page){
 const top=make('header','eh1903-hero'),brand=make('div','eh1903-public-brand');
 brand.appendChild(make('strong',null,'ExportHUB360'));brand.appendChild(make('span','eh1903-muted',t('menu')));
 top.appendChild(brand);
 const row=make('div','eh1903-actions');
 const newBtn=button(x('new'),resetNew,page==='new');
 const mineBtn=button(x('mine'),()=>{session++;record=null;token='';mode='mine';render()},page==='mine');
 newBtn.setAttribute('aria-current',page==='new'?'page':'false');mineBtn.setAttribute('aria-current',page==='mine'?'page':'false');
 row.appendChild(newBtn);row.appendChild(mineBtn);
 const select=make('select');select.setAttribute('aria-label',x('language'));
 for(const code of languages){const op=make('option',null,code.toUpperCase());op.value=code;op.selected=code===lang;select.appendChild(op)}
 select.addEventListener('change',()=>{preserveDraft();lang=select.value;render()});row.appendChild(select);
 top.appendChild(row);return top;
}
function customerSelector(panel,current,readonly){
 const area=make('section','eh1903-customer-select');
 area.appendChild(make('h2',null,x('customerSelection')));
 if(readonly){
  const fields=make('div','eh1903-customer-result');
  fields.appendChild(make('strong',null,(current.customerNumber||'–')+' · '+(current.customer||'–')));
  if(current.customerMode==='pending')fields.appendChild(make('p','eh1903-muted',x('pendingNote')));
  area.appendChild(fields);panel.appendChild(area);return;
 }
 if(customerPending){
  area.appendChild(make('p','eh1903-muted',x('pendingNote')));
  const grid=make('div','eh1903-grid');
  for(const [key,value,labelKey] of [
   ['number',customerNumberDraft,'customerNumber'],
   ['name',customerNameDraft,'customerNewName']]){
    const label=make('label',null,x(labelKey)),field=make('input');
    field.type='text';field.required=true;field.maxLength=key==='number'?40:200;
    field.dataset[key==='number'?'guestCustomerNumber':'guestCustomerName']='';
    field.value=value;
    field.addEventListener('input',()=>{if(key==='number')customerNumberDraft=field.value;else customerNameDraft=field.value});
    label.appendChild(field);grid.appendChild(label);
  }
  area.appendChild(grid);
  area.appendChild(button(x('useExisting'),()=>{preserveDraft();customerPending=false;customerChoice=null;render()}));
 }else{
  const row=make('div','eh1903-actions'),lookup=make('input','eh1903-account-lookup');
  lookup.type='search';lookup.maxLength=40;lookup.autocomplete='off';
  lookup.placeholder=x('customerNumber');lookup.setAttribute('aria-label',x('customerNumber'));
  lookup.dataset.guestCustomerLookup='';lookup.value=customerNumberDraft||customerChoice&&customerChoice.number||'';
  lookup.addEventListener('input',()=>{if(customerChoice&&lookup.value.trim().toUpperCase()!==customerChoice.number)customerChoice=null;customerNumberDraft=lookup.value});
  lookup.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();findCustomer()}});
  row.appendChild(lookup);
  row.appendChild(button(x('findCustomer'),findCustomer,true));
  row.appendChild(button(x('newCustomer'),()=>{preserveDraft();customerPending=true;customerChoice=null;render()}));
  area.appendChild(row);
  area.appendChild(make('p','eh1903-muted',x('customerLookupHint')));
  if(customerChoice)area.appendChild(make('p','eh1903-customer-result',customerChoice.number+' · '+customerChoice.name));
 }
 panel.appendChild(area);
}
async function findCustomer(){
 if(busy||record)return;
 const input=root()&&root().querySelector('[data-guest-customer-lookup]');
 const number=String(input&&input.value||'').trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9._/-]{2,39}$/.test(number)){status(x('invalidCustomerNumber'),true);return}
 preserveDraft();
 const current=++session;busy=true;status(t('loading'),false);
 try{
  const value=await api('POST','public-customer-lookup',{customerNumber:number,website:''},'');
  if(current!==session)return;
  customerChoice=value.customer;customerPending=false;customerNumberDraft=number;
  render();status(x('customerFound'),false);
 }catch(e){if(current===session){customerChoice=null;status(e.message,true)}}
 finally{busy=false}
}
function createFields(container,current,readonly){
 customerSelector(container,current||{},readonly);
 const grid=make('div','eh1903-grid');
 for(const [key,kind] of FIELDS){
  const label=make('label',key==='remarks'?'eh1903-wide':'',t(key));
  const el=make(kind==='textarea'?'textarea':'input');if(kind!=='textarea')el.type=kind;
  el.dataset.guestField=key;el.readOnly=Boolean(readonly);
  if(['shipmentNumber','dispatchDate'].includes(key))el.required=true;
  if(key==='colli'||key==='weightKg'){el.min='0';el.step=key==='colli'?'1':'0.001'}
  el.value=current&&current[key]!==undefined?current[key]:key==='dispatchDate'?new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10):'';
  label.appendChild(el);grid.appendChild(label);
 }
 container.appendChild(grid);
}
function filesPanel(container){
 if(!record)return;
 const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('files')));
 const isDraft=!record.submittedAt;
 if(isDraft){
  panel.appendChild(make('p','eh1903-muted',x('uploadHelp')));
  const uploads=make('div','eh1903-uploads');
  for(const [kind,key,accept] of [['foto','uploadPhotos','image/jpeg,image/png'],['lieferschein','uploadNotes','application/pdf,image/jpeg,image/png']]){
   const field=make('label','eh1903-upload',t(key)),input=make('input');
   input.type='file';input.accept=accept;input.multiple=true;
   input.addEventListener('change',()=>{const selected=[...input.files];input.value='';upload(selected,kind)});
   field.appendChild(input);uploads.appendChild(field);
  }
  panel.appendChild(uploads);
 }
 for(const file of record.files||[]){
  const row=make('div','eh1903-file');row.appendChild(make('span',null,file.name));
  row.appendChild(button(t('download'),()=>download(file)));panel.appendChild(row);
 }
 container.appendChild(panel);
}
function openNew(){resetNew()}
async function saveFirst(){
 if(busy)return;const fields=readFields();
 if(!fields.customer||!fields.customerNumber||!fields.shipmentNumber||!fields.dispatchDate||
    (!customerPending&&!customerChoice)){status(x('customerRequired'),true);return}
 const current=++session;busy=true;status(t('saving'),false);
 try{
  const response=await api('POST','public-create',{fields,website:''},'');
  if(current!==session)return;
  record=response.record;token=response.publicToken;draftFields={};remember(record,token);
  mode='detail';render();status(x('saveDraft'),false);
 }catch(e){if(current===session)status(e.message,true)}
 finally{busy=false}
}
async function upload(files,kind){
 if(busy||!record||record.submittedAt)return;
 const current=session;busy=true;
 try{
  for(const file of files){
   if(current!==session)return;
   if(file.size>15*1024*1024){status(file.name+' · 15 MB',true);continue}
   status(t('uploading'),false);
   const encoded=await base64(file);
   const result=await api('POST','public-upload',{id:record.id,expectedRevision:record.revision,kind,fileName:file.name,base64:encoded});
   if(current!==session)return;
   record=result.record;remember(record,token);render();status(t('uploaded'),false);
  }
 }catch(e){if(current===session)status(e.message,true)}
 finally{busy=false}
}
async function submit(){
 if(busy||!record||record.submittedAt)return;
 if(!w.confirm(x('finalConfirm')))return;
 const current=session;busy=true;status(t('saving'),false);
 try{
  const result=await api('POST','public-submit',{id:record.id,expectedRevision:record.revision});
  if(current!==session)return;
  record=result.record;remember(record,token);render();status(x('finished'),false);
 }catch(e){if(current===session)status(e.message,true)}finally{busy=false}
}
async function download(file){
 if(!record)return;
 try{
  const blob=await api('GET','public-file',{id:record.id,fileId:file.id});
  const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=file.name;
  d.body.appendChild(a);a.click();a.remove();w.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){status(e.message,true)}
}
async function openMine(entry){
 if(busy)return;
 const current=++session;busy=true;mode='loading';render();
 try{const response=await api('GET','public-get',{id:entry.id},entry.token);
  if(current!==session)return;
  record=response.record;token=entry.token;mode='detail';render();
 }catch(e){if(current===session){mode='mine';render();status(x('missing')+' '+e.message,true)}}finally{busy=false}
}
function render(){
 const page=root();if(!page)return;page.replaceChildren(navbar(mode==='mine'?'mine':'new'));
 const app=make('main');page.appendChild(app);
 if(mode==='loading'){app.appendChild(make('p','eh1903-muted',t('loading')))}
 else if(mode==='mine'){
  const panel=make('section','eh1903-panel');panel.appendChild(make('h1',null,x('mine')));
  panel.appendChild(make('p','eh1903-muted',x('mineIntro')));
  const entries=records();
  if(!entries.length)panel.appendChild(make('p',null,x('empty')));
  entries.forEach(item=>{
   const row=make('div','eh1903-row'),details=make('div');
   details.appendChild(make('b',null,item.customer||item.id));
   details.appendChild(make('p','eh1903-muted',(item.shipmentNumber||'')+' · '+item.id));
   row.appendChild(details);row.appendChild(button(x('readonly'),()=>openMine(item)));panel.appendChild(row);
  });
  app.appendChild(panel)
 }else{
  const panel=make('section','eh1903-panel'),finished=record&&record.submittedAt;
  panel.appendChild(make('h1',null,record?t('docId')+': '+record.id:x('new')));
  panel.appendChild(make('p','eh1903-muted',record?(finished?x('finished'):x('draft')):t('guestIntro')));
  createFields(panel,record&&record.fields||draftFields,Boolean(record));
  const actions=make('div','eh1903-actions');
  if(!record)actions.appendChild(button(x('next'),saveFirst,true));
  else if(!finished)actions.appendChild(button(x('finish'),submit,true));
  else actions.appendChild(button(x('start'),openNew,true));
  panel.appendChild(actions);app.appendChild(panel);
  filesPanel(app);
 }
 const foot=make('section','eh1903-panel');foot.appendChild(make('p','eh1903-muted',x('privacy')));
 foot.appendChild(make('p','eh1903-muted',x('access')));app.appendChild(foot);
 const feedback=make('p','eh1903-status');feedback.dataset.guestStatus='';feedback.setAttribute('role','status');app.appendChild(feedback);
}
function ready(){
 if(!d.getElementById('eh1903-guest-root'))return;
 mode='new';render();
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
w.ExportHUBGuestEvidence=Object.freeze({open:()=>{if(!root())return false;openNew();return true},version:'RC1903-public'});
})(window,document);
