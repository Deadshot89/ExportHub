import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8')}

function functionBlock(file,name,nextName){
  const html=read(file);
  const marker=`function ${name}`;
  const start=html.indexOf(marker);
  assert.ok(start>=0,`${file}: ${name} fehlt`);
  let end=-1;
  if(nextName)end=html.indexOf(`function ${nextName}`,start+marker.length);
  if(end<=start)end=html.indexOf('function ',start+marker.length);
  assert.ok(end>start,`${file}: Ende von ${name} fehlt`);
  return html.slice(start,end);
}

function assertCompiles(file,name,nextName){
  const src=functionBlock(file,name,nextName);
  assert.doesNotThrow(
    ()=>new Function(`"use strict";\n${src}\nreturn ${name};`),
    `${file}: ${name} enthaelt ungueltige JavaScript-Syntax`
  );
}

function assertInsideScript(file,name){
  const html=read(file);
  const start=html.indexOf(`function ${name}`);
  assert.ok(start>=0,`${file}: ${name} fehlt`);
  const open=html.lastIndexOf('<script',start);
  const close=html.lastIndexOf('</script',start);
  assert.ok(open>close,`${file}: ${name} liegt ausserhalb eines Scriptblocks`);
  assert.ok(html.indexOf('</script',start)>start,`${file}: Scriptblock nach ${name} wird nicht geschlossen`);
}

for(const file of ['TESTVERSION.html','index.html']){
  test(`RC1003 ${file}: Aufgaben-Gruppenblock ist gueltiges JavaScript`,()=>{
    assertCompiles(file,'taskGroupNameRC874','taskGroupOpenRC874');
  });

  test(`RC1003 ${file}: Aufgaben-Reihenfolge ist gueltiges JavaScript`,()=>{
    assertCompiles(file,'areaOrderRC67');
  });

  test(`RC1003 ${file}: Aufgabenfunktionen liegen in einem Scriptblock`,()=>{
    assertInsideScript(file,'taskGroupNameRC874');
    assertInsideScript(file,'areaOrderRC67');
  });
}
