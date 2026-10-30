import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

function normalizer(){
  const source=fs.readFileSync('assets/document-reference-normalizer.js','utf8');
  const root={};
  vm.runInContext(source,vm.createContext({window:root,globalThis:root,String,Object,Array,Set,Map,Math,RegExp,Uint8Array,ArrayBuffer,Promise,DecompressionStream}),{filename:'document-reference-normalizer.js'});
  return root.ExportHubDocumentReferenceNormalizer;
}
function fileFromBytes(name,bytes){const view=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);return{name,type:'application/pdf',size:bytes.length,arrayBuffer:async()=>view};}

// Same shape as D365/Chrome output: Identity-H glyph ids in the page stream and
// a compressed ToUnicode CMap that maps them back to text.
function cidFontPdf(text){
  const glyph=new Map();let next=3;
  for(const ch of text)if(!glyph.has(ch))glyph.set(ch,next++);
  const hex=[...text].map(ch=>glyph.get(ch).toString(16).padStart(4,'0').toUpperCase()).join('');
  const chars=[...glyph].map(([ch,id])=>`<${id.toString(16).padStart(4,'0').toUpperCase()}> <${ch.charCodeAt(0).toString(16).padStart(4,'0').toUpperCase()}>`);
  const cmap=`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${chars.length} beginbfchar\n${chars.join('\n')}\nendbfchar\nendcmap\nend\nend`;
  const page=`BT\n/F1 12 Tf\n<${hex}> Tj\nET`;
  const parts=[Buffer.from('%PDF-1.4\n','latin1')];
  for(const body of [page,cmap]){
    const stream=zlib.deflateSync(Buffer.from(body,'latin1'));
    parts.push(Buffer.from(`1 0 obj\n<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`,'latin1'),stream,Buffer.from('\nendstream\nendobj\n','latin1'));
  }
  parts.push(Buffer.from('%%EOF','latin1'));
  return new Uint8Array(Buffer.concat(parts));
}

test('Packtisch renames a D365 PDF whose DNC is only readable through the ToUnicode CMap',async()=>{
  const api=normalizer();
  const bytes=cidFontPdf('Lieferschein-Nr.: DNC000123456');
  const out=await api.normalizePdfFile(fileFromBytes('SalesPackingSlip-Kunde-116394_28102026_100515_703_116963_P.pdf',bytes));
  assert.equal(out.name,'DNC000123456.pdf');
  assert.equal(out.renamed,true);
  assert.equal(out.reference,'DNC000123456');
});

test('DNC in an underscore separated filename is recognized in browser and server',()=>{
  const browser=normalizer(),server=require('../api/shared/pdf-document-reference.js');
  for(const api of [browser,server]){
    const out=api.normalizedPdfName('Lieferschein_DNC000123456_1.pdf','');
    assert.equal(out.name,'DNC000123456.pdf');
    assert.equal(api.normalizedPdfName('XDNC000123456.pdf','').renamed,false,'DNC must not be glued to another word');
  }
});

test('server retries every PDF with the full PDF engine, not only SalesPackingSlip names',async()=>{
  const mod=require('../api/shared/document-blob-store.js');
  const bytes=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length 20 >>\nstream\nBT <0003> Tj ET\nendstream\nendobj\n%%EOF','latin1');
  const uploads=[];
  const container={getBlockBlobClient(name){return{async uploadData(buffer,options){uploads.push({name,options});return{etag:'"1"'};}};}};
  let called=0;
  const out=await mod.storeInlineDocument({id:'scan-1',name:'Scan_2026-10-29.pdf',mimeType:'application/pdf',data:`data:application/pdf;base64,${bytes.toString('base64')}`},
    {environment:'testservice',container,pdfTextExtractor:async()=>{called++;return 'Lieferschein DNC 3019222063';}});
  assert.equal(called,1);
  assert.equal(out.name,'DNC3019222063.pdf');
  assert.equal(out.originalName,'Scan_2026-10-29.pdf');
  assert.equal(uploads[0].options.blobHTTPHeaders.blobContentType,'application/pdf');
});

test('document API returns the PDF as raw bytes like the other binary endpoints',()=>{
  const api=fs.readFileSync('api/exporthub-document/index.js','utf8');
  assert.match(api,/context\.res=\{status:200,isRaw:true,/);
});

test('Öffnen reserves the tab during the click so the PDF is not blocked as a popup',async()=>{
  const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
  const events=[];
  const tab={closed:false,opener:'x',location:{set href(v){events.push('navigate:'+v);}},close(){this.closed=true;events.push('close');}};
  let reply={ok:true,status:200,redirected:false,type:'basic',url:'https://www.exporthub360.de/api/exporthub-document',headers:{get(){return'application/pdf';}},async blob(){return new Blob(['%PDF-1.7'],{type:'application/pdf'});}};
  const w={
    location:{hostname:'www.exporthub360.de',origin:'https://www.exporthub360.de'},
    ExportHUBClean:{runtime:{authToken:'T'}},
    open(url,target){events.push('open:'+url+':'+target);return tab;},
    fetch:async()=>{events.push('fetch');return reply;},
    document:{createElement(){return{click(){events.push('click');},remove(){}};},body:{appendChild(){}}},
    URL:{createObjectURL(){return'blob:pdf';},revokeObjectURL(){}},
    setTimeout(){}
  };
  vm.runInNewContext(source,{window:w,URL,Blob,Uint8Array,String});
  const doc={name:'DNC000123456.pdf',storage:'blob',blobName:'rc1059/production/aa/'+'a'.repeat(64)};
  assert.equal(await w.ExportHUBDocumentBlob1059.open(doc,{name:doc.name}),true);
  assert.deepEqual(events,['open:about:blank:_blank','fetch','navigate:blob:pdf']);
  assert.equal(tab.opener,null);

  events.length=0;tab.closed=false;
  reply={ok:false,status:404,redirected:false,type:'basic',url:'',headers:{get(){return'application/json';}},async json(){return{message:'weg'};}};
  await assert.rejects(w.ExportHUBDocumentBlob1059.open(doc,{name:doc.name}));
  assert.deepEqual(events,['open:about:blank:_blank','fetch','close'],'a failed fetch must not leave an empty tab');

  events.length=0;
  reply={ok:true,status:200,redirected:false,type:'basic',url:'',headers:{get(){return'application/pdf';}},async blob(){return new Blob(['%PDF-1.7'],{type:'application/pdf'});}};
  await w.ExportHUBDocumentBlob1059.open(doc,{name:doc.name,download:true});
  assert.deepEqual(events,['fetch','click'],'download keeps the named anchor download');
});

test('Lieferschein-Abruf sendet kein Microsoft-Anmeldecookie mit, nur das ExportHUB-Token',async()=>{
  const source=fs.readFileSync('assets/rc1059-document-blob.js','utf8');
  const calls=[];
  const w={
    location:{hostname:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},
    ExportHUBClean:{runtime:{authToken:'T'}},
    fetch:async(url,options)=>{calls.push({url,options});return{ok:true,status:200,redirected:false,type:'basic',url:'',headers:{get(){return'application/pdf';}},async blob(){return new Blob(['%PDF-1.7'],{type:'application/pdf'});}};}
  };
  vm.runInNewContext(source,{window:w,URL,Blob,Uint8Array,String});
  await w.ExportHUBDocumentBlob1059.fetchBlob({name:'DNC.pdf',storage:'blob',blobName:'rc1059/testservice/aa/'+'a'.repeat(64)});
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.headers['X-ExportHUB-Token'],'T');
  assert.equal(calls[0].options.redirect,'manual');
});

test('der TESTSERVICE-API-Wrapper übernimmt credentials omit statt das Cookie zu erzwingen',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/nextInit\.credentials = init && init\.credentials === 'omit' \? 'omit' : 'same-origin';/,file);
  }
});
