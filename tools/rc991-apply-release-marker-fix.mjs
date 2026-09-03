import fs from 'node:fs';

const path='TESTVERSION.html';
let html=fs.readFileSync(path,'utf8');

function replaceExactlyOnce(label,oldText,newText){
  const parts=html.split(oldText);
  if(parts.length!==2){
    throw new Error(`${label}: erwartet genau 1 Treffer, gefunden ${parts.length-1}`);
  }
  html=parts[0]+newText+parts[1];
}

replaceExactlyOnce(
  'RC991 Build-Marker',
  "var BUILD=Object.freeze({version:'RC990',cache:'990',loginReturn:'/TESTVERSION.html?v=990'});",
  "var BUILD=Object.freeze({version:'RC991',cache:'991',loginReturn:'/TESTVERSION.html?v=991'});"
);

replaceExactlyOnce(
  'RC991 Release-Metadaten und Änderung',
  "var RELEASE=Object.freeze({\n version:'RC885',\n date:'31.08.2026',\n title:'Persönlicher Arbeitsplatz und Warncenter neu aufgebaut',\n changes:Object.freeze([",
  "var RELEASE=Object.freeze({\n version:'RC991',\n date:'03.09.2026',\n title:'Release-Center Produktionspaket abgesichert',\n changes:Object.freeze([\n    'RC991 verhindert, dass ein älterer TESTSERVICE-Snapshot den geprüften Produktions-index oder den aktuellen Produktionsmarker überschreibt. Autoritative Release-Dateien werden erst nach Snapshot und Zusatzassets gesetzt.' ,"
);

replaceExactlyOnce(
  'RC991 Release-Testpunkt',
  " tests:Object.freeze([",
  " tests:Object.freeze([\n   'RC991 Release-Paket: Mit einem absichtlich älteren Snapshot prüfen, dass index.html und production-version.js im erzeugten ZIP trotzdem exakt zur aktiven RC991 gehören.',"
);

replaceExactlyOnce(
  'RC991 releaseFiles Start',
  "function releaseFiles(indexHtml,bundle){var files={'index.html':indexHtml,'production-version.js':\"window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='\"+VERSION+\"';\"},snap=bundle&&bundle.files||{},extra=RELEASE_ASSETS||{};",
  "function releaseFiles(indexHtml,bundle){var files={},snap=bundle&&bundle.files||{},extra=RELEASE_ASSETS||{};"
);

replaceExactlyOnce(
  'RC991 autoritative Release-Dateien',
  "Object.keys(extra).forEach(function(path){var safe=releasePath(path),item=extra[path],content=item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'content')?item.content:item;if(safe&&(typeof content==='string'||content instanceof Uint8Array))files[safe]=content});REQUIRED_RELEASE_FILES.forEach(function(path){",
  "Object.keys(extra).forEach(function(path){var safe=releasePath(path),item=extra[path],content=item&&typeof item==='object'&&Object.prototype.hasOwnProperty.call(item,'content')?item.content:item;if(safe&&(typeof content==='string'||content instanceof Uint8Array))files[safe]=content});files['index.html']=indexHtml;files['production-version.js']=\"window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='\"+VERSION+\"';\";REQUIRED_RELEASE_FILES.forEach(function(path){"
);

if(!html.includes("version:'RC991',cache:'991',loginReturn:'/TESTVERSION.html?v=991'"))throw new Error('RC991 Build fehlt nach Patch');
if(!html.includes("files['index.html']=indexHtml;files['production-version.js']="))throw new Error('Autoritative Release-Dateien fehlen nach Patch');

fs.writeFileSync(path,html,'utf8');
console.log('RC991 Release-Center Fix materialisiert.');
