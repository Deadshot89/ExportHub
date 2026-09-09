import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const MAIL=path.join(ROOT,'assets/rc1018-mail-language-standard.js');
const PUBLIC=path.join(ROOT,'assets/rc1018-public-language.js');
const BUILD=path.join(ROOT,'.github/rc1018/build-three-env.mjs');

function api(){
  assert.ok(fs.existsSync(MAIL),'RC1018 Mail-/Sprachruntime fehlt.');
  const source=fs.readFileSync(MAIL,'utf8');
  const window={};
  const context={window,console,URL,URLSearchParams,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{getItem:()=>null,setItem:()=>{}}};
  vm.runInNewContext(source,context,{filename:'rc1018-mail-language-standard.js'});
  assert.ok(window.ExportHUBRC1018MailLanguage,'RC1018 Test-API fehlt.');
  return window.ExportHUBRC1018MailLanguage;
}

const deBody=`Sehr geehrte Damen und Herren,\n\nbitte beachten Sie die folgende Sendung.\n\nDetails zur Sendung:\nReferenz: ABC123\nLieferschein: LS-7788\nGewicht: 1.250 kg\n\nMit freundlichen Grüßen\nExport Team`;
const enBody=`Dear Sir or Madam,\n\nplease find the shipment information below.\n\nShipment details:\nReference: ABC123\nDelivery note: LS-7788\nWeight: 1,250 kg\n\nKind regards\nExport Team`;

test('RC1018: Sprache gilt für bestehende und neue Kunden mit sicherem Deutsch-Fallback',()=>{
  const a=api();
  assert.equal(a.resolveLanguage({},'', ''),'de');
  assert.equal(a.resolveLanguage({language:'en'},'', ''),'en');
  assert.equal(a.resolveLanguage({mailLanguage:'EN'},'', ''),'en');
  assert.equal(a.resolveLanguage({rc543MailLang:'de'},'en',''),'en','Explizite Mailauswahl muss Vorrang haben.');
  assert.equal(a.resolveLanguage({},'', 'en'),'en','Aktuelle UI-Auswahl muss unterstützt werden.');
});

test('RC1018: Kunden- und Speditionsmail haben professionelle DE/EN-Sendungsdetails',()=>{
  const a=api();
  for(const [target,lang,body,title] of [
    ['customer','de',deBody,'SENDUNGSDETAILS'],
    ['carrier','de',deBody,'SENDUNGSDETAILS – ABHOLUNG'],
    ['customer','en',enBody,'SHIPMENT DETAILS'],
    ['carrier','en',enBody,'SHIPMENT DETAILS – PICKUP']
  ]){
    const out=a.composeMail({target,lang,body,avisEnabled:false,url:'https://example.test/customer-avis.html?t=abc',reference:'ABC123'});
    assert.match(out,new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
    assert.match(out,/ABC123/);
    assert.match(out,/LS-7788/);
    assert.doesNotMatch(out,/LIEFERAVIS|COLLECTION NOTICE/i,'Sendungsdetail-Mail darf keinen Lieferavis enthalten.');
  }
});

test('RC1018: Lieferavis ersetzt Sendungsdetails strikt bei Kunde und Spedition in DE/EN',()=>{
  const a=api();
  for(const [target,lang,body] of [
    ['customer','de',deBody],['carrier','de',deBody],['customer','en',enBody],['carrier','en',enBody]
  ]){
    const out=a.composeMail({target,lang,body,avisEnabled:true,url:'https://example.test/customer-avis.html?t=abc',reference:'ABC123'});
    assert.match(out,/LIEFERAVIS|COLLECTION NOTICE/i);
    assert.match(out,/ABC123/);
    assert.match(out,/lang=(?:de|en)/i,'Lieferavis-Link muss die Mail-Sprache übernehmen.');
    assert.doesNotMatch(out,/SENDUNGSDETAILS|SHIPMENT DETAILS|Details zur Sendung|Shipment details/i,'Lieferavis-Mail darf keine Sendungsdetails mehr enthalten.');
  }
});

test('RC1018: Mailmodus ist nur bei Kunde oder Spedition avisfähig und sonst Sendungsdetails',()=>{
  const a=api();
  assert.equal(a.resolveMode('customer',true),'avis');
  assert.equal(a.resolveMode('carrier',true),'avis');
  assert.equal(a.resolveMode('own',true),'details');
  assert.equal(a.resolveMode('customer',false),'details');
});

test('RC1018: Website und öffentliche Seiten besitzen denselben DE/EN-Sprachstandard',()=>{
  assert.ok(fs.existsSync(PUBLIC),'Öffentliche RC1018 Sprachruntime fehlt.');
  const runtime=fs.readFileSync(PUBLIC,'utf8');
  assert.match(runtime,/exporthub\.language/);
  assert.match(runtime,/Deutsch/);
  assert.match(runtime,/English/);
  for(const page of ['customer-avis.html','pickup.html','location.html']){
    const html=fs.readFileSync(path.join(ROOT,page),'utf8');
    assert.match(html,/rc1018-public-language\.js\?v=1018/,`${page} lädt die gemeinsame Sprachruntime nicht.`);
  }
});

test('RC1018: Produktion, TESTSERVICE und Demo werden auf denselben Release gebaut',()=>{
  assert.ok(fs.existsSync(BUILD),'RC1018 Drei-Umgebungen-Build fehlt.');
  execFileSync(process.execPath,[BUILD],{cwd:ROOT,stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(ROOT,'dist-rc1018',file),'utf8');
    assert.match(html,/ExportHUB RC1018 environment=/);
    assert.match(html,/version:'RC1018'/);
    assert.match(html,/rc1018-mail-language-standard\.js\?v=1018/);
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'dist-rc1018/rc1018-manifest.json'),'utf8'));
  assert.equal(manifest.version,'RC1018');
  assert.deepEqual(manifest.environments,{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'});
});
