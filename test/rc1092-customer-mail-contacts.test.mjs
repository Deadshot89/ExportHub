import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('assets/rc1092-customer-mail-contacts.js');
const i18nDe=JSON.parse(read('assets/i18n/de.json'));

function block(start,end){
 const a=runtime.indexOf(start);assert.ok(a>=0,start+' fehlt');
 const b=end?runtime.indexOf(end,a+start.length):-1;
 return runtime.slice(a,b>a?b:runtime.length);
}

test('RC1092 trennt Person speichern und Zur Mail hinzufügen fachlich',()=>{
 assert.match(runtime,/customerContacts\.savePerson/);
 assert.match(runtime,/customerContacts\.addToMail/);
 assert.equal(i18nDe['customerContacts.savePerson'],'Person speichern');
 assert.equal(i18nDe['customerContacts.addToMail'],'Zur Mail hinzufügen');
 const save=block('async function savePerson','function customerFieldsSnapshot');
 const add=block('async function addToMail','async function removeFromMail');
 assert.match(save,/upsertLibrary\(/,'Person speichern muss die Kontaktbibliothek pflegen');
 assert.doesNotMatch(save,/writeMailContacts\(/,'Person speichern darf niemanden automatisch zur Kundenmail hinzufügen');
 assert.match(add,/writeMailContacts\(/,'Zur Mail hinzufügen muss die Mail-Zuordnung des Kunden pflegen');
 assert.doesNotMatch(add,/upsertLibrary\(/,'Zur Mail hinzufügen darf nicht stillschweigend den separaten Bibliotheks-Button ersetzen');
});

test('RC1092 speichert beide Aktionen dauerhaft über den bestätigten Azure-Pfad',()=>{
 assert.match(runtime,/queueSave\(reason\)/);
 assert.match(runtime,/flushSave\(reason,\{force:true,userInitiated:true\}\)/);
 assert.match(runtime,/customerContacts\.storageUnconfirmed/);
});

test('RC1092 hält Sales und CC getrennt und bewahrt Legacy-Mailfelder',()=>{
 assert.match(runtime,/salesContacts/);
 assert.match(runtime,/customerSalesContacts/);
 assert.match(runtime,/ccContacts/);
 assert.match(runtime,/customerCcContacts/);
 for(const field of ['salesMail','salesEmail','salesPersonMail','salesPersonEmail','salesContactMail','salesContactEmail','rc385SalesMail','salesCc','cc','mailCc','rc385Cc'])assert.ok(runtime.includes(field),field+' fehlt');
 assert.match(runtime,/customerContacts\.removed/);
});

test('RC1092 Kundenordner-UI besitzt getrennte Aktionen auf Desktop und Mobile',()=>{
 assert.match(runtime,/data-rc1092-save/);
 assert.match(runtime,/data-rc1092-add/);
 assert.match(runtime,/@media\(max-width:760px\)/);
 assert.match(runtime,/customerContacts\.intro\.note/);
 assert.equal(i18nDe['customerContacts.intro.note'],'Ein gespeicherter Kontakt wird nicht allein durch die Auswahl zur Mail hinzugefügt.');
});

test('RC1092 wird in alle drei RC1048 Umgebungen ausgeliefert',()=>{
 execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
 for(const file of ['index.html','TESTVERSION.html','demo.html']){
  const html=read('dist-rc1048/'+file);
  assert.match(html,/assets\/rc1092-customer-mail-contacts\.js\?v=1092/,file+': RC1092 Runtime fehlt');
 }
 const built=read('dist-rc1048/assets/rc1092-customer-mail-contacts.js');
 assert.match(built,/__EXPORTHUB_RC1092_CUSTOMER_MAIL_CONTACTS__/);
 const manifest=JSON.parse(read('dist-rc1048/rc1048-manifest.json'));
 assert.equal(manifest.retainedPatches.customerMailContacts.version,'RC1092');
 assert.equal(manifest.retainedPatches.customerMailContacts.separateLibraryAndMailAssignment,true);
});

test('RC1092 Produktionsworkflow prüft Build und Live-Auslieferung',()=>{
 const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
 assert.match(flow,/Live RC1092 Kundenkontakte prüfen/);
 assert.match(flow,/assets\/rc1092-customer-mail-contacts\.js\?v=1092/);
 assert.match(flow,/Person speichern und Zur Mail hinzufügen live bestätigt/);
});
