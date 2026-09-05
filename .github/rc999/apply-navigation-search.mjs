import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const RELEASE_DATE='05.09.2026';

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
function addSearchValues(block,marker,values,label){
  assertCount(block,marker,1,label+' marker');
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

for(const file of FILES){
  let html=fs.readFileSync(file,'utf8');

  const buildMatch=html.match(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']+)'\}\);/);
  if(!buildMatch) throw new Error(`${file}: BUILD-Metadaten nicht gefunden`);
  const currentLogin=buildMatch[1];
  const nextLogin=currentLogin.replace(/([?&])v=\d+/,'$1v=999');
  html=replaceOnce(html,buildMatch[0],`var BUILD=Object.freeze({version:'RC999',cache:'999',loginReturn:'${nextLogin}'});`,`${file}: BUILD`);

  html=patchOwner(html,'var RELEASE=Object.freeze({','changes:Object.freeze([',(block)=>{
    const versions=[...block.matchAll(/version:'RC\d+'/g)];
    const dates=[...block.matchAll(/date:'[^']*'/g)];
    if(versions.length!==1||dates.length!==1) throw new Error(`${file}: RELEASE nicht eindeutig`);
    return block.replace(versions[0][0],"version:'RC999'").replace(dates[0][0],`date:'${RELEASE_DATE}'`);
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
    next=addSearchValues(next,'"tasks",()=>{go("tasks")}',[
      't.status','t.priority','t.type','t.kind'
    ],`${file}: Aufgabensuche`);
    if(next.includes('catch(e){}')) next=next.replaceAll('catch(e){}',"catch(e){console.error('ExportHUB search navigation',e)}");
    if(!/console\.error\([^)]*search[^)]*,\s*e\)/i.test(next)) throw new Error(`${file}: Suchnavigation besitzt weiterhin keine Fehlerdiagnose`);
    return next;
  },`${file}: initIndex321`);

  fs.writeFileSync(file,html);
  console.log(`${file}: RC999 Navigation/Search angewendet`);
}

const prod=fs.readFileSync('production-version.js','utf8');
if(!/RC997/.test(prod)||/RC999/.test(prod)) throw new Error('Produktionsmarker muss während RC999 auf RC997 bleiben');
console.log('production-version.js: weiterhin RC997');
