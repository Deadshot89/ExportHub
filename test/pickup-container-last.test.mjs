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

async function pickupHarness(photoUploadResponse){
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
  const document={getElementById:el,createElement(name){
    if(name==='canvas')return{width:0,height:0,getContext(){return{fillRect(){},drawImage(){}}},toDataURL(){return'data:image/jpeg;base64,'+'A'.repeat(2048)}};
    return el(name);
  }};
  const status={reference:'ABC123',shipmentId:'S1',customer:'Testkunde',address:'Teststraße 1',expectedColliCount:3,remainingPickupCollis:3,containerDocumentationRequired:true,containerPhotos:[]};
  const context={
    document,URL,location:{href:'https://exporthub360.com/pickup.html?pickup=abcdef123456',hostname:'exporthub360.com'},
    window:{},
    Image:class{constructor(){this.naturalWidth=800;this.naturalHeight=600}set src(_){this.onload?.()}},
    FileReader:class{readAsDataURL(){this.result='data:image/jpeg;base64,'+'A'.repeat(2048);this.onload?.()}},
    fetch:async url=>({ok:true,text:async()=>JSON.stringify(String(url).includes('pickup-container-document')?photoUploadResponse:status)}),
    setTimeout(callback){callback();return 1},clearTimeout(){},
    console,
  };
  vm.runInNewContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  return{el,events};
}

test('Nach Colli-Prüfung öffnet sich der Fahrerbereich trotz noch fehlender Pflichtfotos',async()=>{
  const{el,events}=await pickupHarness();
  assert.equal(el('driverStep').hidden,true,'Fahrer ist vor dem Colli-Check gesperrt');
  el('colli').value='3';
  const check=events.get('checkColli:click');assert.equal(typeof check,'function');
  check();
  assert.equal(el('driverStep').hidden,false,'Fahrer muss direkt nach korrekter Colli-Prüfung zugänglich sein');
  assert.equal(el('containerSection').hidden,false,'Fotos sind am Ende des Formulars zugänglich');
  assert.equal(el('confirm').hidden,false,'Abschlussknopf existiert nach dem Containerabschnitt');
});

test('QR-Foto meldet keinen Speichererfolg, wenn die Ref-Ordner-Kopie nicht bestätigt ist',async()=>{
  const{el,events}=await pickupHarness({ok:true,storedUnderReference:true,linkedToShipment:true,photo:{id:'container-loaded',kind:'loaded',referenceFolderSaved:false},containerPhotos:[{id:'container-loaded',kind:'loaded'}]});
  el('colli').value='3';events.get('checkColli:click')();
  el('containerPhotoLoaded').files=[{name:'container.jpg'}];
  events.get('containerPhotoLoaded:change')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(el('containerResult').textContent,/nicht vollständig bestätigt|nicht bestätigt/i);
  assert.doesNotMatch(el('containerResult').textContent,/✓ Foto wurde im Referenzordner/);
});

test('QR-Foto bestätigt Speichererfolg bei Ref-Ordner-Ablage und Sendungsverknüpfung',async()=>{
  const photo={id:'container-loaded',kind:'loaded',referenceFolderSaved:true};
  const{el,events}=await pickupHarness({ok:true,storedUnderReference:true,linkedToShipment:true,photo,containerPhotos:[photo]});
  el('colli').value='3';events.get('checkColli:click')();
  el('containerPhotoLoaded').files=[{name:'container.jpg'}];
  events.get('containerPhotoLoaded:change')();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(el('containerResult').textContent,/✓ Foto wurde im Referenzordner/);
  assert.match(el('containerStateLoaded').textContent,/✓ Gespeichert/);
});
