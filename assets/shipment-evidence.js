(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBStandaloneEvidence)return;
const FIELDS=[
 ['shipmentNumber','text'],['customer','text'],['dispatchDate','date'],
 ['colli','number'],['weightKg','number'],['packaging','text'],['shippingMethod','text'],
 ['carrier','text'],['trackingNumber','text'],['exporthubRef','text'],
 ['contents','textarea'],['loadSecuring','textarea'],['remarks','textarea']
];
const state={view:'list',record:null,records:[],continuation:null,busy:false,search:'',loading:false,serial:0};
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
async function fileRequest(id,file){const url='/api/shipment-evidence?'+new URLSearchParams({action:'file',id,fileId:file.id});const response=await fetch(url,{headers:headers(),credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);return response.blob()}
function dateText(s){try{return s?new Date(s).toLocaleDateString(language()==='de'?'de-DE':'en-GB'):''}catch(_){return s}}
function hero(title,desc){const h=make('header','eh1903-hero');h.appendChild(make('h1',null,title));h.appendChild(make('p','eh1903-muted',desc));return h}
function initPage(){const container=host();if(!container)return null;const app=make('main');app.id='eh1903-root';container.replaceChildren(app);d.body.setAttribute('data-exporthub-view','shipmentevidence');return app}
function showList(){state.view='list';state.record=null;const app=initPage();if(!app)return;app.appendChild(hero(t('title'),t('intro')));
 const actions=make('div','eh1903-actions');actions.appendChild(button(t('new'),()=>showForm(null),true));app.appendChild(actions);
 const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('list')));
 const search=make('input');search.type='search';search.placeholder=t('search');search.value=state.search;search.setAttribute('aria-label',t('search'));panel.appendChild(search);
 const list=make('div','eh1903-list');panel.appendChild(list);app.appendChild(panel);
 const more=button(t('loadMore'),()=>loadList(false));more.hidden=!state.continuation;panel.appendChild(more);
 const message=make('p','eh1903-status');message.setAttribute('data-eh1903-status','');message.setAttribute('aria-live','polite');app.appendChild(message);
 function updateRows(){list.replaceChildren();const term=state.search.toLowerCase().trim();
  const matches=state.records.filter(r=>!term||[r.id,r.fields&&r.fields.customer,r.fields&&r.fields.shipmentNumber,r.fields&&r.fields.trackingNumber].some(x=>String(x||'').toLowerCase().includes(term)));
  if(!matches.length){list.appendChild(make('p','eh1903-muted',t('none')));return}
  matches.forEach(r=>{const row=make('div','eh1903-row'),data=make('div');
    data.appendChild(make('b',null,r.fields&&r.fields.customer||'–'));
    data.appendChild(make('p',null,[r.fields&&r.fields.shipmentNumber,r.id,dateText(r.fields&&r.fields.dispatchDate)].filter(Boolean).join(' · ')));
    data.appendChild(make('p',null,(r.files||[]).length+' '+t('fileCount')+' · '+(r.complaints||[]).length+' '+t('complaintCount')));
    row.appendChild(data);row.appendChild(button(t('edit'),()=>openRecord(r.id)));list.appendChild(row)});
 }
 search.addEventListener('input',()=>{state.search=search.value;updateRows()});updateRows();
}
async function loadList(reset){if(state.loading)return;state.loading=true;const serial=++state.serial;if(reset){state.records=[];state.continuation=null}if(state.view==='list')status(t('loading'),false);
 try{const result=await request('GET',{action:'list',...(reset?{}:state.continuation?{continuation:state.continuation}:{})});
  if(serial!==state.serial)return;
  const merged=new Map([...state.records,...result.records].map(x=>[x.id,x]));
  state.records=[...merged.values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  state.continuation=result.continuation||null;
  if(state.view==='list'&&active())showList();
 }catch(e){if(state.view==='list')status(e.message,true)}finally{state.loading=false}}
function labelField(grid,key,kind,value){const label=make('label',key==='contents'||key==='loadSecuring'||key==='remarks'?'eh1903-wide':'',t(key));
 const el=make(kind==='textarea'?'textarea':'input');el.setAttribute('data-evidence-field',key);
 if(kind!=='textarea')el.type=kind;if(key==='colli'||key==='weightKg'){el.min='0';el.step=key==='colli'?'1':'0.001';}
 el.value=value==null?'':value;label.appendChild(el);grid.appendChild(label);return el}
function readFields(app){const values={};app.querySelectorAll('[data-evidence-field]').forEach(el=>values[el.getAttribute('data-evidence-field')]=String(el.value||'').trim());return values}
async function write(action,extra){if(state.busy)return null;state.busy=true;status(t('saving'),false);
 try{const payload={action,...extra};if(state.record&&state.record.id){payload.id=state.record.id;payload.expectedRevision=state.record.revision}
  const result=await request('POST',payload);state.record=result.record;
  showForm(state.record);status(action==='create'?t('created'):action==='upload'?t('uploaded'):t('saved'),false);return result;
 }catch(e){status(e.message,true);return null}finally{state.busy=false}}
function showForm(record){state.view='form';if(record!==undefined)state.record=record;const app=initPage();if(!app)return;
 const r=state.record||null;app.appendChild(hero(t('title'),t('independent')));
 const actions=make('div','eh1903-actions');actions.appendChild(button(t('back'),()=>{showList();loadList(true)}));app.appendChild(actions);
 if(r)app.appendChild(make('p','eh1903-muted',t('docId')+': '+r.id));
 const card=make('section','eh1903-panel');card.appendChild(make('h2',null,t('edit')));
 card.appendChild(make('p','eh1903-muted',t('required')));
 const now=new Date(),today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
 const grid=make('div','eh1903-grid'),defaults={dispatchDate:today};
 FIELDS.forEach(([key,kind])=>labelField(grid,key,kind,r&&r.fields&&r.fields[key]||defaults[key]||''));
 card.appendChild(grid);
 const act=make('div','eh1903-actions');act.appendChild(button(t('save'),async()=>{
  const current=readFields(app);if(!current.customer||!current.shipmentNumber||!current.dispatchDate){status(t('required'),true);return}
  await write(r?'save':'create',{fields:current});
 },true));card.appendChild(act);
 app.appendChild(card);app.appendChild(uploadsPanel(r));app.appendChild(complaintsPanel(r));app.appendChild(historyPanel(r));
 const note=make('p','eh1903-status');note.setAttribute('data-eh1903-status','');note.setAttribute('aria-live','polite');app.appendChild(note);
}
function uploadsPanel(record){const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('files')));panel.appendChild(make('p','eh1903-muted',t('info')));
 const grid=make('div','eh1903-uploads');
 for(const [kind,key,accept] of [['foto','uploadPhotos','image/jpeg,image/png'],['lieferschein','uploadNotes','application/pdf,image/jpeg,image/png']]){
  const cell=make('div','eh1903-upload'),label=make('label',null,t(key)),input=make('input');input.type='file';input.accept=accept;input.multiple=true;input.disabled=!record;input.addEventListener('change',async()=>{const selected=[...input.files];input.value='';if(!state.record){status(t('uploadFirst'),true);return}
   for(const file of selected){if(file.size>15*1024*1024){status(file.name+' · 15 MB',true);continue}
    try{status(t('uploading'),false);const base64=await asBase64(file);const uploaded=await write('upload',{kind,fileName:file.name,base64});if(!uploaded)break}
    catch(e){status(e.message,true);break}}
  });label.appendChild(input);cell.appendChild(label);grid.appendChild(cell)}
 panel.appendChild(grid);
 if(!record){panel.appendChild(make('p','eh1903-muted',t('uploadFirst')));return panel}
 (record.files||[]).forEach(file=>{const row=make('div','eh1903-file');row.appendChild(make('span',null,file.name));
 row.appendChild(button(t('preview'),()=>preview(record.id,file)));panel.appendChild(row)});
 return panel}
function asBase64(file){return file.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let out='';for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(out)})}
async function preview(id,file){const currentRoot=root();if(!currentRoot)return;status(t('loading'),false);
 try{const blob=await fileRequest(id,file),url=URL.createObjectURL(blob);
  const overlay=make('div','eh1903-dialog'),inner=make('div','eh1903-dialog-inner'),actions=make('div','eh1903-actions');
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',t('preview'));
  const close=()=>{URL.revokeObjectURL(url);overlay.remove()};
  actions.appendChild(button(t('download'),()=>{const a=make('a');a.href=url;a.download=file.name;a.click()}));
  actions.appendChild(button(t('close'),close,true));inner.appendChild(actions);
  const media=make(file.mime==='application/pdf'?'iframe':'img');media.src=url;if(media.tagName==='IMG')media.alt=file.name;else media.title=file.name;
  inner.appendChild(media);overlay.appendChild(inner);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});currentRoot.appendChild(overlay);
  actions.querySelector('button:last-child').focus();const onKey=e=>{if(e.key==='Escape'){close();d.removeEventListener('keydown',onKey)}};d.addEventListener('keydown',onKey);
  status('',false);
 }catch(e){status(e.message,true)}}
function complaintsPanel(record){const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('complaints')));
 if(!record){panel.appendChild(make('p','eh1903-muted',t('uploadFirst')));return panel}
 const complaints=record.complaints||[];
 if(!complaints.length)panel.appendChild(make('p','eh1903-muted',t('noComplaints')));
 complaints.slice().reverse().forEach(c=>{const card=make('div','eh1903-complaint');card.appendChild(make('b',null,dateText(c.reportedDate)+' · '+(c.createdBy||'')));
 card.appendChild(make('p',null,c.text));const select=make('select');select.setAttribute('aria-label',t('state'));
 for(const s of ['offen','in_pruefung','abgeschlossen']){const option=make('option',null,t(s));option.value=s;option.selected=c.state===s;select.appendChild(option)}
 select.addEventListener('change',async()=>{await write('complaint-status',{complaintId:c.id,state:select.value})});card.appendChild(select);panel.appendChild(card)});
 const form=make('div','eh1903-complaint-new');form.appendChild(make('h3',null,t('complaintText')));
 const date=make('input');date.type='date';date.value=new Date().toISOString().slice(0,10);date.setAttribute('aria-label',t('complaintDate'));form.appendChild(date);
 const text=make('textarea');text.placeholder=t('complaintText');text.setAttribute('aria-label',t('complaintText'));form.appendChild(text);
 const acts=make('div','eh1903-actions');acts.appendChild(button(t('addComplaint'),()=>{if(!text.value.trim()){status(t('complaintText'),true);return}write('complaint',{text:text.value,reportedDate:date.value})},true));form.appendChild(acts);
 panel.appendChild(form);return panel}
function historyPanel(record){const panel=make('section','eh1903-panel');panel.appendChild(make('h2',null,t('history')));
 if(record)(record.history||[]).slice(-25).reverse().forEach(x=>panel.appendChild(make('p','eh1903-muted',dateText(x.at)+' · '+x.by+' · '+x.action)));
 return panel}
async function openRecord(id){state.serial++;state.view='form';state.record=null;const app=initPage();if(!app)return;app.appendChild(hero(t('title'),t('loading')));
 try{const res=await request('GET',{action:'get',id});if(state.view==='form'&&active())showForm(res.record)}
 catch(e){app.appendChild(make('p','eh1903-status',e.message));app.appendChild(button(t('back'),()=>showList()))}}
function open(){const app=host();if(!app)return false;state.serial++;state.view='list';state.record=null;showList();loadList(true);try{if(w.ExportHUBMobileMenu&&w.ExportHUBMobileMenu.isOpen())w.ExportHUBMobileMenu.close()}catch(_){}return true}
function ensureNav(){const nav=d.getElementById('nav');if(!nav)return;
 let node=nav.querySelector('[data-exporthub-evidence-nav]');if(!node){node=make('button');node.type='button';node.setAttribute('data-exporthub-evidence-nav','');node.setAttribute('data-menu-accent','#4c7cce');node.style.setProperty('--menu-accent','#4c7cce');
 const existing=nav.querySelector('[data-exporthub-urgent-nav]')||nav.querySelector('[data-pack-notifications-nav]')||nav.querySelector('button');
 node.className=(existing&&existing.className||'').replace(/active|is-active|pack-notification-nav-entry|urgent-orders-nav-entry/g,'').trim();
 const icon=make('span','index308-nav-icon');icon.textContent='▣';const label=make('span','index308-nav-label');label.textContent=t('menu');
 node.appendChild(icon);node.appendChild(label);
 if(existing&&existing.parentNode===nav)nav.insertBefore(node,existing.nextSibling);else nav.appendChild(node);
 }else{const label=node.querySelector('.index308-nav-label');if(label)label.textContent=t('menu')}
 if(active())node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
}
d.addEventListener('click',function(e){const target=e.target&&e.target.closest&&e.target.closest('[data-exporthub-evidence-nav]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();open()},true);
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ensureNav,{once:true});else ensureNav();
function repair(){ensureNav();if(active()&&!root()&&!state.busy){if(state.view==='form')showForm(state.record);else showList()}}
if(w.addEventListener)['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(event=>w.addEventListener(event,repair));
if(w.setInterval)w.setInterval(()=>{if(!d.hidden&&!d.querySelector('[data-exporthub-evidence-nav]'))ensureNav()},1800);
w.ExportHUBStandaloneEvidence=Object.freeze({open,ensureNav,version:'RC1903'});
})(window,document);