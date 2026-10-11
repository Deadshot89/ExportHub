import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const DE={
  'avisReminder.button':'Abholerinnerung öffnen',
  'avisReminder.customer':'Kunde',
  'avisReminder.carrier':'Spedition',
  'avisReminder.missingCustomer':'Keine E-Mail-Adresse für Kunde hinterlegt',
  'avisReminder.missingCarrier':'Keine E-Mail-Adresse für Spedition hinterlegt'
};
const EN={
  'avisReminder.button':'Open pickup reminder',
  'avisReminder.customer':'Customer',
  'avisReminder.carrier':'Carrier',
  'avisReminder.missingCustomer':'No customer email address stored',
  'avisReminder.missingCarrier':'No carrier email address stored'
};

function element(tag='div'){
  const node={
    tagName:String(tag).toUpperCase(),className:'',textContent:'',children:[],attributes:{},style:{},dataset:{},disabled:false,parentNode:null,
    setAttribute(name,value){this.attributes[name]=String(value)},
    removeAttribute(name){delete this.attributes[name]},
    appendChild(child){child.parentNode=this;this.children.push(child);return child},
    insertBefore(child,before){child.parentNode=this;const index=this.children.indexOf(before);if(index<0)this.children.push(child);else this.children.splice(index,0,child);return child},
    addEventListener(name,fn){this['_on'+name]=fn},
    remove(){if(!this.parentNode)return;const i=this.parentNode.children.indexOf(this);if(i>=0)this.parentNode.children.splice(i,1);this.parentNode=null}
  };
  return node;
}

function load(legacyApi,translations=DE){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelector(){return null},
    querySelectorAll(){return[]},
    createElement(tag){return element(tag)},
    body:{getAttribute(){return''},appendChild(){}},
    head:{appendChild(){}},
    documentElement:{appendChild(){}}
  };
  const sandbox={
    document,
    location:{href:'https://example.test/'},
    setTimeout(){return 1},
    addEventListener(){},
    __EXPORTHUB_GET_STATE__(){return{}},
    ExportHUBI18n:{t(key){return translations[key]||key}},
    ExportHUBIndex236:legacyApi,
    console:{warn(){}},
    URL
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1166-avis-reminder-overview.js'});
  return sandbox.ExportHUBRC1166AvisReminder;
}

function card(){
  const root=element('article'),danger=element('div');danger.className='toolbar rc524-dangerbar';root.appendChild(danger);
  root.querySelector=function(selector){
    if(selector==='.rc524-dangerbar')return danger;
    if(selector==='.index236-reminder-actions')return this.children.find(x=>String(x.className).split(/\s+/).includes('index236-reminder-actions'))||null;
    return null;
  };
  return{root,danger};
}

test('RC1484: generische Abholerinnerung bleibt für jede offene Sendung verfügbar',()=>{
  const api=load();
  assert.equal(typeof api.genericReminderEligible,'function','RC1484 eligibility helper fehlt');
  assert.equal(api.genericReminderEligible({reference:'NO-DATE'}),true,'ohne Abholdatum muss die Erinnerung verfügbar bleiben');
  assert.equal(api.genericReminderEligible({reference:'FUTURE',plannedPickupDate:'2026-10-20'}),true,'auch vor dem Abholdatum muss die Erinnerung manuell verfügbar bleiben');
  assert.equal(api.genericReminderEligible({reference:'OVERDUE',plannedPickupDate:'2026-10-09'}),true,'überfällige Abholung muss die Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'PICKED',actualPickupAt:'2026-10-10T10:00:00Z'}),false,'bereits abgeholte Sendungen dürfen keine Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'PICKED-DATE',actualPickupDate:'2026-10-10'}),false,'historisches Feld actualPickupDate muss ebenfalls sperren');
  assert.equal(api.genericReminderEligible({reference:'DONE',status:'Abgeschlossen'}),false,'abgeschlossene Sendungen dürfen keine Erinnerung anbieten');
  assert.equal(api.genericReminderEligible({reference:'CANCELLED',status:'Storniert'}),false,'stornierte Sendungen dürfen keine Erinnerung anbieten');
});

test('RC1484: Sendung ohne Abholdatum erhält sichtbar vier Erinnerungsaktionen',()=>{
  const calls=[];
  const legacy={
    recipientState(_sh,target){return target==='customer'?{available:true,to:['kunde@example.com']}:{available:false,to:[]}},
    reminderMail(id,target,lang){calls.push({id,target,lang});return false}
  };
  const api=load(legacy,DE),view=card(),shipment={id:'SHIP-1',reference:'PABJJ5',status:'Bereit zur Abholung'};
  assert.equal(api.ensureGenericReminderActions(view.root,shipment),true);
  const reminder=view.root.querySelector('.index236-reminder-actions');
  assert.ok(reminder,'Erinnerungsblock fehlt');
  assert.equal(view.root.children.indexOf(reminder)<view.root.children.indexOf(view.danger),true,'Erinnerungsblock muss vor der unteren Aktionsleiste stehen');
  assert.deepEqual(reminder.children.map(x=>x.textContent),['Abholerinnerung öffnen','Kunde DE','Kunde EN','Spedition DE','Spedition EN']);
  const customerDe=reminder.children[1],carrierDe=reminder.children[3];
  assert.equal(customerDe.disabled,false);
  assert.equal(carrierDe.disabled,true,'fehlender Speditionskontakt deaktiviert nur die Speditionsaktion');
  assert.equal(carrierDe.title,'Keine E-Mail-Adresse für Spedition hinterlegt');
  customerDe._onclick({preventDefault(){},stopPropagation(){}});
  assert.deepEqual(calls,[{id:'SHIP-1',target:'customer',lang:'de'}]);
});

test('RC1484: neue Erinnerungsaktionen respektieren die aktive UI-Sprache',()=>{
  const legacy={recipientState(){return{available:true,to:['x@example.com']}},reminderMail(){}};
  const api=load(legacy,EN),view=card();
  assert.equal(api.ensureGenericReminderActions(view.root,{id:'SHIP-EN',status:'Ready for pickup'}),true);
  const reminder=view.root.querySelector('.index236-reminder-actions');
  assert.deepEqual(reminder.children.map(x=>x.textContent),['Open pickup reminder','Customer DE','Customer EN','Carrier DE','Carrier EN']);
});

test('RC1484: bestehender Legacy-Erinnerungsblock wird nicht dupliziert',()=>{
  const legacy={recipientState(){return{available:true,to:['x@example.com']}},reminderMail(){}};
  const api=load(legacy),view=card(),existing=element('div');existing.className='index236-reminder-actions';view.root.insertBefore(existing,view.danger);
  assert.equal(api.ensureGenericReminderActions(view.root,{id:'SHIP-2',plannedPickupDate:'2026-10-09'}),true);
  assert.equal(view.root.children.filter(x=>String(x.className).includes('index236-reminder-actions')).length,1);
});

test('RC1484: Runtime nutzt die bestehende Legacy-Mail-API und i18n statt eine zweite Mail-Logik einzuführen',()=>{
  assert.match(runtime,/function ensureGenericReminderActions\(/);
  assert.match(runtime,/ExportHUBIndex236/);
  assert.match(runtime,/recipientState/);
  assert.match(runtime,/reminderMail/);
  assert.match(runtime,/rc1484-generic-reminder-actions/);
  assert.match(runtime,/tr\('avisReminder\.button'\)/);
  assert.match(runtime,/tr\('avisReminder\.customer'\)/);
  assert.match(runtime,/tr\('avisReminder\.carrier'\)/);
  assert.match(runtime,/avisReminder\.missingCustomer/);
  assert.match(runtime,/avisReminder\.missingCarrier/);
});

test('RC1484: ausgelieferter HTML-Shell stellt die wiederverwendete Legacy-Mail-API bereit',()=>{
  const html=fs.readFileSync('TESTVERSION.html','utf8');
  assert.match(html,/ExportHUBIndex236\s*=\s*Object\.freeze/,'ExportHUBIndex236 fehlt im ausgelieferten Shell');
  assert.match(html,/recipientState\s*:\s*reminderRecipientState/,'Empfängerstatus-API fehlt im ausgelieferten Shell');
  assert.match(html,/reminderMail\s*:\s*reminderMail/,'Reminder-Mail-API fehlt im ausgelieferten Shell');
});
