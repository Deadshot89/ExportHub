import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { patchRc1716PodBatchHtml } from '../scripts/rc1716-pod-batch-completeness.mjs';

// Exercise the actual generated POD controller, not an unrelated ZIP library.
// Input data is synthetic and stays entirely inside the Node regression.
const html=patchRc1716PodBatchHtml(fs.readFileSync('index.html','utf8'),'production');
const marker='<script id="rc455-pod-backup-controller">';
const start=html.indexOf(marker),end=html.indexOf('</script>',start);
assert.ok(start>=0&&end>start,'canonical batch ZIP controller must be present');
const controller=html.slice(start+marker.length,end);

const helpersStart=controller.indexOf('var crcTable=');
const zipStart=controller.indexOf('function zip(entries){',helpersStart);
const zipLineEnd=controller.indexOf('\n',zipStart);
assert.ok(helpersStart>=0&&zipStart>helpersStart&&zipLineEnd>zipStart,
 'actual ZIP writer and CRC helpers must have an extractable source boundary');
const zip=new Function('q','TextEncoder','Blob',
 controller.slice(helpersStart,zipLineEnd)+'\nreturn zip;')(
 x=>String(x??'').trim(),TextEncoder,Blob
);

const stageFrom=controller.indexOf('/* RC1957_SHA256_START */');
const stageEnd=controller.indexOf('/* RC1957_SHA256_END */',stageFrom);
assert.ok(stageFrom>=0&&stageEnd>stageFrom,'SHA-256 manifest is in the ZIP controller');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const hashStage=new AsyncFunction('entries','fail','globalThis','uniqueArchiveEntries','TextEncoder',
 controller.slice(stageFrom,stageEnd)+'\nreturn {entries,fail};'
);
const normalizeStart=controller.indexOf('function uniqueArchiveEntries(entries){');
assert.ok(normalizeStart>=0&&normalizeStart<zipStart);
const normalize=new Function('q',
 controller.slice(normalizeStart,zipStart)+'\nreturn uniqueArchiveEntries;'
)(x=>String(x??'').trim());

function u16(v,p){return v.getUint16(p,true)}
function u32(v,p){return v.getUint32(p,true)}
function crc32(data){
 let c=0xffffffff;
 for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1)}
 return (c^0xffffffff)>>>0;
}
function readActualStoredZip(raw){
 const v=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 assert.ok(raw.byteLength>=22,'ZIP must have an end-of-central-directory record');
 const tail=raw.byteLength-22;
 assert.equal(u32(v,tail),0x06054b50,'valid ZIP end-of-central-directory');
 const count=u16(v,tail+10),centralSize=u32(v,tail+12),centralStart=u32(v,tail+16);
 assert.equal(u16(v,tail+8),count,'ZIP directory counts agree');
 assert.equal(centralStart+centralSize,tail,'directory ends at ZIP footer');
 const decoder=new TextDecoder('utf-8',{fatal:true});
 const result=new Map();
 let offset=centralStart;
 for(let i=0;i<count;i++){
  assert.equal(u32(v,offset),0x02014b50,'central directory entry');
  assert.equal(u16(v,offset+10),0,'PDFs and checksum manifest stored without compression');
  const expectedCrc=u32(v,offset+16),size=u32(v,offset+24);
  assert.equal(u32(v,offset+20),size,'stored/compressed sizes agree');
  const nameLength=u16(v,offset+28),extraLength=u16(v,offset+30),commentLength=u16(v,offset+32);
  const name=decoder.decode(raw.subarray(offset+46,offset+46+nameLength));
  const localOffset=u32(v,offset+42);
  assert.equal(u32(v,localOffset),0x04034b50,'referenced local header exists');
  assert.equal(u16(v,localOffset+8),0,'local entry has no compression');
  const localNameLength=u16(v,localOffset+26),localExtraLength=u16(v,localOffset+28);
  const localName=decoder.decode(raw.subarray(localOffset+30,localOffset+30+localNameLength));
  assert.equal(localName,name,'local and central names match');
  const dataStart=localOffset+30+localNameLength+localExtraLength;
  const data=raw.subarray(dataStart,dataStart+size);
  assert.equal(data.length,size,'entry contains all declared bytes');
  assert.equal(crc32(data),expectedCrc,'entry CRC-32 matches recovered bytes');
  assert.equal(result.has(name),false,'duplicate ZIP filename would overwrite a POD');
  result.set(name,Buffer.from(data));
  offset+=46+nameLength+extraLength+commentLength;
 }
 assert.equal(offset,tail,'all directory entries accounted for');
 assert.equal(result.size,count,'no hidden or omitted central-directory files');
 return result;
}
const bytes=s=>new Uint8Array(Buffer.from(s));
const digest=data=>createHash('sha256').update(data).digest('hex');

test('RC1957: real POD ZIP round-trip preserves all signed/manual originals and SHA256SUMS',async()=>{
 const original=bytes('%PDF-1.7\nSIGNED ORIGINAL A');
 const manual=bytes('%PDF-1.7\nMANUALLY UPLOADED B');
 const other=bytes('%PDF-2.0\nSIGNED ORIGINAL C');
 const input=[
  {name:'POD_ABC123.pdf',data:original},
  {name:'pod_abc123.PDF',data:manual},
  {name:'POD_Änderung_équipe.pdf',data:other}
 ];
 const hashed=await hashStage(input.map(x=>({name:x.name,data:x.data.slice()})),[],
  {crypto:webcrypto},normalize,TextEncoder);
 assert.deepEqual(hashed.fail,[],'every original must be hashable');
 assert.equal(hashed.entries.length,4,'three PDFs and one checksum list');
 const archive=new Uint8Array(await zip(hashed.entries).arrayBuffer());
 const restored=readActualStoredZip(archive);
 assert.equal(restored.size,4,'all ZIP entries can be re-read');
 const expected=new Map(hashed.entries.map(x=>[x.name,Buffer.from(x.data)]));
 for(const [name,data] of expected){
  assert.deepEqual(restored.get(name),data,'ZIP re-read must be byte-exact: '+name);
 }
 const manifest=restored.get('SHA256SUMS.txt').toString('utf8').trim().split('\n');
 const actualPdfFiles=[...expected].filter(([name])=>/\.pdf$/i.test(name));
 assert.equal(manifest.length,actualPdfFiles.length);
 for(let i=0;i<actualPdfFiles.length;i++){
  const [name,data]=actualPdfFiles[i];
  assert.equal(manifest[i],digest(restored.get(name))+'  '+name,
   'SHA-256 manifest must match the recovered archive entry');
  assert.deepEqual(restored.get(name),data);
 }
 assert.deepEqual(Buffer.from(original),Buffer.from(input[0].data));
 assert.deepEqual(Buffer.from(manual),Buffer.from(input[1].data));
 assert.deepEqual(Buffer.from(other),Buffer.from(input[2].data));
});
