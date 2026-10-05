import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Catch a regression to server mail, missing Outlook fields, or a false sent history.
function setup({hostname='www.exporthub360.de',launchFails=false}={}){
 const launches=[],calls=[],events={},saved=[];
 const sh={id:'S1',reference:'ABC123',customerId:'SE1',customerName:'Essentra Sweden',customerAvisToken:'abc',customerAvisUrl:'https://www.exporthub360.de/avis/abc',avisFirstMailSentAt:'2026-09-01T10:00:00Z'};
 const state={shipment:{id:'OTHER',reference:'OTHER1'},shipments:[sh],savedShipments:[{...sh}],customers:[{id:'SE1',name:'Essentra Sweden',salesContacts:[{email:'sales@example.com'}],ccContacts:[{email:'copy@example.com'},{email:'SALES@example.com'},{email:'customer@example.com'}]}],currentUser:{name:'Tobias'}};
 const document={readyState:'loading',addEventListener(name,fn){(events[name]||=[]).push(fn)},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(tag){
  const attrs={};return{tagName:tag.toUpperCase(),style:{},setAttribute(k,v){attrs[k]=v},getAttribute(k){return k==='href'?this.href||'':attrs[k]||''},hasAttribute(k){return k in attrs},closest(selector){if(selector.includes('data-rc1166-mail-draft'))return this.hasAttribute('data-rc1166-mail-draft')||this.hasAttribute('data-rc1166-avis-reminder')?this:null;return this},remove(){},click(){
   if(launchFails)throw new Error('Mail handler blocked');
   for(const fn of events.click||[])fn({target:this,preventDefault(){},stopImmediatePropagation(){}});
   launches.push(this.href);
  }};
 },body:{appendChild(){},getAttribute(){return''}},head:{appendChild(){}},documentElement:{appendChild(){}}};
 const de=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
 const sandbox={document,URL,console,Date,Intl,Map,Set,Promise,clearTimeout(){},setInterval(){},setTimeout(){return 1},location:{hostname,href:'https://'+hostname+'/'},addEventListener(){},dispatchEvent(){},CustomEvent:class{},__EXPORTHUB_GET_STATE__:()=>state,ExportHUBI18n:{t:(k)=>de[k]||k},fetch(...args){calls.push(args);throw new Error('Server mail must not be used')},ExportHUBClean:{queueSave(reason){saved.push(reason)}}};
 sandbox.window=sandbox;
 for(const file of ['assets/rc1065-registration-cc.js','assets/rc1071-shipment-history.js','assets/rc1166-avis-reminder-overview.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
 return{api:sandbox.ExportHUBRC1166AvisReminder,sh,state,launches,calls,saved,events,document};
}

test('reminder opens a complete Outlook draft without Graph credentials and records opening on the correct shipment',async()=>{
 const {api,sh,state,launches,calls,saved}=setup();
 await api.sendReminder(sh,'customer@example.com','customer','en',sh.customerAvisUrl,'reminder');
 assert.equal(launches.length,1);
 const url=new URL(launches[0]);
 assert.equal(url.protocol,'mailto:');
 assert.equal(decodeURIComponent(url.pathname),'customer@example.com');
 assert.equal(url.searchParams.get('subject'),'Reminder – shipment notice ABC123');
 assert.ok(url.searchParams.get('body').includes('https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc&lang=en'));
 assert.deepEqual(url.searchParams.get('cc').split(';').map(x=>x.toLowerCase()).sort(),['tobiaslimberg@essentra.com','sales@example.com','copy@example.com','sevastianmarcu@essentra.com','danielollmann@essentra.com'].sort());
 assert.equal(calls.length,0);
 assert.equal(state.shipment.shipmentHistory,undefined,'overview must not log on another currently edited shipment');
 for(const copy of [sh,state.savedShipments[0]]){
  assert.equal(copy.shipmentHistory.length,1);
  assert.equal(copy.shipmentHistory[0].type,'mail-open');
  assert.equal(copy.shipmentHistory[0].details.mailType,'avis-reminder-draft');
  assert.equal(copy.shipmentHistory[0].actor.name,'Tobias');
  assert.equal(copy.mailSent,undefined);
 }
 assert.ok(saved.length>0);
});

test('all six languages keep mandatory registration CC',async()=>{
 for(const lang of ['de','en','pl','es','fr','it']){
  const {api,sh,launches}=setup();
  await api.sendReminder(sh,'customer@example.com','customer',lang,sh.customerAvisUrl,'reminder');
  const cc=new URL(launches[0]).searchParams.get('cc').toLowerCase().split(';');
  assert.ok(cc.includes('sevastianmarcu@essentra.com'),lang);
  assert.ok(cc.includes('danielollmann@essentra.com'),lang);
 }
});

test('Tobias as the primary recipient is not duplicated in reminder CC',async()=>{
 const {api,sh,launches}=setup();
 await api.sendReminder(sh,'TobiasLimberg@essentra.com','customer','de',sh.customerAvisUrl,'reminder');
 const draft=new URL(launches[0]);
 assert.equal(decodeURIComponent(draft.pathname),'TobiasLimberg@essentra.com');
 const cc=draft.searchParams.get('cc').toLowerCase().split(';');
 assert.ok(!cc.includes('tobiaslimberg@essentra.com'));
 assert.ok(cc.includes('sevastianmarcu@essentra.com'));
 assert.ok(cc.includes('danielollmann@essentra.com'));
});

test('matching current shipment copy receives the opening history',async()=>{
 const {api,sh,state}=setup();state.shipment={...sh};
 await api.sendReminder(sh,'customer@example.com','customer','de',sh.customerAvisUrl,'reminder');
 assert.equal(state.shipment.shipmentHistory?.length,1);
 assert.equal(state.shipment.shipmentHistory[0].type,'mail-open');
});

test('draft opening preserves unique existing history from every matching shipment copy',async()=>{
 const {api,sh,state}=setup();
 state.shipment={...sh,shipmentHistory:[{id:'EXISTING',type:'print',label:'Existing print',at:'2026-09-01T10:00:00Z',actor:{name:'Tobias'}}]};
 await api.sendReminder(sh,'customer@example.com','customer','de',sh.customerAvisUrl,'reminder');
 for(const copy of [sh,state.shipment,state.savedShipments[0]]){
  assert.ok(copy.shipmentHistory.some(e=>e.id==='EXISTING'));
  assert.equal(copy.shipmentHistory.filter(e=>e.type==='mail-open').length,1);
 }
});

test('opening the overview chooser alone never records delivery on the current shipment',()=>{
 const {state,events,document}=setup();
 const button=document.createElement('button');button.setAttribute('data-rc1166-avis-reminder','1');button.textContent='Avis-Erinnerung in Outlook öffnen';
 for(const fn of events.click||[])fn({target:button});
 assert.equal(state.shipment.shipmentHistory,undefined);
});

test('neighboring overview actions do not inherit the Outlook button as a mail action',()=>{
 const {state,events,document}=setup();
 const button=document.createElement('button');button.textContent='Sendung bearbeiten';
 const card={textContent:'ABC123 Avis-Erinnerung in Outlook öffnen',getAttribute(){return''}};
 button.closest=selector=>selector.includes('data-rc1166')?null:selector.includes('.card')?card:button;
 for(const fn of events.click||[])fn({target:button});
 assert.equal(state.shipment.shipmentHistory,undefined);
});

test('existing initial registration from the normal Outlook mail area enables the reminder',()=>{
 const {api,sh}=setup();delete sh.avisFirstMailSentAt;
 sh.mailHistory=[{type:'customer',status:'Versendet',sentAt:'2026-09-25T10:00:00Z',body:'Lieferavis: https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc'}];
 assert.equal(api.reminderGate(sh,'2026-09-30T10:00:00Z').mode,'reminder');
 assert.equal(api.reminderGate(sh,'2026-09-30T10:00:00Z').enabled,true);
 assert.equal(api.reminderGate(sh,'2026-09-28T10:00:00Z').reason,'waiting');
});

test('other customers keep branded links and TESTSERVICE remains isolated in the Outlook text',async()=>{
 for(const fixture of [{hostname:'www.exporthub360.de',customerName:'Hitachi',wanted:'https://www.exporthub360.de/avis/abc?lang=de'},{hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',customerName:'Essentra Sweden',wanted:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?token=abc&environment=testservice&lang=de'}]){
  const {api,sh,state,launches}=setup(fixture);sh.customerName=fixture.customerName;state.customers[0].name=fixture.customerName;
  await api.sendReminder(sh,'carrier@example.com','carrier','de',sh.customerAvisUrl,'reminder');
  assert.ok(new URL(launches[0]).searchParams.get('body').includes(fixture.wanted));
 }
});

test('initial Outlook draft enables the existing three business day reminder rule without claiming delivery',async()=>{
 const {api,sh,launches}=setup();delete sh.avisFirstMailSentAt;
 await api.sendReminder(sh,'customer@example.com','customer','de',sh.customerAvisUrl,'initial');
 assert.equal(new URL(launches[0]).searchParams.get('subject'),'Lieferavis ABC123');
 assert.ok(sh.avisInitialMailOpenedAt);
 assert.equal(sh.avisFirstMailSentAt,undefined);
 assert.equal(api.reminderGate(sh,sh.avisInitialMailOpenedAt).reason,'waiting');
 assert.equal(api.reminderGate(sh,'2030-01-01T10:00:00Z').mode,'reminder');
});

test('excluded recipient, recorded pickup and recent first mail never launch Outlook',async()=>{
 for(const fixture of [{mutate:()=>{},email:'dispo@holenstein.de',code:'AVIS_RECIPIENT_EXCLUDED'},{mutate:sh=>sh.customerAvisPickupDate='2026-10-06',email:'customer@example.com',code:'AVIS_DRAFT_NOT_READY'},{mutate:sh=>sh.avisFirstMailSentAt=new Date().toISOString(),email:'customer@example.com',code:'AVIS_DRAFT_NOT_READY'}]){
  const {api,sh,launches}=setup();fixture.mutate(sh);
  await assert.rejects(()=>api.sendReminder(sh,fixture.email,'customer','de',sh.customerAvisUrl,'reminder'),e=>e.code===fixture.code);
  assert.equal(launches.length,0);
  assert.equal(sh.shipmentHistory,undefined);
 }
});

test('failed Outlook launch never records a successful opening',async()=>{
 const {api,sh}=setup({launchFails:true});
 await assert.rejects(()=>api.sendReminder(sh,'customer@example.com','customer','de',sh.customerAvisUrl,'reminder'),/Mail handler blocked/);
 assert.equal(sh.shipmentHistory,undefined);
});
