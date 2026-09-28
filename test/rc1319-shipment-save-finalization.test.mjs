import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}
function read(file){return fs.readFileSync(file,'utf8')}

test('RC1319: gespeicherte Entwürfe werden erstellt und Status bleibt definiert',()=>{
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.doesNotMatch(html,/if\(!q\(saved\.status\)\)saved\.status='Entwurf';/,file+': alte Entwurf-Regression darf nicht zurückkehren');
    assert.match(html,/if\(!q\(saved\.status\)\|\|\/\^entwurf\$\/i\.test\(q\(saved\.status\)\)\)\{saved\.status='Erstellt';saved\.processStatus='Erstellt'\}/,file+': persistierte Sendung muss Entwurf verlassen');
    assert.match(html,/function recalc\(sh\)\{[\s\S]*?return q\(sh&&\(sh\.status\|\|sh\.processStatus\)\)\}/,file+': recalc muss den kanonischen Status zurückgeben');
    assert.doesNotMatch(html,/var canonicalSavedStatus=recalc\(saved\);[\s\S]{0,500}s\.shipment\.status=undefined/,file+': aktiver Status darf nie undefined werden');
  }
});

test('RC1319: erfolgreicher Save übergibt exakt die persistierte Sendung an den vorhandenen QR-Pfad',()=>{
  build();
  const perf=read('assets/rc1069-performance.js');
  assert.match(perf,/\['exporthub:shipment-saved','exporthub:documents-opening'\]/);
  assert.match(perf,/sh=d\.shipment\|\|currentPrintShipment\(\)/);
  assert.match(perf,/warehouse\.register\(sh,false\)/);

  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(html,/detail:\{id:id,reference:saved\.ref,updated:!!existing,azureSaved:true,shipment:saved\}/,file+': Save-Event muss das persistierte Sendungsobjekt tragen');
    const persistedAt=html.indexOf('function persisted(sh)');
    const eligibleAt=html.indexOf('function eligible(sh)',persistedAt);
    assert.ok(persistedAt>=0&&eligibleAt>persistedAt,file+': QR-Persistenz-/Zulassungsfunktion fehlt');
    const persistedBlock=html.slice(persistedAt,eligibleAt);
    assert.match(persistedBlock,/\^DRAFT-/i,file+': QR-Persistenz muss Draft-IDs ablehnen');
    assert.match(persistedBlock,/states\(\)\.some/,file+': QR-Persistenz muss gespeicherte State-Kopien prüfen');
    const eligibleBlock=html.slice(eligibleAt,html.indexOf('function historicalQr',eligibleAt));
    assert.match(eligibleBlock,/persisted\(sh\)/,file+': QR-Zulassung muss Persistenz verlangen');
    assert.match(eligibleBlock,/\^\[A-Z0-9\]\{6\}\$/,file+': QR-Zulassung muss sechsstellige Referenz verlangen');
    assert.match(eligibleBlock,/customerText\(sh\)/,file+': QR-Zulassung muss Kunde verlangen');
    assert.match(eligibleBlock,/colliCount\(sh\)>0/,file+': QR-Zulassung muss Colli verlangen');
    assert.match(html,/pickupQrRegistered:true[\s\S]{0,700}readyForPickup:true[\s\S]{0,700}readinessStatus:'Bereit zur Abholung'/,file+': QR-Erfolg muss Abholbereitschaft setzen');
    assert.match(html,/one\.status='Bereit zur Abholung';one\.processStatus='Bereit zur Abholung'/,file+': QR-Erfolg muss Status fortschreiben');
  }
});
