import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const page=fs.readFileSync(path.join(ROOT,'pickup.html'),'utf8');

test('QR-Abholung zeigt Containerfotos nach Fahrerbestätigung und unmittelbar vor Abschluss',()=>{
  const form=page.slice(page.indexOf('<form id="form"'),page.indexOf('</form>'));
  const position=id=>form.indexOf('id="'+id+'"');
  assert.ok(position('colliSection')>=0);
  assert.ok(position('details')>position('colliSection'));
  assert.ok(position('driverStep')>position('details'));
  assert.ok(position('signatureData')>position('driverStep'));
  assert.ok(position('containerSection')>position('signatureData'));
  assert.ok(position('confirmPartial')>position('containerSection'));
  assert.ok(position('stepDriver')<position('stepConfirm'));
  assert.ok(position('stepConfirm')<position('stepContainer'));
});

test('Nach Colli-Prüfung öffnet sich der Fahrerbereich trotz noch fehlender Pflichtfotos',async()=>{
  const script=page.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script,'QR-Abholung benötigt ausführbaren Seitencode');
  const elements=new Map(),events=new Map();
  function el(id){
    if(!elements.has(id)){
      const element={id,value:'',hidden:true,style:{},dataset:{},checked:id==='modeComplete',disabled:false,
        classList:{toggle(){},add(){}},
        addEventListener(name,callback){events.set(id+':'+name,callback)},
        focus(){},
        getContext(){return{fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},closePath(){}}}
      };
      elements.set(id,element);
    }
    return elements.get(id);
  }
  const document={getElementById:el};
  const status={reference:'ABC123',shipmentId:'S1',customer:'Testkunde',address:'Teststraße 1',expectedColliCount:3,remainingPickupCollis:3,containerDocumentationRequired:true,containerPhotos:[]};
  const context={
    document,URL,location:{href:'https://exporthub360.com/pickup.html?pickup=abcdef123456',hostname:'exporthub360.com'},
    window:{},Image:class{},FileReader:class{},
    fetch:async()=>({ok:true,text:async()=>JSON.stringify(status)}),
    setTimeout(callback){callback();return 1},clearTimeout(){},
    console,
  };
  vm.runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(el('driverStep').hidden,true,'Fahrer ist vor dem Colli-Check gesperrt');
  el('colli').value='3';
  const check=events.get('checkColli:click');assert.equal(typeof check,'function');
  check();
  assert.equal(el('driverStep').hidden,false,'Fahrer muss direkt nach korrekter Colli-Prüfung zugänglich sein');
  assert.equal(el('containerSection').hidden,false,'Fotos sind am Ende des Formulars zugänglich');
  assert.equal(el('confirm').hidden,false,'Abschlussknopf existiert nach dem Containerabschnitt');
});
