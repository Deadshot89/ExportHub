// ExportHUB RC1092 – gespeicherte Personen und Mail-Zuordnung im Kundenordner bewusst trennen.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1092_CUSTOMER_MAIL_CONTACTS__)return;
w.__EXPORTHUB_RC1092_CUSTOMER_MAIL_CONTACTS__=true;

var installTimer=0;

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||w.state||{}}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function customerFolderVisible(){var v=view();return v==='customerfolder'||v==='customers'||v==='customer'||v==='kundenordner'||v==='kunden'}
function customerId(c){return q(c&&(c.id||c.customerId||c.account||c.customerNumber||c.kundennummer||c.name||c.customerName)).toLocaleUpperCase('de-DE')}
function customers(){return arr(state().customers)}
function currentCustomer(){
 var s=state(),direct=s.currentCustomer||s.selectedCustomer||null,key=q(s.currentCustomerId||s.selectedCustomerId||s.customerFolderId||s.customerFolderOpenId||(direct&&customerId(direct))).toLocaleUpperCase('de-DE');
 if(!key)return direct&&obj(direct)?direct:null;
 return customers().find(function(c){return c&&(customerId(c)===key||q(c.id||c.customerId).toLocaleUpperCase('de-DE')===key||q(c.account||c.customerNumber).toLocaleUpperCase('de-DE')===key)})||(direct&&obj(direct)?direct:null)
}
function emailItems(value){
 var out=[],seen={};
 function ingest(v){
  if(Array.isArray(v)){v.forEach(ingest);return}
  if(obj(v)){ingest(v.email||v.mail||v.address);return}
  String(v==null?'':v).replace(/mailto:/gi,' ').split(/[;,\n\r\t ]+/).forEach(function(x){
   var m=String(x||'').match(/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i);if(!m)return;
   var e=q(m[0]).replace(/[.,;:]+$/,''),k=low(e);if(e&&!seen[k]){seen[k]=1;out.push(e)}
  })
 }
 ingest(value);return out
}
function mergeEmails(){var out=[],seen={};Array.prototype.slice.call(arguments).forEach(function(v){emailItems(v).forEach(function(e){var k=low(e);if(!seen[k]){seen[k]=1;out.push(e)}})});return out}
function role(v){return low(v)==='sales'?'sales':'cc'}
function contact(name,email,r){
 var valid=emailItems(email)[0]||'';return{name:q(name).replace(/\s+/g,' ').slice(0,120),email:valid,role:role(r)}
}
function contactId(email){return'CONTACT-'+low(email).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)}
function addUnique(out,seen,c,r){
 c=contact(c&&c.name,c&&c.email,r||c&&c.role);if(!c.email)return;
 var k=low(c.email),old=seen[k];if(old){if(!old.name&&c.name)old.name=c.name;if(old.roles.indexOf(c.role)<0)old.roles.push(c.role);return}
 var row={id:contactId(c.email),name:c.name,email:c.email,roles:[c.role]};seen[k]=row;out.push(row)
}
function directory(filterRole){
 var root=state(),out=[],seen={};
 arr(root.customerContactDirectory).forEach(function(x){
  var roles=arr(x&&x.roles);if(!roles.length)roles=[x&&x.role||'cc'];roles.forEach(function(r){addUnique(out,seen,x,r)})
 });
 customers().forEach(function(c){
  arr(c&&c.customerContactDirectory).concat(arr(c&&c.contactDirectory)).forEach(function(x){
   var roles=arr(x&&x.roles);if(!roles.length)roles=[x&&x.role||'cc'];roles.forEach(function(r){addUnique(out,seen,x,r)})
  });
  var salesName=q(c&&c.salesPersonName||c&&c.salesContactName||c&&c.salesName||c&&c.salesPerson);
  emailItems(c&&[c.salesMail,c.salesEmail,c.salesPersonMail,c.salesPersonEmail,c.salesContactMail,c.salesContactEmail,c.rc385SalesMail,c.salesCc]).forEach(function(e){addUnique(out,seen,{name:salesName,email:e},'sales')});
  arr(c&&c.salesContacts).concat(arr(c&&c.customerSalesContacts)).forEach(function(x){addUnique(out,seen,x,'sales')});
  arr(c&&c.ccContacts).concat(arr(c&&c.customerCcContacts)).forEach(function(x){addUnique(out,seen,x,'cc')})
 });
 out.sort(function(a,b){return low(a.name||a.email).localeCompare(low(b.name||b.email),'de')});
 return filterRole?out.filter(function(x){return x.roles.indexOf(role(filterRole))>=0}):out
}
function nameForEmail(email,r){var hit=directory(r).find(function(x){return low(x.email)===low(email)});return q(hit&&hit.name)}
function mailContacts(c,r){
 r=role(r);var out=[],seen={};
 function add(x){var row=contact(x&&x.name,x&&x.email,r);if(!row.email)return;var k=low(row.email);if(seen[k]){if(!seen[k].name&&row.name)seen[k].name=row.name;return}seen[k]=row;out.push(row)}
 if(r==='sales'){
  arr(c&&c.salesContacts).concat(arr(c&&c.customerSalesContacts)).forEach(add);
  var salesName=q(c&&c.salesPersonName||c&&c.salesContactName||c&&c.salesName||c&&c.salesPerson);
  emailItems(c&&[c.salesMail,c.salesEmail,c.salesPersonMail,c.salesPersonEmail,c.salesContactMail,c.salesContactEmail,c.rc385SalesMail,c.salesCc]).forEach(function(e){add({name:salesName||nameForEmail(e,'sales'),email:e})})
 }else{
  arr(c&&c.ccContacts).concat(arr(c&&c.customerCcContacts)).forEach(add);
  emailItems(c&&[c.cc,c.mailCc,c.rc385Cc]).forEach(function(e){add({name:nameForEmail(e,'cc'),email:e})})
 }
 return out
}
function writeMailContacts(c,r,list){
 r=role(r);list=arr(list).map(function(x){return contact(x&&x.name,x&&x.email,r)}).filter(function(x){return x.email});
 var emails=mergeEmails(list.map(function(x){return x.email})).join('; ');
 if(r==='sales'){
  c.salesContacts=clone(list);c.customerSalesContacts=clone(list);
  c.salesMail=emails;c.salesEmail=emails;c.salesPersonMail=emails;c.salesPersonEmail=emails;c.salesContactMail=emails;c.salesContactEmail=emails;c.rc385SalesMail=emails;c.salesCc=emails;
  c.salesPersonName=q(list[0]&&list[0].name);c.salesContactName=c.salesPersonName;c.salesName=c.salesPersonName
 }else{
  c.ccContacts=clone(list);c.customerCcContacts=clone(list);c.cc=emails;c.mailCc=emails;c.rc385Cc=emails
 }
 c.updatedAt=new Date().toISOString();
 return list
}
function librarySnapshot(){return clone(arr(state().customerContactDirectory))}
function restoreLibrary(snapshot){state().customerContactDirectory=clone(arr(snapshot))}
function upsertLibrary(name,email,r){
 var root=state(),row=contact(name,email,r);if(!row.name)throw new Error('Bitte einen Namen eingeben.');if(!row.email)throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
 root.customerContactDirectory=arr(root.customerContactDirectory);
 var hit=root.customerContactDirectory.find(function(x){return low(x&&x.email)===low(row.email)}),now=new Date().toISOString();
 if(!hit){hit={id:contactId(row.email),name:row.name,email:row.email,roles:[row.role],createdAt:now};root.customerContactDirectory.push(hit)}
 else{hit.id=q(hit.id)||contactId(row.email);hit.name=row.name;hit.email=row.email;hit.roles=arr(hit.roles);if(hit.roles.indexOf(row.role)<0)hit.roles.push(row.role);hit.updatedAt=now}
 return clone(hit)
}
async function persist(reason){
 var clean=w.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error('Die Azure-Speicherung ist noch nicht verfügbar.');
 await Promise.resolve(clean.queueSave(reason));var ok=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));
 if(ok!==true)throw new Error('Die Azure-Speicherung wurde nicht bestätigt.');
 return true
}
async function savePerson(r,name,email){
 r=role(r);var before=librarySnapshot(),saved;
 try{saved=upsertLibrary(name,email,r);await persist((r==='sales'?'Sales Person':'CC-Kontakt')+' dauerhaft gespeichert');try{w.dispatchEvent(new CustomEvent('exporthub:customer-contact-library-updated',{detail:{role:r,email:saved.email}}))}catch(_){}return saved}
 catch(e){restoreLibrary(before);throw e}
}
function customerFieldsSnapshot(c){var keys=['salesContacts','customerSalesContacts','salesMail','salesEmail','salesPersonMail','salesPersonEmail','salesContactMail','salesContactEmail','rc385SalesMail','salesCc','salesPersonName','salesContactName','salesName','ccContacts','customerCcContacts','cc','mailCc','rc385Cc','updatedAt'],out={};keys.forEach(function(k){out[k]=clone(c&&c[k])});return out}
function restoreCustomerFields(c,snap){Object.keys(snap||{}).forEach(function(k){if(snap[k]===undefined)delete c[k];else c[k]=clone(snap[k])})}
async function addToMail(r,name,email){
 r=role(r);var c=currentCustomer();if(!c)throw new Error('Bitte zuerst einen Kunden im Kundenordner öffnen.');
 var row=contact(name,email,r);if(!row.email)throw new Error('Bitte eine gültige E-Mail-Adresse auswählen oder eingeben.');if(!row.name)row.name=nameForEmail(row.email,r);
 var before=customerFieldsSnapshot(c),list=mailContacts(c,r),exists=list.some(function(x){return low(x.email)===low(row.email)});
 if(!exists)list.push(row);else list=list.map(function(x){return low(x.email)===low(row.email)&&row.name?row:x});
 try{writeMailContacts(c,r,list);syncLegacyFields(c);await persist((r==='sales'?'Sales Person':'CC-Kontakt')+' zur Kundenmail hinzugefügt');try{w.dispatchEvent(new CustomEvent('exporthub:customer-mail-contacts-updated',{detail:{customerId:customerId(c),role:r,email:row.email}}))}catch(_){}return row}
 catch(e){restoreCustomerFields(c,before);syncLegacyFields(c);throw e}
}
async function removeFromMail(r,email){
 r=role(r);var c=currentCustomer();if(!c)throw new Error('Kunde nicht gefunden.');var before=customerFieldsSnapshot(c),list=mailContacts(c,r).filter(function(x){return low(x.email)!==low(email)});
 try{writeMailContacts(c,r,list);syncLegacyFields(c);await persist((r==='sales'?'Sales Person':'CC-Kontakt')+' aus Kundenmail entfernt');try{w.dispatchEvent(new CustomEvent('exporthub:customer-mail-contacts-updated',{detail:{customerId:customerId(c),role:r,email:q(email),removed:true}}))}catch(_){}return true}
 catch(e){restoreCustomerFields(c,before);syncLegacyFields(c);throw e}
}
function syncLegacyFields(c){
 if(!c)return;
 var sales=mailContacts(c,'sales'),cc=mailContacts(c,'cc'),salesEmails=mergeEmails(sales.map(function(x){return x.email})).join('; '),ccEmails=mergeEmails(cc.map(function(x){return x.email})).join('; ');
 var salesField=d.getElementById('rc405FSalesMail')||d.getElementById('rc409FolderSalesMail')||d.getElementById('customerFolderSalesMail');
 var ccField=d.getElementById('rc405FCc')||d.getElementById('rc409FolderCc')||d.getElementById('customerFolderMailCc');
 var legacyName=d.getElementById('rc819SalesPersonName');
 if(salesField)salesField.value=salesEmails;if(ccField)ccField.value=ccEmails;if(legacyName)legacyName.value=q(sales[0]&&sales[0].name);
 return true
}
function optionHtml(r){return '<option value="">— Person auswählen —</option>'+directory(r).map(function(x){return'<option value="'+esc(x.email)+'" data-contact-name="'+esc(x.name)+'">'+esc(x.name||x.email)+' · '+esc(x.email)+'</option>'}).join('')}
function chipHtml(x,r){return'<span class="rc1092-mail-chip" data-rc1092-role="'+esc(r)+'" data-rc1092-email="'+esc(x.email)+'"><span><b>'+esc(x.name||x.email)+'</b>'+(x.name?'<small>'+esc(x.email)+'</small>':'')+'</span><button type="button" class="ghost" data-rc1092-remove="'+esc(r)+'" data-email="'+esc(x.email)+'" title="Nur aus der Mail entfernen">×</button></span>'}
function setStatus(r,text,kind){var el=d.querySelector('[data-rc1092-status="'+role(r)+'"]');if(!el)return;el.textContent=text||'';el.setAttribute('data-kind',kind||'info')}
function ensureStyle(){
 if(d.getElementById('rc1092CustomerContactsStyle'))return;
 var s=d.createElement('style');s.id='rc1092CustomerContactsStyle';
 s.textContent='.rc1092-contact-manager{margin-top:14px}.rc1092-contact-intro{padding:10px 12px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.45}.rc1092-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:12px}.rc1092-contact-card{border:1px solid #dbe4ec;border-radius:14px;padding:13px;background:var(--card,#fff);display:grid;gap:10px}.rc1092-contact-card h5{margin:0}.rc1092-draft-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:9px}.rc1092-actions{display:flex;gap:8px;flex-wrap:wrap}.rc1092-actions button{flex:1 1 150px}.rc1092-mail-list{display:flex;gap:7px;flex-wrap:wrap;min-height:30px}.rc1092-mail-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 8px 7px 10px;border:1px solid #cbd5e1;border-radius:999px;background:#f8fafc;max-width:100%}.rc1092-mail-chip span{min-width:0}.rc1092-mail-chip b,.rc1092-mail-chip small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}.rc1092-mail-chip small{font-size:10px;color:#64748b}.rc1092-mail-chip button{min-height:28px!important;width:28px!important;padding:0!important;border-radius:50%!important}.rc1092-current-label{font-size:11px;font-weight:900;color:#475569;text-transform:uppercase;letter-spacing:.04em}.rc1092-status{min-height:18px;font-size:12px}.rc1092-status[data-kind="ok"]{color:#166534}.rc1092-status[data-kind="error"]{color:#b91c1c}.rc1092-status[data-kind="info"]{color:#475569}.rc1092-legacy-contact-fields{display:none!important}@media(max-width:760px){.rc1092-contact-grid,.rc1092-draft-grid{grid-template-columns:1fr}.rc1092-actions button{width:100%}}';
 (d.head||d.documentElement).appendChild(s)
}
function preserveLegacyFields(host){
 var compat=d.getElementById('rc1092LegacyContactFields');
 if(!compat){compat=d.createElement('div');compat.id='rc1092LegacyContactFields';compat.className='rc1092-legacy-contact-fields';if(host.parentNode)host.parentNode.insertBefore(compat,host.nextSibling)}
 var sales=d.getElementById('rc405FSalesMail')||d.getElementById('rc409FolderSalesMail')||d.getElementById('customerFolderSalesMail'),cc=d.getElementById('rc405FCc')||d.getElementById('rc409FolderCc')||d.getElementById('customerFolderMailCc');
 [sales,cc].forEach(function(input){var label=input&&input.closest&&input.closest('label.field');if(label&&label.parentElement!==compat)compat.appendChild(label)});
 var legacy=d.getElementById('rc819SalesPersonName');if(!legacy){legacy=d.createElement('input');legacy.type='hidden';legacy.id='rc819SalesPersonName';compat.appendChild(legacy)}
 return compat
}
function fillDraft(r){
 r=role(r);var select=d.querySelector('[data-rc1092-select="'+r+'"]'),name=d.querySelector('[data-rc1092-name="'+r+'"]'),email=d.querySelector('[data-rc1092-email="'+r+'"]');
 if(!select||!select.value)return false;var opt=select.options[select.selectedIndex];if(name)name.value=q(opt&&opt.getAttribute('data-contact-name'));if(email)email.value=q(select.value);return true
}
function draftContact(r){r=role(r);return contact((d.querySelector('[data-rc1092-name="'+r+'"]')||{}).value,(d.querySelector('[data-rc1092-email="'+r+'"]')||{}).value,r)}
function refreshManager(c){
 var salesSelect=d.querySelector('[data-rc1092-select="sales"]'),ccSelect=d.querySelector('[data-rc1092-select="cc"]');
 if(salesSelect){var html=optionHtml('sales');if(salesSelect.innerHTML!==html)salesSelect.innerHTML=html}
 if(ccSelect){var html2=optionHtml('cc');if(ccSelect.innerHTML!==html2)ccSelect.innerHTML=html2}
 var salesBox=d.getElementById('rc1092SalesMailContacts'),ccBox=d.getElementById('rc819CcContactChips'),sales=mailContacts(c,'sales'),cc=mailContacts(c,'cc');
 if(salesBox){var sh=sales.length?sales.map(function(x){return chipHtml(x,'sales')}).join(''):'<span class="muted">Noch keine Sales-Person zur Mail hinzugefügt.</span>';if(salesBox.innerHTML!==sh)salesBox.innerHTML=sh}
 if(ccBox){var ch=cc.length?cc.map(function(x){return chipHtml(x,'cc')}).join(''):'<span class="muted">Noch kein CC-Kontakt zur Mail hinzugefügt.</span>';if(ccBox.innerHTML!==ch)ccBox.innerHTML=ch}
 syncLegacyFields(c);return true
}
function managerHtml(){
 return '<div class="rc819-contact-head"><div><h4>Gespeicherte Sales- &amp; CC-Kontakte</h4><p>Kontakte und Mail-Empfänger werden jetzt getrennt verwaltet.</p></div></div><div class="rc1092-contact-intro"><b>Person speichern</b> legt den Kontakt dauerhaft in der Kontaktbibliothek ab. <b>Zur Mail hinzufügen</b> entscheidet separat, welche Person bei diesem Kunden in CC aufgenommen wird. Ein gespeicherter Kontakt wird nicht allein durch die Auswahl zur Mail hinzugefügt.</div><div class="rc1092-contact-grid">'+cardHtml('sales','Sales Personen')+cardHtml('cc','CC-Kontakte')+'</div>'
}
function cardHtml(r,title){
 return '<section class="rc1092-contact-card" data-rc1092-card="'+r+'"><h5>'+title+'</h5><label class="field">Gespeicherte Person<select data-rc1092-select="'+r+'"></select></label><div class="rc1092-draft-grid"><label class="field">Name<input data-rc1092-name="'+r+'" autocomplete="off" placeholder="Name"></label><label class="field">E-Mail<input data-rc1092-email="'+r+'" type="email" autocomplete="off" placeholder="name@firma.de"></label></div><div class="rc1092-actions"><button type="button" class="ghost" data-rc1092-save="'+r+'">Person speichern</button><button type="button" class="btn" data-rc1092-add="'+r+'">Zur Mail hinzufügen</button></div><div class="rc1092-status" data-rc1092-status="'+r+'"></div><div class="rc1092-current-label">Dieser Kunden-Mail hinzugefügt</div><div class="rc1092-mail-list" '+(r==='sales'?'id="rc1092SalesMailContacts"':'id="rc819CcContactChips"')+'></div></section>'
}
async function run(button,r,mode){
 var row=draftContact(r);if(!row.name){setStatus(r,'Bitte zuerst Name und E-Mail auswählen oder eingeben.','error');return false}if(!row.email){setStatus(r,'Bitte eine gültige E-Mail-Adresse eingeben.','error');return false}
 button.disabled=true;setStatus(r,mode==='save'?'Person wird dauerhaft gespeichert …':'Person wird zur Mail hinzugefügt …','info');
 try{
  if(mode==='save'){await savePerson(r,row.name,row.email);setStatus(r,'Person dauerhaft gespeichert. Noch nicht automatisch zur Mail hinzugefügt.','ok')}
  else{await addToMail(r,row.name,row.email);setStatus(r,'Person wurde zur Mail dieses Kunden hinzugefügt und dauerhaft gespeichert.','ok')}
  refreshManager(currentCustomer());return false
 }catch(e){setStatus(r,'Speichern fehlgeschlagen: '+q(e&&e.message||e),'error');return false}
 finally{button.disabled=false}
}
function bind(host){
 if(host.getAttribute('data-rc1092-bound')==='1')return;host.setAttribute('data-rc1092-bound','1');
 host.addEventListener('change',function(ev){var sel=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1092-select]');if(sel)fillDraft(sel.getAttribute('data-rc1092-select'))});
 host.addEventListener('click',function(ev){
  var save=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1092-save]');if(save){ev.preventDefault();run(save,save.getAttribute('data-rc1092-save'),'save');return}
  var add=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1092-add]');if(add){ev.preventDefault();run(add,add.getAttribute('data-rc1092-add'),'add');return}
  var remove=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1092-remove]');if(remove){ev.preventDefault();var r=remove.getAttribute('data-rc1092-remove'),email=remove.getAttribute('data-email');remove.disabled=true;setStatus(r,'Kontakt wird aus der Mail entfernt …','info');removeFromMail(r,email).then(function(){setStatus(r,'Aus der Mail entfernt. Die Person bleibt gespeichert.','ok');refreshManager(currentCustomer())}).catch(function(e){setStatus(r,'Entfernen fehlgeschlagen: '+q(e&&e.message||e),'error')}).finally(function(){remove.disabled=false})}
 })
}
function install(){
 if(!customerFolderVisible())return false;var host=d.getElementById('rc819ReusableContacts'),c=currentCustomer();if(!host||!c)return false;
 var key=customerId(c);ensureStyle();
 if(host.getAttribute('data-rc1092-customer-key')!==key||!host.querySelector('[data-rc1092-card]')){
  preserveLegacyFields(host);host.classList.add('rc1092-contact-manager');host.innerHTML=managerHtml();host.setAttribute('data-rc1092-customer-key',key);bind(host)
 }
 refreshManager(c);return true
}
function schedule(){
 if(installTimer)return;installTimer=w.setTimeout(function(){installTimer=0;try{install()}catch(e){try{console.warn('RC1092 Kundenkontakte',e)}catch(_){}}},0)
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){schedule();w.setTimeout(schedule,180);w.setTimeout(schedule,700)},{once:true});else{schedule();w.setTimeout(schedule,180);w.setTimeout(schedule,700)}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:sync'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
if(w.MutationObserver){try{var mo=new MutationObserver(function(){if(customerFolderVisible())schedule()});mo.observe(d.documentElement,{childList:true,subtree:true})}catch(_){}}

w.ExportHUBRC1092CustomerContacts=Object.freeze({version:'RC1092',directory:directory,mailContacts:mailContacts,savePerson:savePerson,addToMail:addToMail,removeFromMail:removeFromMail,install:install});
})(window,document);
