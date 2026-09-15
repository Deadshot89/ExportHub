import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('RC1124 pickup inline JavaScript parses without syntax errors',()=>{
  const html=fs.readFileSync('pickup.html','utf8');
  const blocks=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  assert.ok(blocks.length>0,'pickup.html enthält kein Inline-JavaScript');
  for(let i=0;i<blocks.length;i++){
    assert.doesNotThrow(()=>new vm.Script(blocks[i],{filename:'pickup-inline-'+(i+1)+'.js'}),'Inline-Script '+(i+1)+' ist syntaktisch ungültig');
  }
});
