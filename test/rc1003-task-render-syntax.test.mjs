import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function taskGroupBlock(file){
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function taskGroupNameRC874(t){');
  const end=html.indexOf('function taskGroupOpenRC874',start);
  assert.ok(start>=0,`${file}: taskGroupNameRC874 fehlt`);
  assert.ok(end>start,`${file}: Ende des Aufgaben-Gruppenblocks fehlt`);
  return html.slice(start,end);
}

for(const file of ['TESTVERSION.html','index.html']){
  test(`RC1003 ${file}: Aufgaben-Gruppenblock ist gueltiges JavaScript`,()=>{
    const src=taskGroupBlock(file);
    assert.doesNotThrow(
      ()=>new Function(`"use strict";\n${src}\nreturn taskGroupNameRC874;`),
      `${file}: Aufgaben-Gruppenblock enthaelt ungueltige JavaScript-Syntax`
    );
  });
}
