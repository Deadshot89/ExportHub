import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {patchRc1602PodBrowserHtml} from '../scripts/rc1602-pod-browser-pagination.mjs';
const raw=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const patched=patchRc1602PodBrowserHtml(raw);
function helper(name){
  const start=patched.indexOf('function '+name+'(');
  if(start<0)throw Error('missing '+name);
  const next=patched.indexOf('\nfunction ',start+9);
  const end=next<0?patched.indexOf('async function createPdf(',start):next;
  const slice=patched.slice(start,end);
  return new Function('bytesFromDataUrl',slice+'\nreturn '+name+';')(()=>new Uint8Array([1,2,3]));
}
test('RC1602: every real browser POD packaging row is retained; patch is idempotent',()=>{
  assert.ok(raw.includes("rowHtml=(rs.length?rs:[{}]).slice(0,12).map("));
  assert.ok(!patched.includes("rowHtml=(rs.length?rs:[{}]).slice(0,12).map("));
  assert.ok(patched.includes("rowHtml=(rs.length?rs:[{}]).map(function(r,i)"));
  assert.equal(patchRc1602PodBrowserHtml(patched),patched);
});
test('RC1602: real POD path validates original signature and paginates, normal print unchanged',()=>{
  assert.ok(patched.includes("if(outputMode==='pod')index352AssertRealPodSignature(node)"));
  assert.ok(patched.includes("if(outputMode==='pod')images.push.apply(images,index352PodRasterPages(canvas,node,jpegQuality))"));
  assert.ok(patched.includes("else images.push({bytes:bytesFromDataUrl(canvas.toDataURL('image/jpeg',jpegQuality))"));
  assert.ok(patched.includes("if(outputMode==='pod')index352PreparePodPage(node)"));
});
test('RC1602: 3+ A4 raster pages with no resized photo and safe bottom padding',()=>{
  const paginate=helper('index352PodRasterPages');
  const draws=[],rect={top:0,bottom:4000,left:0,right:1200,width:1200,height:4000};
  const doc={createElement:()=>({
    width:0,height:0,getContext:()=>({
      fillRect(...a){draws.push({type:'background',a})},
      drawImage(...a){draws.push({type:'copy',a})},
      set fillStyle(_){} }),
    toDataURL:()=> 'data:image/jpeg;base64,AA=='
  })};
  const node={ownerDocument:doc,getBoundingClientRect:()=>rect,
    querySelector:()=>({getBoundingClientRect:()=>({top:1500,bottom:1850})})};
  const result=paginate({width:1200,height:4100},node,.96);
  assert.ok(result.length>=3);
  const expectedHeight=Math.floor(1200*842/595);
  assert.ok(result.every(p=>p.width===1200&&p.height===expectedHeight));
  const regions=draws.filter(x=>x.type==='copy').map(x=>({from:x.a[2],height:x.a[4]}));
  assert.equal(regions[0].from,0);
  assert.ok(regions[0].height<expectedHeight,'signature group must move intact to the next page');
  let total=0;regions.forEach((r,i)=>{if(i)assert.equal(r.from,regions[i-1].from+regions[i-1].height);total+=r.height});
  assert.equal(total,4100,'no source pixels may be dropped');
});
test('RC1602: missing/undecodable real signature blocks misleading customer POD',()=>{
  const assertSignature=helper('index352AssertRealPodSignature');
  const root=imgs=>({querySelectorAll:()=>imgs});
  assert.throws(()=>assertSignature(root([])),/Original-Fahrerunterschrift/);
  assert.throws(()=>assertSignature(root([{complete:true,naturalWidth:0,naturalHeight:0}])),/Original-Fahrerunterschrift/);
  assert.doesNotThrow(()=>assertSignature(root([{complete:true,naturalWidth:212,naturalHeight:70}])));
});
test('RC1602: fail closed if either server PDF code path changes',()=>{
  assert.throws(()=>patchRc1602PodBrowserHtml(raw.replace("rowHtml=(rs.length?rs:[{}]).slice(0,12).map(","rowHtml=tooShort.map(")),/RC1602 P0 renderer anchor/);
  assert.throws(()=>patchRc1602PodBrowserHtml(raw.replace("async function createPdf(mode,sh){","async function anotherPdf(mode,sh){")),/RC1602 P0 renderer anchor/);
});
