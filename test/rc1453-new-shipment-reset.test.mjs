import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function freshBlock(html){
  const start=html.indexOf('function startFreshShipment(){');
  const end=html.indexOf('function enforceFreshDraft(){',start);
  assert.ok(start>=0&&end>start,'Fresh-Draft-Block fehlt im Build');
  return html.slice(start,end);
}

function volatileHelper(block){
  const start=block.indexOf('function resetMountedFreshVolatile(){');
  const end=block.indexOf('function resetMountedFreshDom(){',start);
  assert.ok(start>=0&&end>start,'RC1453 volatile Reset-Funktion fehlt');
  return block.slice(start,end);
}

test('RC1453: lokaler Neue-Sendung-Reset umfasst Bemerkung und Datei-Anhänge',()=>{
  assert.match(builder,/function resetMountedFreshVolatile\(\)/);
  assert.match(builder,/querySelectorAll\('textarea'\)/);
  assert.match(builder,/comment\|remark\|bemerk/);
  assert.match(builder,/querySelectorAll\('input\[type=file\]'\)/);
  assert.match(builder,/dispatchEvent\(new Event\(el\.tagName==='INPUT'\?'change':'input'/);
  assert.match(builder,/resetMountedFreshVolatile\(\);safePatchDuringEdit\(\);return true/);
});

test('RC1453: finaler Drei-Umgebungen-Build enthält den erweiterten Reset',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/function resetMountedFreshVolatile\(\)/,file+': volatile Reset-Helfer fehlt');
    assert.match(block,/querySelectorAll\('input\[type=file\]'\)/,file+': Datei-Reset fehlt');
    assert.match(block,/comment\|remark\|bemerk/,file+': Bemerkungs-Erkennung fehlt');
    assert.match(block,/resetMountedFreshVolatile\(\);safePatchDuringEdit\(\);return true/,file+': Reset wird nicht ausgeführt');
    assert.doesNotMatch(block,/if\(preserveMountedShipment\)[\s\S]{0,180}replaceChildren\(\)/,file+': RC1453 darf den Voll-Render nicht wieder einführen');
  }
});

test('RC1453: Reset leert reale Bemerkungs- und Dateiwerte und feuert Zustands-Events',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const block=freshBlock(fs.readFileSync('dist-rc1112/index.html','utf8'));
  const helper=volatileHelper(block);
  const events=[];
  const remark={
    tagName:'TEXTAREA',name:'comments',id:'',value:'Tor 4 beachten',
    getAttribute(){return''},
    closest(selector){
      if(selector==='#rc543MailArea,#rc363BlockMail')return null;
      if(selector==='[data-rc896-field]')return null;
      if(selector==='label')return{textContent:'Bemerkung'};
      return null;
    },
    dispatchEvent(event){events.push('remark:'+event.type);return true}
  };
  const file={
    tagName:'INPUT',type:'file',name:'attachments',id:'shipmentAttachments',value:'C:\\fakepath\\alt.pdf',
    dispatchEvent(event){events.push('file:'+event.type);return true}
  };
  const mountedLayout={
    querySelectorAll(selector){
      if(selector==='textarea')return[remark];
      if(selector==='input[type=file]')return[file];
      return[];
    }
  };
  class FakeEvent{
    constructor(type,options){this.type=type;this.bubbles=!!(options&&options.bubbles)}
  }
  const run=new Function('mountedLayout','Event','console',
    '"use strict";var preserveMountedShipment=true;'+helper+';resetMountedFreshVolatile();'
  );
  run(mountedLayout,FakeEvent,console);
  assert.equal(remark.value,'','Bemerkung muss beim Start einer neuen Sendung leer sein');
  assert.equal(file.value,'','Datei-Input muss beim Start einer neuen Sendung leer sein');
  assert.deepEqual(events,['remark:input','remark:change','file:change']);
});
