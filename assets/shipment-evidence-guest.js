(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBGuestEvidence)return;
const FIELDS=[
 ['shipmentNumber','text'],['customer','text'],['dispatchDate','date'],
 ['colli','number'],['weightKg','number'],['packaging','text'],
 ['shippingMethod','text'],['carrier','text'],['trackingNumber','text'],
 ['contents','textarea'],['loadSecuring','textarea'],['remarks','textarea']
];
let record=null,token='',busy=false,originFocus=null;
function t(k){const p=w.ExportHUBEvidenceI18n||{},lang=(w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language()||'de').slice(0,2);return p[lang]&&p[lang][k]||p.de&&p.de[k]||k}
function make(tag,cls,value){const el=d.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el}
function btn(title,fn,primary){const b=make('button',primary?'eh1903-primary':'',title);b.type='button';b.addEventListener('click',fn);return b}
function root(){return d.getElementById('eh1903-guest-root')}
function status(message,error){const el=root()&&root().querySelector('[data-guest-status]');if(el){el.textContent=message||'';el.dataset.error=error?'true':'false'}}
function readFields(){const values={};root().querySelectorAll('[data-guest-field]').forEach(el=>{values[el.dataset.guestField]=String(el.value||'').trim()});return values}
function base64(file){return file.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(out)})}
async function api(method,action,params){
 const headers={Accept:'application/json'};
 if(token)headers['X-ExportHUB-Evidence-Token']=token;
 const options={method,headers,credentials:'same-origin',cache:'no-store'};
 let url='/api/shipment-evidence';
 if(method==='GET')url+='?'+new URLSearchParams({action,...params});
 else{headers['Content-Type']='application/json';options.body=JSON.stringify({action,...params})}
 const response=await fetch(url,options);
 if(action==='public-file'){if(!response.ok)throw new Error('HTTP '+response.status);return response.blob()}
 let payload;try{payload=await response.json()}catch(_){payload={}};
 if(!response.ok||payload.ok!==true)throw new Error(payload.message||'HTTP '+response.status);
 return payload;
}
async function save(){
 if(busy)return false;
 const current=readFields();
 if(!current.customer||!current.shipmentNumber||!current.dispatchDate){status(t('required'),true);return false}
 busy=true;status(t('saving'),false);
 try{
  const isNew=!record;
  const response=await api('POST',isNew?'public-create':'public-save',
   isNew?{fields:current,website:''}:{id:record.id,expectedRevision:record.revision,fields:current});
  if(isNew)token=response.publicToken;
  record=response.record;
  updateRecord();
  status(isNew?t('guestSaved'):t('saved'),false);
  return true;
 }catch(e){status(e.message,true);return false}finally{busy=false}
}
async function upload(files,kind){
 if(busy||!record||!token)return;
 const selected=[...files];
 for(const file of selected){
  if(busy)return;
  if(file.size>15*1024*1024){status(file.name+' · 15 MB',true);continue}
  busy=true;status(t('uploading'),false);
  try{
   const current=readFields(),changed=FIELDS.some(([key])=>String(current[key]||'')!==String(record.fields[key]||''));
   if(changed){
    const saved=await api('POST','public-save',{id:record.id,expectedRevision:record.revision,fields:current});
    record=saved.record;
   }
   const encoded=await base64(file);
   const res=await api('POST','public-upload',{id:record.id,expectedRevision:record.revision,kind,fileName:file.name,base64:encoded});
   record=res.record;
   updateRecord();
   status(t('uploaded'),false);
  }catch(e){status(e.message,true);break}finally{busy=false}
 }
}
async function download(file){
 if(!record||!token)return;
 status(t('loading'),false);
 try{
  const blob=await api('GET','public-file',{id:record.id,fileId:file.id});
  const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=file.name;d.body.appendChild(a);a.click();a.remove();w.setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('',false);
 }catch(e){status(e.message,true)}
}
function updateRecord(){
 const el=root();if(!el)return;
 const summary=el.querySelector('[data-guest-summary]'),files=el.querySelector('[data-guest-files]'),saveButton=el.querySelector('[data-guest-save]');
 if(saveButton)saveButton.textContent=record?t('guestSaveChanges'):t('save');
 summary.replaceChildren();
 files.replaceChildren();
 if(!record){files.hidden=true;return}
 summary.appendChild(make('p','eh1903-muted',t('docId')+': '+record.id));
 summary.appendChild(make('p','eh1903-muted',t('guestFilesHint')));
 files.hidden=false;
 const uploadGrid=make('div','eh1903-uploads');
 for(const [kind,label,accept] of [['foto','uploadPhotos','image/jpeg,image/png'],['lieferschein','uploadNotes','application/pdf,image/jpeg,image/png']]){
  const area=make('div','eh1903-upload'),caption=make('label',null,t(label)),picker=make('input');
  picker.type='file';picker.accept=accept;picker.multiple=true;
  picker.addEventListener('change',()=>{const selected=[...picker.files];picker.value='';upload(selected,kind)});
  caption.appendChild(picker);area.appendChild(caption);uploadGrid.appendChild(area);
 }
 files.appendChild(uploadGrid);
 for(const file of record.files||[]){
  const row=make('div','eh1903-file');row.appendChild(make('span',null,file.name));
  row.appendChild(btn(t('download'),()=>download(file)));files.appendChild(row)
 }
}
function close(){
 const modal=d.getElementById('eh1903-guest-overlay');if(modal)modal.remove();
 token='';record=null;busy=false;
 d.removeEventListener('keydown',onKey);
 if(originFocus&&originFocus.isConnected)originFocus.focus();originFocus=null;
}
function onKey(e){if(e.key==='Escape'){e.preventDefault();close()}}
function open(){
 if(d.getElementById('eh1903-guest-overlay'))return true;
 originFocus=d.activeElement;record=null;token='';busy=false;
 const overlay=make('div','eh1903-guest-overlay');overlay.id='eh1903-guest-overlay';
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',t('guestOpen'));
 const page=make('main');page.id='eh1903-guest-root';
 const header=make('header','eh1903-hero'),top=make('div','eh1903-guest-top');
 top.appendChild(make('h1',null,t('guestOpen')));top.appendChild(btn(t('close'),close));
 header.appendChild(top);header.appendChild(make('p','eh1903-muted',t('guestIntro')));page.appendChild(header);
 const card=make('section','eh1903-panel'),grid=make('div','eh1903-grid');
 card.appendChild(make('h2',null,t('edit')));
 const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 for(const [name,kind] of FIELDS){
  const label=make('label',['contents','loadSecuring','remarks'].includes(name)?'eh1903-wide':'',t(name));
  const input=make(kind==='textarea'?'textarea':'input');
  if(kind!=='textarea')input.type=kind;
  input.dataset.guestField=name;
  if(name==='dispatchDate')input.value=today;
  if(name==='colli'||name==='weightKg'){input.min='0';input.step=name==='colli'?'1':'0.001'}
  if(['shipmentNumber','customer','dispatchDate'].includes(name))input.required=true;
  label.appendChild(input);grid.appendChild(label);
 }
 card.appendChild(grid);
 const action=make('div','eh1903-actions'),saveButton=btn(t('save'),save,true);
 saveButton.setAttribute('data-guest-save','');action.appendChild(saveButton);
 action.appendChild(btn(t('guestNew'),()=>{if(record) {record=null;token='';page.querySelectorAll('[data-guest-field]').forEach(el=>{el.value=el.dataset.guestField==='dispatchDate'?today:''});updateRecord();status('',false)}}));
 card.appendChild(action);page.appendChild(card);
 const summary=make('section','eh1903-panel');summary.setAttribute('data-guest-summary','');page.appendChild(summary);
 const files=make('section','eh1903-panel');files.setAttribute('data-guest-files','');page.appendChild(files);
 const feedback=make('p','eh1903-status');feedback.setAttribute('data-guest-status','');feedback.setAttribute('role','status');page.appendChild(feedback);
 overlay.appendChild(page);d.body.appendChild(overlay);d.addEventListener('keydown',onKey);
 updateRecord();page.querySelector('[data-guest-field="customer"]').focus();
 return true;
}
function ensureLoginEntry(){
 const login=d.getElementById('login'),card=login&&login.querySelector('.login-card');if(!card)return false;
 let action=card.querySelector('[data-eh1903-guest-open]');
 if(!action){action=btn(t('guestOpen'),open,true);action.setAttribute('data-eh1903-guest-open','');card.appendChild(action)}
 else action.textContent=t('guestOpen');
 return true;
}
function ready(){
 ensureLoginEntry();
 if(new URLSearchParams(w.location.search).get('sendungsdokumentation')==='neu')open();
 const login=d.getElementById('login');
 if(login&&w.MutationObserver){const observer=new MutationObserver(()=>{if(!login.querySelector('[data-eh1903-guest-open]'))ensureLoginEntry()});observer.observe(login,{subtree:true,childList:true})}
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
w.addEventListener('exporthub:language-changed',ensureLoginEntry);
w.ExportHUBGuestEvidence=Object.freeze({open,close,ensureLoginEntry});
})(window,document);
