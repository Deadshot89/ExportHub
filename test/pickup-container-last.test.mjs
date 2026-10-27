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

test('Sendungsansicht shipmentview zeigt gespeicherte Containerfotos als Vorschaukarten',()=>{
  const script=fs.readFileSync(path.join(ROOT,'assets/rc1014-shipment-overview.js'),'utf8');
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.classList={add(){}}}
    appendChild(child){this.children.push(child);return child}
    setAttribute(name,value){this.attributes[name]=value}
    querySelector(){return null}
    addEventListener(){}
  }
  const host=new Element('section');host.insertBefore=child=>host.appendChild(child);
  const docsCard=new Element('section');docsCard.parentNode=host;docsCard.nextSibling=null;
  const hiddenEditHost=new Element('section');
  const shipment={id:'S1',reference:'ABC123',sealNumber:'SEAL123',containerPhotos:[
    {id:'container-loaded',kind:'loaded',label:'Geladener Container',name:'01_Geladener_Container_ABC123.jpg',referenceFolderSaved:true},
    {id:'container-number',kind:'number',label:'Container-Nummer',name:'02_Container_Nummer_ABC123.jpg',referenceFolderSaved:true},
    {id:'container-sealed',kind:'sealed',label:'Versiegelt',name:'03_Versiegelt_ABC123.jpg',referenceFolderSaved:true}
  ]};
  const context={
    document:{body:{getAttribute(name){return name==='data-exporthub-view'?'shipmentview':''}},getElementById(id){return id==='rc786ReferenceFilesCard'?docsCard:id==='rc363BlockShipment'?hiddenEditHost:null},querySelector(){return null},createElement:tag=>new Element(tag)},
    __EXPORTHUB_GET_STATE__:()=>({view:'shipmentview',shipmentViewId:'S1',shipments:[shipment]}),
    setTimeout(){return 1},console,
  };
  vm.runInNewContext(script,context);
  assert.equal(context.ExportHUBRC1014ShipmentOverview.enhanceShipmentDetailedView(),true,'Containerbereich muss in der echten Sendungsansicht eingehängt werden');
  const panel=host.children[0];
  assert.ok(panel);
  const photos=[];function walk(node){if(node.tag==='img')photos.push(node);for(const child of node.children||[])walk(child)}walk(panel);
  assert.deepEqual(photos.map(img=>img.attributes['data-rc1259-photo-id']),['container-loaded','container-number','container-sealed']);
  assert.equal(context.ExportHUBRC1014ShipmentOverview.enhanceShipmentConfig(),false,'Nur-Lesen-Sendungsansicht darf auch bei altem versteckten Formular keinen Container-Editor öffnen');
});
