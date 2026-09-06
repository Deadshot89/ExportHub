import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const RELEASE_DATE='06.09.2026';
const VERSION='RC1000';
const CACHE='1000';

function count(text,needle){return text.split(needle).length-1;}
function assertCount(text,needle,expected,label){
  const actual=count(text,needle);
  if(actual!==expected) throw new Error(`${label}: erwartet ${expected}, gefunden ${actual}`);
}
function replaceOnce(text,oldValue,newValue,label){
  assertCount(text,oldValue,1,label);
  return text.replace(oldValue,newValue);
}
function owner(text,start,end,label){
  const a=text.indexOf(start);
  if(a<0) throw new Error(`${label}: Startmarker fehlt`);
  const b=text.indexOf(end,a+start.length);
  if(b<0) throw new Error(`${label}: Endmarker fehlt`);
  return {a,b,block:text.slice(a,b)};
}
function patchOwner(text,start,end,transform,label){
  const {a,b,block}=owner(text,start,end,label);
  const next=transform(block);
  if(next===block) throw new Error(`${label}: keine Änderung erzeugt`);
  return text.slice(0,a)+next+text.slice(b);
}
function findMatching(text,openPos,openChar,closeChar){
  let depth=0,quote=null,escape=false;
  for(let i=openPos;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escape){escape=false;continue;}
      if(ch==='\\'){escape=true;continue;}
      if(ch===quote) quote=null;
      continue;
    }
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch===openChar) depth++;
    else if(ch===closeChar){depth--;if(depth===0)return i;}
  }
  throw new Error(`Kein passendes ${closeChar} für Position ${openPos}`);
}
function findUniqueMarker(block,markers,label){
  const hits=markers.filter(marker=>count(block,marker)===1);
  if(hits.length!==1) throw new Error(`${label}: kein eindeutiger Marker (${hits.length})`);
  return hits[0];
}
function addSearchValues(block,markers,values,label){
  const marker=findUniqueMarker(block,Array.isArray(markers)?markers:[markers],label+' marker');
  const markerPos=block.indexOf(marker);
  const callPos=block.lastIndexOf('add(',markerPos);
  if(callPos<0) throw new Error(`${label}: add-Aufruf nicht gefunden`);
  const open=callPos+3;
  const close=findMatching(block,open,'(',')');
  if(close<markerPos) throw new Error(`${label}: Marker liegt außerhalb des add-Aufrufs`);
  return block.slice(0,close)+`,[${values.join(',')}]`+block.slice(close);
}
function patchAddFunction(block,file){
  const marker='function add(type,title,sub,view,action)';
  assertCount(block,marker,1,`${file}: add Signatur`);
  const fnStart=block.indexOf(marker);
  const brace=block.indexOf('{',fnStart+marker.length);
  const fnEnd=findMatching(block,brace,'{','}');
  let fn=block.slice(fnStart,fnEnd+1);
  fn=fn.replace(marker,'function add(type,title,sub,view,action,searchValues)');
  const hayStart=fn.indexOf('hay:low(');
  if(hayStart<0) throw new Error(`${file}: hay:low im add-Helfer fehlt`);
  const lowOpen=fn.indexOf('(',hayStart+'hay:low'.length);
  const lowClose=findMatching(fn,lowOpen,'(',')');
  fn=fn.slice(0,hayStart)+"hay:low([title,sub,...(searchValues||[])].map(searchText).join(' '))"+fn.slice(lowClose+1);
  const helper="function searchText(v){if(v==null)return '';if(Array.isArray(v))return v.map(searchText).join(' ');if(typeof v==='object')return Object.values(v).map(searchText).join(' ');return String(v);}\n";
  return block.slice(0,fnStart)+helper+fn+block.slice(fnEnd+1);
}
function updateLoginVersion(value){
  if(/([?&])v=\d+/.test(value)) return value.replace(/([?&])v=\d+/,'$1v=1000');
  return value+(value.includes('?')?'&':'?')+'v=1000';
}

for(const file of FILES){
  let html=fs.readFileSync(file,'utf8');

  const buildMatch=html.match(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']+)'\}\);/);
  if(!buildMatch) throw new Error(`${file}: BUILD-Metadaten nicht gefunden`);
  const nextLogin=updateLoginVersion(buildMatch[1]);
  html=replaceOnce(html,buildMatch[0],`var BUILD=Object.freeze({version:'${VERSION}',cache:'${CACHE}',loginReturn:'${nextLogin}'});`,`${file}: BUILD`);

  html=patchOwner(html,'var RELEASE=Object.freeze({','changes:Object.freeze([',(block)=>{
    const versions=[...block.matchAll(/version:'RC\d+'/g)];
    const dates=[...block.matchAll(/date:'[^']*'/g)];
    if(versions.length!==1||dates.length!==1) throw new Error(`${file}: RELEASE nicht eindeutig`);
    return block.replace(versions[0][0],`version:'${VERSION}'`).replace(dates[0][0],`date:'${RELEASE_DATE}'`);
  },`${file}: RELEASE`);

  html=patchOwner(html,'(function initIndex321(){','})();',(block)=>{
    let next=patchAddFunction(block,file);
    next=addSearchValues(next,'selectedCustomerId=c.id;go("customers")',[
      'c.accountNo','c.address','c.addressLine','c.city','c.zip','c.location','c.locations','c.contact','c.contactEmail','c.email1'
    ],`${file}: Kundensuche`);
    next=addSearchValues(next,'selectedShipmentId=sh.id;go("shipmentoverview")',[
      'sh.customerAddress','sh.customerCity','sh.customerZip','sh.customerCountry',
      'sh.recipient','sh.recipientName','sh.recipientCity','sh.recipientZip','sh.recipientCountry',
      'sh.deliveryAddress','sh.deliveryCity','sh.deliveryZip','sh.deliveryCountry',
      'sh.destination','sh.destinationAddress','sh.destinationCity','sh.destinationZip','sh.destinationCountry',
      'sh.shipTo','sh.shipToName','sh.shipToCity','sh.shipToZip','sh.shipToCountry',
      'sh.location','sh.locationName','sh.site','sh.siteName',
      'sh.carrier','sh.carrierName','sh.forwarder','sh.forwarderName','sh.contact','sh.email'
    ],`${file}: Sendungssuche`);
    next=addSearchValues(next,['"tasks",()=>{go("tasks")}', '"tasks",()=>{go("tasks");}'],[
      't.status','t.priority','t.type','t.kind'
    ],`${file}: Aufgabensuche`);
    if(next.includes('catch(e){}')) next=next.replaceAll('catch(e){}',"catch(e){console.error('ExportHUB search navigation',e)}");
    if(!/console\.error\([^)]*search[^)]*,\s*e\)/i.test(next)) throw new Error(`${file}: Suchnavigation besitzt keine Fehlerdiagnose`);
    return next;
  },`${file}: initIndex321`);

  fs.writeFileSync(file,html);
  console.log(`${file}: RC1000 Navigation/Search materialisiert`);
}

let hub=fs.readFileSync('assets/exporthub-environment-hub.js','utf8');
const styleStart=hub.indexOf('s.textContent=`');
const styleEndNeedle='`;\n  document.head.appendChild(s);';
const styleEnd=hub.indexOf(styleEndNeedle,styleStart);
if(styleStart<0||styleEnd<0) throw new Error('Environment-Hub: Styleblock nicht gefunden');
const css=`s.textContent=\`\n#eh996-env-hub{position:relative;z-index:40;justify-self:end;align-self:center;display:inline-flex;align-items:center;gap:5px;min-height:0;margin:0 0 0 auto;padding:2px;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:rgba(248,250,252,.96);box-shadow:0 2px 8px rgba(15,23,42,.07);font:600 11.5px/1.15 system-ui,-apple-system,Segoe UI,sans-serif;max-width:100%;box-sizing:border-box}\n#eh996-env-hub button,#eh996-env-hub a{touch-action:manipulation;min-height:30px;border:0;border-radius:8px;padding:5px 9px;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box}\n#eh996-env-current{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:5px 8px;border-radius:8px;background:#eef2f7;color:#475569;white-space:nowrap;font-size:11px;font-weight:700}\n#eh996-env-switch{background:#2563eb;color:#fff}\n#eh996-app-open{background:#fff;color:#334155;border:1px solid #d9e1eb!important}\n#eh996-env-panel{position:absolute;right:0;top:calc(100% + 7px);bottom:auto;z-index:60;display:none;min-width:220px;padding:8px;border:1px solid #dbe3ee;border-radius:12px;background:#fff;box-shadow:0 14px 36px rgba(15,23,42,.18);font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif}\n#eh996-env-panel[data-open="1"]{display:grid;gap:6px}\n#eh996-env-panel button{touch-action:manipulation;width:100%;text-align:left;border:0;border-radius:9px;padding:10px 11px;background:#f1f5f9;color:#0f172a;cursor:pointer;font:inherit}\n#eh996-env-panel button[aria-current="page"]{background:#dbeafe;color:#1d4ed8}\n#eh996-app-dialog{border:0;border-radius:16px;padding:0;max-width:min(430px,calc(100vw - 28px));box-shadow:0 22px 70px rgba(15,23,42,.34)}\n#eh996-app-dialog::backdrop{background:rgba(15,23,42,.45)}\n#eh996-app-dialog .eh996-card{padding:20px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a}\n#eh996-app-dialog h3{margin:0 0 8px;font-size:18px}#eh996-app-dialog p{margin:0 0 14px;color:#475569}\n#eh996-app-dialog .eh996-grid{display:grid;grid-template-columns:1fr;gap:8px}\n#eh996-app-dialog button{touch-action:manipulation;border:0;border-radius:10px;padding:11px 12px;font:600 13px system-ui;cursor:pointer}\n@media(max-width:640px){#eh996-env-hub{width:100%;justify-self:stretch;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px;padding:2px;margin:0}#eh996-env-current{min-height:30px;padding:5px 7px;font-size:10.5px}#eh996-env-hub button,#eh996-env-hub a{min-height:30px;padding:5px 7px;font-size:10.5px}#eh996-env-panel{left:0;right:0;top:calc(100% + 6px);width:100%;min-width:0;box-sizing:border-box}}\n@media(max-width:420px){#eh996-env-hub{grid-template-columns:1fr 1fr;gap:4px}#eh996-env-current{grid-column:1/-1;justify-content:flex-start}}\n@media print{#eh996-env-hub,#eh996-env-panel,#eh996-app-dialog{display:none!important}}\n\``;
hub=hub.slice(0,styleStart)+css+hub.slice(styleEnd+2);

if(!hub.includes('function resolveMount(){')){
  const renderMarker='function render(){';
  assertCount(hub,renderMarker,1,'Environment-Hub render');
  hub=hub.replace(renderMarker,`function resolveMount(){\n  const slot=document.getElementById('ehTopbarEnvironment')||document.querySelector('.eh-topbar-environment');\n  const topbar=document.querySelector('.topbar');\n  return slot||topbar||document.body;\n}\n${renderMarker}`);
}

hub=replaceOnce(hub,'document.body.append(panel,hub,dialog);',`hub.appendChild(panel);\n  const mount=resolveMount();\n  mount.appendChild(hub);\n  document.body.appendChild(dialog);`,'Environment-Hub Mount');
fs.writeFileSync('assets/exporthub-environment-hub.js',hub);
console.log('assets/exporthub-environment-hub.js: RC1000 Topbar-Mount materialisiert');

const prod=fs.readFileSync('production-version.js','utf8');
if(!/RC997/.test(prod)||/RC1000/.test(prod)) throw new Error('Produktionsmarker muss während RC1000 auf RC997 bleiben');
console.log('production-version.js: weiterhin RC997');
