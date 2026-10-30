import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const av=require('../api/shared/av-check.js');
const refFiles=require('../api/reference-files/index.js');
const NOW=new Date('2026-10-30T18:01:02Z');
const b64=buf=>Buffer.from(buf).toString('base64');
const PDF=b64('%PDF-1.7\n%test\n'),ZIP=b64([0x50,0x4b,0x03,0x04,0x14,0x00]),OLE=b64([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1,0]),CSV=b64('Pos;Menge\n1;5\n');

test('Dokument-Upload: Name mit Dokumentart, Referenz und Zeitstempel',()=>{
  const r=refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE 4711.pdf',data:PDF},NOW);
  assert.equal(r.name,'Rechnung_ABC123_20261030-180102_RE 4711.pdf');
  assert.equal(r.mimeType,'application/pdf');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'LS.pdf',data:PDF},NOW).name,'Lieferschein_ABC123_20261030-180102_LS.pdf');
  assert.equal(refFiles.documentUploadFile('ABC123',{fileName:'x.pdf',data:PDF},NOW).name,'Dokument_ABC123_20261030-180102_x.pdf');
});

test('Dokument-Upload zählt nie als Ausgangsvermerk, auch wenn die Datei mit AV beginnt',()=>{
  for(const kind of ['lieferschein','rechnung','packliste','excel','sonstiges']){
    const r=refFiles.documentUploadFile('ABC123',{kind,fileName:'AV_ABC123.pdf',data:PDF},NOW);
    assert.equal(av.isAvFileName(r.name),false,r.name);
  }
});

test('Dokument-Upload: Excel, Word, CSV, Bilder und E-Mails mit passender Signatur',()=>{
  assert.match(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.xlsx',data:ZIP},NOW).mimeType,/spreadsheetml/);
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Alt.xls',data:OLE},NOW).mimeType,'application/vnd.ms-excel');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.csv',data:CSV},NOW).mimeType,'text/csv');
  assert.match(refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Brief.docx',data:ZIP},NOW).mimeType,/wordprocessingml/);
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Mail.msg',data:OLE},NOW).mimeType,'application/vnd.ms-outlook');
  assert.equal(refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'Foto.PNG',data:b64([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0])},NOW).mimeType,'image/png');
});

test('Dokument-Upload lehnt falsche, leere, zu große und gefährliche Dateien ab',()=>{
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'tool.exe',data:PDF},NOW),/docTypeInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'seite.html',data:CSV},NOW),/docTypeInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.xlsx',data:PDF},NOW),/docSignatureInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'excel',fileName:'Liste.csv',data:b64([0x41,0,0x42])},NOW),/docSignatureInvalid/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE.pdf',data:''},NOW),/docEmpty/);
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'zoll',fileName:'RE.pdf',data:PDF},NOW),/docKindInvalid/);
  const big=Buffer.alloc(15*1024*1024+1,0x20);big.write('%PDF-',0,'ascii');
  assert.throws(()=>refFiles.documentUploadFile('ABC123',{kind:'rechnung',fileName:'RE.pdf',data:big.toString('base64')},NOW),/docTooLarge/);
});

test('Dokument-Upload: Fehlermeldungen in allen sechs API-Sprachen',()=>{
  for(const l of ['de','en','pl','es','fr','it']){
    const pack=JSON.parse(fs.readFileSync(`api/shared/i18n/${l}.json`,'utf8'));
    for(const k of ['docKindInvalid','docTypeInvalid','docEmpty','docTooLarge','docSignatureInvalid'])assert.ok(pack['api.reference.'+k],l+' '+k);
  }
});

test('Dokument-Upload ist in Build, Routing und Sendungsansicht eingebunden',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8'),asset=fs.readFileSync('assets/shipment-document-upload.js','utf8');
  assert.match(build,/assets\/i18n\/shipment-document-upload\.js\?v=1/);
  assert.match(build,/assets\/shipment-document-upload\.js\?v=1/);
  assert.match(build,/'assets\/shipment-document-upload\.js',/);
  assert.match(fs.readFileSync('staticwebapp.config.json','utf8'),/"route": "\/assets\/shipment-document-upload\.js"/);
  assert.match(asset,/#rc786ReferenceFilesCard \.rc786-doc-head-actions/);
  assert.match(asset,/action:'upload-document'/);
  assert.match(asset,/multiple/);
  const api=fs.readFileSync('api/reference-files/index.js','utf8');
  assert.match(api,/action==='upload-document'[\s\S]{0,300}publicAccess\.environment\(req,payload\)/);
  const i18n=fs.readFileSync('assets/i18n/shipment-document-upload.js','utf8');
  for(const l of ['de','en','pl','es','fr','it'])assert.match(i18n,new RegExp('\\n '+l+':\\{button:'));
});
