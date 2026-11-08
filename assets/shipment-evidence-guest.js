(function(w,d){
'use strict';
// Public-only entry. Never inject a button into ExportHUB's login card.
if(!w||!d||w.ExportHUBGuestEvidence)return;
const STORAGE='exporthub-shipment-evidence-own-v2';
const FIELDS=[
 ['shipmentNumber','text'],['customer','text'],['dispatchDate','date'],
 ['colli','number'],['weightKg','number'],['packaging','text'],
 ['shippingMethod','text'],['carrier','text'],['trackingNumber','text'],
 ['contents','textarea'],['loadSecuring','textarea'],['remarks','textarea']
];
const languages=['de','en','pl','es','fr','it'];
const ownText={
 de:{new:'Neue Sendung',mine:'Meine Nachweise',next:'Weiter zu Fotos und Lieferscheinen',finish:'Dokumentation abschließen',finished:'Gespeichert – nur ExportHUB-Mitarbeiter können diesen Nachweis jetzt bearbeiten.',draft:'Entwurf – bitte Fotos hochladen und abschließen.',readonly:'Nur ansehen',mineIntro:'Nur Nachweise, die mit diesem Browser erstellt wurden. Kein Zugriff auf fremde Sendungen.',empty:'Hier wurden noch keine Nachweise erstellt.',missing:'Dieser Nachweis ist nicht mehr zugänglich. Bitte wende dich an ExportHUB.',finalConfirm:'Dokumentation jetzt abschließen? Danach ist sie öffentlich nur noch lesbar.',start:'Neuen Nachweis erfassen',uploadHelp:'Optional Fotos und Lieferscheine hinzufügen und danach endgültig abschließen.',link:'Öffentlicher Erfassungslink',privacy:'Nachweise sind nicht öffentlich gelistet. Du siehst nur deine eigenen, solange dein Zugriff gültig ist.',saveDraft:'Daten übernommen. Jetzt können Dateien ergänzt werden.',access:'Zugriff auf eigene Nachweise ist 14 Tage möglich. Nach Abschluss nur noch ansehen.',status:'Status'},
 en:{new:'New shipment',mine:'My records',next:'Continue to photos and delivery notes',finish:'Submit documentation',finished:'Submitted – only ExportHUB staff can now edit this record.',draft:'Draft – upload files and submit.',readonly:'View only',mineIntro:'Records created on this browser only. No access to other shipments.',empty:'No records created here yet.',missing:'This record is no longer available. Please contact ExportHUB.',finalConfirm:'Submit now? Afterwards the public page is read-only.',start:'Record another shipment',uploadHelp:'Optionally add photos and delivery notes, then submit.',link:'Public entry link',privacy:'Records are not publicly listed. Only your own records are accessible while authorized.',saveDraft:'Details saved. You can now attach files.',access:'Access to your records is available for 14 days. Viewing only after submission.',status:'Status'}
};
let record=null,token='',busy=false,mode='new',lang='de',session=0;
function t(k){const p=w.ExportHUBEvidenceI18n||{};return p[lang]&&p[lang][k]||p.de&&p.de[k]||k}
function x(k){return ownText[lang]&&ownText[lang][k]||ownText.en[k]||k}
function make(tag,cls,text){const el=d.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el}
function button(label,fn,primary){const el=make('button',primary?'eh1903-primary':'',label);el.type='button';el.addEventListener('click',fn);return el}
function root(){return d.getElementById('eh1903-guest-root')}
function status(message,error){const r=root(),el=r&&r.querySelector('[data-guest-status]');if(el){el.textContent=message||'';el.dataset.error=error?'true':'false'}}
function records(){try{const value=JSON.parse(w.localStorage.getItem(STORAGE)||'[]');return Array.isArray(value)?value.filter(v=>v&&/^DOK-\d{8}-[A-F0-9]{8}$/.test(v.id)&&/^[A-Za-z0-9_-]{40,60}$/.test(v.token)).slice(0,40):[]}catch(_){return[]}}
function remember(rec,key){try{const all=records().filter(v=>v.id!==rec.id);all.unshift({id:rec.id,token:key,customer:rec.fields.customer,shipmentNumber:rec.fields.shipmentNumber,createdAt:rec.createdAt});w.localStorage.setItem(STORAGE,JSON.stringify(all.slice(0,40)))}catch(_){status('Bitte die Dokumentationsnummer notieren.',true)}}
function readFields(){const values={};root().querySelectorAll('[data-guest-field]').forEach(el=>values[el.dataset.guestField]=String(el.value||'').trim());return values}
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
 const newBtn=button(x('new'),()=>{session++;record=null;token='';mode='new';render()},page==='new');
 const mineBtn=button(x('mine'),()=>{session++;record=null;token='';mode='mine';render()},page==='mine');
 newBtn.setAttribute('aria-current',page==='new'?'page':'false');mineBtn.setAttribute('aria-current',page==='mine'?'page':'false');
 row.appendChild(newBtn);row.appendChild(mineBtn);
 const select=make('select');select.setAttribute('aria-label','Sprache / Language');
 for(const code of languages){const op=make('option',null,code.toUpperCase());op.value=code;op.selected=code===lang;select.appendChild(op)}
 select.addEventListener('change',()=>{lang=select.value;render()});row.appendChild(select);
 top.appendChild(row);return top;
}
function createFields(container,current,readonly){
 const grid=make('div','eh1903-grid');
 for(const [key,kind] of FIELDS){
  const label=make('label',['contents','loadSecuring','remarks'].includes(key)?'eh1903-wide':'',t(key));
  const el=make(kind==='textarea'?'textarea':'input');if(kind!=='textarea')el.type=kind;
  el.dataset.guestField=key;el.readOnly=Boolean(readonly);
  if(['customer','shipmentNumber','dispatchDate'].includes(key))el.required=true;
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
function openNew(){session++;mode='new';record=null;token='';render()}
async function saveFirst(){
 if(busy)return;const fields=readFields();
 if(!fields.customer||!fields.shipmentNumber||!fields.dispatchDate){status(t('required'),true);return}
 const current=++session;busy=true;status(t('saving'),false);
 try{
  const response=await api('POST','public-create',{fields,website:''},'');
  if(current!==session)return;
  record=response.record;token=response.publicToken;remember(record,token);
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
  createFields(panel,record&&record.fields||null,Boolean(record));
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
