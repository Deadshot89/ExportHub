import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual Packmeldung openDocument implementation; no copy of
// business logic. The existing Packmeldungen branch gate runs this file.
const source=fs.readFileSync('assets/pack-notification-internal.js','utf8');
const begin='async function openDocument(model,index,download){';
const finish='function reportDocumentError(err){';
const start=source.indexOf(begin),end=start<0?-1:source.indexOf(finish,start);
assert.ok(start>=0&&end>start,'Packmeldung original PDF handler must exist');
const snippet=source.slice(start,end);

function harness({documentAvailable=true,viewerAvailable=true}={}){
  const calls=[];
  const root={ExportHUBDocumentBlob1059:viewerAvailable?{
    async open(file,options){calls.push({file,options});return true;}
  }:null};
  const ctx={
    root,
    q:value=>String(value==null?'':value).trim(),
    tr:()=> 'Lieferschein.pdf',
    documentForViewer:doc=>documentAvailable?doc:null
  };
  const openDocument=vm.runInNewContext(snippet+'\nopenDocument',ctx,{filename:'pack-notification-preview-handler.js'});
  return{openDocument,calls};
}

test('P0 Packmeldung Öffnen forwards original protected PDF to the authenticated viewer, never a bare URL',async()=>{
  const document={name:'DNC3019222063.pdf',storage:'blob',
    blobName:'rc1059/testservice/aa/'+('a'.repeat(64))};
  const {openDocument,calls}=harness();
  assert.equal(await openDocument({documents:[document]},0,false),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].file,document);
  assert.equal(calls[0].options.name,document.name);
  assert.equal(calls[0].options.download,false);
  assert.doesNotMatch(snippet,/\b(?:window|root)\.open\s*\(/,
    'Packmeldung handler must not open naked protected API URLs');
});

test('P0 Packmeldung Download uses the same original PDF reader but explicitly requests a download',async()=>{
  const document={name:'SIDE250071282.pdf',storage:'blob',
    blobName:'rc1059/testservice/ab/'+('b'.repeat(64))};
  const {openDocument,calls}=harness();
  assert.equal(await openDocument({documents:[document]},0,true),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].file,document);
  assert.equal(calls[0].options.download,true);
});

test('P0 missing PDF or missing authenticated viewer fails without a false success',async()=>{
  const document={name:'Lieferschein.pdf'};
  const missing=harness({documentAvailable:false});
  assert.equal(await missing.openDocument({documents:[document]},0,false),false);
  assert.equal(missing.calls.length,0);
  const noViewer=harness({viewerAvailable:false});
  assert.equal(await noViewer.openDocument({documents:[document]},0,true),false);
  assert.equal(noViewer.calls.length,0);
});

test('P0 Packmeldung UI buttons use the same protected handler for Öffnen and Download',()=>{
  assert.match(source,/if\(target\.hasAttribute\('data-pack-doc-open'\)\)\{await openDocument\(model,target\.getAttribute\('data-pack-doc-open'\),false\)/);
  assert.match(source,/if\(target\.hasAttribute\('data-pack-doc-download'\)\)\{await openDocument\(model,target\.getAttribute\('data-pack-doc-download'\),true\)/);
});
