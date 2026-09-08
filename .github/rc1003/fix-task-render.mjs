import fs from 'node:fs';
import vm from 'node:vm';

const files=['TESTVERSION.html','index.html'];

function replaceEscapedNewlines(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<=start)throw new Error(`${startMarker}: Blockgrenzen nicht gefunden`);
  const block=source.slice(start,end);
  const fixed=block.replace(/\\\r?\n/g,'\n');
  if(fixed===block)throw new Error(`${startMarker}: keine fehlerhaften Backslash-Zeilen gefunden`);
  return source.slice(0,start)+fixed+source.slice(end);
}

function compileFunction(source,name,nextName){
  const marker=`function ${name}`;
  const start=source.indexOf(marker);
  let end=nextName?source.indexOf(`function ${nextName}`,start+marker.length):-1;
  if(end<=start)end=source.indexOf('function ',start+marker.length);
  if(start<0||end<=start)throw new Error(`${name}: Funktionsblock nicht gefunden`);
  new vm.Script(source.slice(start,end),{filename:`${name}.js`});
}

for(const file of files){
  let html=fs.readFileSync(file,'utf8');
  html=replaceEscapedNewlines(html,'function taskGroupNameRC874(t){','function taskGroupOpenRC874');
  html=replaceEscapedNewlines(html,'function areaOrderRC67(','function ');
  compileFunction(html,'taskGroupNameRC874','taskGroupOpenRC874');
  compileFunction(html,'areaOrderRC67');
  fs.writeFileSync(file,html,'utf8');
  console.log(`${file}: Aufgaben-JavaScript repariert`);
}
