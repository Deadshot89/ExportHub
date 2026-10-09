import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['scripts/rc1462-pretest.mjs'],{stdio:'pipe'});

function freshBlock(html){
  const start=html.indexOf('function startFreshShipment(){');
  const end=html.indexOf('function enforceFreshDraft(){',start);
  assert.ok(start>=0&&end>start,'Fresh-Draft-Block fehlt im Build');
  return html.slice(start,end);
}

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

test('RC1469 P0: Neue Sendung baut einen vollständigen Clean-Slate-Draft statt Altwerte zu übernehmen',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/ref=createReference\(\)/,file+': neue Referenz wird nicht erzeugt');
    assert.match(block,/template=\{[\s\S]*?customerId:'',customerNo:'',customerNumber:'',customerAccount:'',customerName:'',customerSearch:'',customerDisplay:'',customerCode:'',kundennummer:'',customer:\{\},customerData:\{\},selectedCustomer:\{\}/,file+': Kundendaten sind nicht leer initialisiert');
    assert.match(block,/carrier:'',carrierName:'',carrierEmail:'',spedition:'',speditionMail:'',incoterm:'',goodsDescription:'',comments:'',notes:'',deliveryNotes:'',licensePlate:'',loader:''/,file+': Versand-/Bemerkungsfelder sind nicht leer initialisiert');
    assert.match(block,/documents:\[\],files:\[\],docs:\[\],deliveryFiles:\[\],deliveryNotesFiles:\[\],deliveryNotesList:\[\],lieferscheine:\[\],podFiles:\[\],abdFiles:\[\],invoiceFiles:\[\],mailAttachments:\[\],attachments:\[\]/,file+': Dokument-/Lieferschein-/ABD-/Anhangslisten sind nicht leer initialisiert');
    assert.match(block,/totalWeight:0,totalColli:0,totalLdm:0,goodsValue:0/,file+': Maße/Gewicht-Summen sind nicht zurückgesetzt');
    assert.match(block,/rootState\.shipment=sh;rootState\.currentShipment=sh;rootState\.selectedShipment=null/,file+': State-Roots erhalten keinen frischen Draft');
    assert.match(block,/runtime\.lastSnapshot\.shipment=clone\(template\);runtime\.lastSnapshot\.currentShipment=clone\(template\)/,file+': letzter Runtime-Snapshot bleibt alt');
    assert.match(block,/Object\.keys\(sh\)\.forEach\(function\(k\)\{try\{delete sh\[k\]\}/,file+': Altobjekt wird vor dem Fresh-Assign nicht entkernt');
    assert.match(block,/Object\.assign\(sh,clone\(template\)\)/,file+': frisches Template wird nicht final übernommen');
    assert.doesNotMatch(block,/localStorage|sessionStorage|indexedDB/i,file+': Fresh-Start darf keine alten lokalen Draft-Caches einlesen');
  }
});

test('RC1469 P0: Release-Pfad löscht volatile Bemerkungs- und Dateiwerte im gemounteten Formular',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/function resetMountedFreshVolatile\(\)/,file+': volatile Reset-Funktion fehlt');
    assert.match(block,/querySelectorAll\('textarea'\)/,file+': Bemerkungsfelder werden nicht geprüft');
    assert.match(block,/comment\|remark\|bemerk/,file+': Bemerkungs-Erkennung fehlt');
    assert.match(block,/querySelectorAll\('input\[type=file\]'\)/,file+': Datei-Inputs werden nicht geleert');
    assert.match(block,/resetMountedFreshVolatile\(\);safePatchDuringEdit\(\);return true/,file+': volatile Felder werden im lokalen Fresh-Reset nicht geleert');
  }
});

test('RC1469 P0: DOM-Finalizer deckt Kunde, Standort, Colli, Maße/Gewicht, ABD, Dokumente und Versanddaten ab',()=>{
  build();
  const block=freshBlock(fs.readFileSync('dist-rc1112/index.html','utf8'));
  assert.match(block,/if\(el\.type==='file'\)\{try\{el\.value=''\}/);
  assert.match(block,/if\(el\.type==='checkbox'\|\|el\.type==='radio'\)\{el\.checked=false/);
  for(const token of ['kunde','customer','standort','location','colli','gewicht','weight','lademeter','ldm','abd','dokument','document','lieferschein','spedition','carrier','abholdatum','pickup','kennzeichen','warenbeschreibung','goods','incoterm']){
    assert.ok(block.includes(token),token+' fehlt im DOM-Clean-Slate-Vertrag');
  }
});

test('RC1469 P0: Classic und Themes stapeln die Sendungskarten auf Telefonen wirklich einspaltig',()=>{
  const css=fs.readFileSync('assets/rc1306-layout-engine.css','utf8');
  const start=css.indexOf('@media(max-width:760px){');
  const end=css.indexOf('@media print{',start);
  const mobile=start>=0&&end>start?css.slice(start,end):'';
  assert.ok(mobile,'RC1469 Mobile-Regel fehlt in der Layout-Engine');
  assert.match(mobile,/#rc383TopPair\.rc894-full-stack\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important;[\s\S]*?grid-auto-flow:row!important;/i,'TopPair wird auf Telefonen nicht hart einspaltig gehalten');
  assert.doesNotMatch(mobile,/html\[data-eh-layout-mode\][^\{]*#rc383TopPair\.rc894-full-stack\{/i,'Classic darf nicht von einem Theme-Workspace abhängen');
  assert.match(mobile,/#rc363BlockCustomer,#rc363BlockShipment,#rc363BlockColli,#rc573ColliCard,#rc363BlockDocuments[\s\S]*?grid-column:1\/-1!important;[\s\S]*?grid-row:auto!important;[\s\S]*?width:100%!important;/i,'Prozesskarten werden auf Telefonen nicht vollbreit gestapelt');
  assert.match(mobile,/#rc363BlockCustomer \.rc363-process-body\{[\s\S]*?width:100%!important;[\s\S]*?min-width:0!important;/i,'Kunden-Body kann weiterhin auf 0px kollabieren');
});
