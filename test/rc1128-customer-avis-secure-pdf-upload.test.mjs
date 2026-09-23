import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const security=require('../api/shared/customer-avis-pdf-security.js');
const read=p=>fs.readFileSync(p,'utf8');

function pdf(extra=''){
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< '+extra+' >>\nendobj\ntrailer\n<<>>\n%%EOF\n','latin1');
}
function upload(name='Kunde.pdf',buffer=pdf(),type='application/pdf'){
  return{name,type,base64:buffer.toString('base64')};
}

test('RC1128: nur echte, kleine und passive PDF-Dateien werden vor der Quarantäne akzeptiert',()=>{
  const good=security.validatePdfUpload(upload());
  assert.equal(good.name,'Kunde.pdf');
  assert.equal(good.mimeType,'application/pdf');
  assert.equal(good.size,pdf().length);
  assert.match(good.sha256,/^[a-f0-9]{64}$/);

  assert.throws(()=>security.validatePdfUpload(upload('Kunde.exe')),e=>e.code==='PDF_EXTENSION_REQUIRED');
  assert.throws(()=>security.validatePdfUpload(upload('Kunde.pdf',Buffer.from('MZ-not-pdf'))),e=>/PDF_(?:MAGIC_)?INVALID/.test(e.code));
  assert.throws(()=>security.validatePdfUpload(upload('Kunde.pdf',pdf('/Encrypt 2 0 R'))),e=>e.code==='PDF_ENCRYPTED');
  for(const marker of ['/JavaScript 2 0 R','/JS (alert)','/Launch 2 0 R','/EmbeddedFile 2 0 R','/OpenAction 2 0 R','/AA 2 0 R']){
    assert.throws(()=>security.validatePdfUpload(upload('Kunde.pdf',pdf(marker))),e=>e.code==='PDF_ACTIVE_CONTENT',marker+' muss blockiert werden');
  }
});

test('RC1128: Größenlimit ist fail-closed und serverseitig konfigurierbar',()=>{
  const old=process.env.EXPORTHUB_AVIS_PDF_MAX_BYTES;
  try{
    process.env.EXPORTHUB_AVIS_PDF_MAX_BYTES='1024';
    const large=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.alloc(1100,65),Buffer.from('\n%%EOF\n')]);
    assert.throws(()=>security.validatePdfUpload(upload('gross.pdf',large)),e=>e.code==='PDF_TOO_LARGE');
  }finally{
    if(old===undefined)delete process.env.EXPORTHUB_AVIS_PDF_MAX_BYTES;else process.env.EXPORTHUB_AVIS_PDF_MAX_BYTES=old;
  }
});

test('RC1128: Defender-Tags werden ausschließlich mit No threats found freigegeben',()=>{
  assert.deepEqual(security.scanResultFromTags({'Malware scanning scan result':'No threats found','Malware scanning scan time':'2026-09-16T10:00:00Z'}),{status:'clean',result:'No threats found',scanTime:'2026-09-16T10:00:00Z'});
  assert.equal(security.scanResultFromTags({'Malware scanning scan result':'Malicious'}).status,'malicious');
  assert.equal(security.scanResultFromTags({'Malware scanning scan result':'Not scanned'}).status,'not-scanned');
  assert.equal(security.scanResultFromTags({'Malware scanning scan result':'Not scanned: unsupported'}).status,'not-scanned');
  assert.equal(security.scanResultFromTags({'Malware scanning scan result':'Error'}).status,'error');
  assert.equal(security.scanResultFromTags({}).status,'pending');
});

test('RC1128: Quarantäne und finaler Dokumentpfad sind strikt getrennt',()=>{
  const hash='a'.repeat(64),q=security.quarantineBlobName('testservice','secret-session',hash),final=security.finalBlobName('testservice',hash);
  assert.match(q,/^rc1128\/testservice\/[a-f0-9]{24}\/a{64}\.pdf$/);
  assert.equal(final,'rc1059/testservice/aa/'+hash);
  assert.ok(!q.startsWith('rc1059/'),'ungeprüfte Datei darf nie im finalen Dokumentpfad liegen');
});

test('RC1128: Kunden-Avis-API speichert erst nach sauberem Defender-Ergebnis endgültig',()=>{
  const api=read('api/customer-avis/index.js');
  assert.doesNotThrow(()=>new Function('require','module','exports',api));
  assert.match(api,/AVIS_QUARANTINE_CONTAINER/);
  assert.match(api,/postAction==='upload-document'/);
  assert.match(api,/postAction==='document-upload-status'/);
  assert.match(api,/pdfSecurity\.validatePdfUpload/);
  assert.match(api,/qBlob\.getTags\(\)/);
  assert.match(api,/scan\.status==='clean'/);
  assert.match(api,/scan\.status==='malicious'\|\|scan\.status==='not-scanned'\|\|scan\.status==='error'/);
  assert.match(api,/source:'customer-avis-upload'/);
  assert.match(api,/customerAvisVisible:true/);
  assert.match(api,/Microsoft Defender for Storage/);
  const cleanAt=api.indexOf("if(scan.status==='clean')");
  const promoteAt=api.indexOf('promoteCleanCustomerPdf(teamBlob');
  assert.ok(cleanAt>=0&&promoteAt>=0,'Clean-Gate oder Promotion fehlt');
  assert.match(api,/PDF_MALWARE_DETECTED/);
  assert.match(api,/deleteIfExists/,'Quarantäne muss nach Abschluss gelöscht werden');
});

test('RC1128: Lieferavis zeigt PDF-Upload, Sicherheitsregeln und Status an',()=>{
  const page=read('customer-avis.html');
  assert.match(page,/id="customerPdfUpload"/);
  assert.match(page,/accept="\.pdf,application\/pdf"/);
  assert.match(page,/PDF prüfen & hochladen/);
  assert.match(page,/Virenprüfung \/ Fachprüfung läuft/);
  assert.match(page,/Microsoft Defender for Storage/);
  assert.match(page,/document-upload-status/);
  assert.match(page,/upload-document/);
  assert.match(page,/max\. 10 MB/);
  assert.match(page,/Schadsoftware geprüft/);
  assert.match(page,/public-language\.js\?v=1231/);
});

test('RC1128: finaler RC1018-Build behält Uploadfunktion und Formularschutz ohne Syntaxfehler',()=>{
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{stdio:'pipe'});
  const page=read('dist-rc1018/customer-avis.html');
  assert.match(page,/customerPdfUpload/);
  assert.match(page,/document-upload-status/);
  assert.match(page,/avisFormDirty=false/,'bestehender RC1029 Formularschutz muss erhalten bleiben');
  assert.match(page,/customerUploadInteraction/,'Dateiauswahl muss gegen automatischen Refresh geschützt bleiben');
  const scripts=[...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc\s*=/.test(m[1]));
  assert.ok(scripts.length>0);
  scripts.forEach((m,i)=>assert.doesNotThrow(()=>new Function(m[2]),'Inline-Skript '+i+' ist syntaktisch ungültig'));
});

test('RC1128: öffentliche Sprachumschaltung kennt die neuen Sicherheitsbegriffe',()=>{
  const lang=read('assets/rc1018-public-language.js');
  for(const term of ['PDF-Dokumente hochladen','Upload PDF documents','Virenprüfung / Fachprüfung läuft','Malware / content check in progress','Speicherung nur nach bestandener Viren- und Fachprüfung']){
    assert.ok(lang.includes(term),term+' fehlt in der DE/EN-Sprachbasis');
  }
});
