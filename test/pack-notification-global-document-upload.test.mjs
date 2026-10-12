import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {injectDocumentUploadRuntime} from '../.github/packmeldungen/build-three-env.mjs';

class FakeFile{
  constructor(parts,name,options={}){this.parts=parts;this.name=name;this.type=options.type||'';this.lastModified=options.lastModified||0;}
}
class FakeDataTransfer{
  constructor(){const values=[];this.items={add:file=>values.push(file)};Object.defineProperty(this,'files',{get:()=>values});}
}

function load(){
  const source=fs.readFileSync('assets/document-upload-normalizer.js','utf8');
  let changeHandler=null;
  const document={addEventListener(type,handler,capture){if(type==='change'&&capture===true)changeHandler=handler;}};
  const root={
    document,
    File:FakeFile,
    DataTransfer:FakeDataTransfer,
    Event:class{constructor(type,options={}){this.type=type;this.bubbles=!!options.bubbles;}},
    queueMicrotask:fn=>fn(),
    setTimeout,
    ExportHubDocumentReferenceNormalizer:{
      async normalizePdfFile(file){
        if(file.name==='scanner.pdf')return{name:'DNC3019222063.pdf',renamed:true,reference:'DNC3019222063',reason:'dncs'};
        return{name:file.name,renamed:false,reference:null,reason:'none'};
      }
    }
  };
  root.window=root;root.globalThis=root;
  vm.runInContext(source,vm.createContext(root),{filename:'document-upload-normalizer.js'});
  return{api:root.ExportHubDocumentUploadNormalizer,changeHandler};
}

test('global upload normalizer replaces only uniquely recognized PDFs and preserves file metadata',async()=>{
  const {api}=load();
  const pdf={name:'scanner.pdf',type:'application/pdf',lastModified:123,arrayBuffer:async()=>new ArrayBuffer(0)};
  const png={name:'photo.png',type:'image/png',lastModified:456};
  const out=await api.normalizeFiles([pdf,png]);
  assert.equal(out.length,2);
  assert.equal(out[0].name,'DNC3019222063.pdf');
  assert.equal(out[0].type,'application/pdf');
  assert.equal(out[0].lastModified,123);
  assert.equal(out[0].parts[0],pdf,'binary source must remain the original File');
  assert.equal(out[1],png,'non-PDF files must remain untouched');
});

test('global upload normalizer recognizes legacy application/x-pdf files as PDFs',()=>{
  const {api}=load();
  assert.equal(api.isPdf({name:'legacy.pdf',type:'application/x-pdf'}),true);
  assert.equal(api.isPdf({name:'legacy.pdf',type:'image/png'}),false);
});

test('capture handler rewrites input.files before redispatching change to existing upload handlers',async()=>{
  const {changeHandler}=load();
  assert.equal(typeof changeHandler,'function');
  const original={name:'scanner.pdf',type:'application/pdf',lastModified:123,arrayBuffer:async()=>new ArrayBuffer(0)};
  const dispatched=[];
  const input={
    type:'file',files:[original],disabled:false,
    dispatchEvent:event=>{dispatched.push(event);return true;}
  };
  let stopped=false;
  await changeHandler({target:input,stopImmediatePropagation(){stopped=true;}});
  assert.equal(stopped,true,'original change event must not reach legacy handlers before rename finishes');
  assert.equal(input.files[0].name,'DNC3019222063.pdf');
  assert.equal(dispatched.length,1,'normalized input must emit exactly one replacement change event');
  assert.equal(dispatched[0].type,'change');
});

test('main build copies and injects global upload runtime after the shared document normalizer',()=>{
  const build=fs.readFileSync('.github/packmeldungen/build-three-env.mjs','utf8');
  assert.match(build,/document-upload-normalizer\.js/);
  const normalizer=build.indexOf('exporthub-document-reference-normalizer');
  const upload=build.indexOf('exporthub-document-upload-normalizer');
  assert.ok(normalizer>=0,'shared document normalizer script missing');
  assert.ok(upload>normalizer,'upload runtime must execute after document reference normalizer');
});

test('public customer avis receives only the shared PDF upload runtime, not internal pack modules',()=>{
  const html=injectDocumentUploadRuntime('<!doctype html><html><head><title>Avis</title></head><body></body></html>','customer-avis.html');
  const reference=html.indexOf('exporthub-document-reference-normalizer');
  const upload=html.indexOf('exporthub-document-upload-normalizer');
  assert.ok(reference>=0,'customer avis must load the reference normalizer');
  assert.ok(upload>reference,'customer avis must load upload normalization after reference extraction');
  assert.doesNotMatch(html,/pack-notification-internal|pack-notification-shipment|pack-notification-avis/,'public avis must not receive internal pack runtimes');
});

test('production final verification applies document normalization to customer avis deployment output',()=>{
  const verify=fs.readFileSync('.github/rc1121/verify-final-html.mjs','utf8');
  assert.match(verify,/packmeldungen\/build-three-env\.mjs/,'production finalizer must import the pack runtime helper');
  assert.match(verify,/copyPackFiles\(ROOT,OUT\)/,'production finalizer must copy pack and document-normalizer assets');
  assert.match(verify,/injectPackRuntime\(html,file\)/,'production finalizer must inject the document normalizer into final app HTML');
  assert.match(verify,/customer-avis\.html/,'production finalizer must include the public customer avis page');
  assert.match(verify,/injectDocumentUploadRuntime\(avisHtml,'customer-avis\.html'\)/,'customer avis must receive the upload normalizer in the final deployment output');
});
