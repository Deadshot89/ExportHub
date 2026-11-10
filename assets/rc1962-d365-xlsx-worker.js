/* RC1962: D365 XLSX positions-only, isolated browser Worker. No network APIs used. */
'use strict';
const MAX_FILE=12*1024*1024,MAX_EXPANDED=40*1024*1024,MAX_ENTRIES=256,MAX_SHEETS=12,MAX_ROWS=1000,MAX_POSITIONS=500;
function fail(code){throw new Error(code)}
function u16(v,p){return v.getUint16(p,true)}
function u32(v,p){return v.getUint32(p,true)}
function decode(bytes){return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
function safeXml(s){
 if(/<!DOCTYPE|<!ENTITY|<!\[CDATA|<\?xml-stylesheet|<script\b/i.test(s))fail('D365_XML_UNSAFE');
 return s
}
function entities(s){
 return String(s||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,function(_,e){
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"},key=e.toLowerCase();
  if(Object.prototype.hasOwnProperty.call(named,key))return named[key];
  const n=key.startsWith('#x')?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
  if(!Number.isInteger(n)||n<1||n>1114111||(n>=55296&&n<=57343))fail('D365_XML_ENTITY');
  return String.fromCodePoint(n)
 }).replace(/&(?!(?:amp|lt|gt|quot|apos|#x[0-9a-f]+|#[0-9]+);)/gi,function(){fail('D365_XML_ENTITY')})
}
function attrs(s){
 const result=Object.create(null),rx=/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;let m;
 while((m=rx.exec(s)))result[m[1]]=entities(m[2]===undefined?m[3]:m[2]);
 return result
}
function tagTexts(xml,tag){
 const out=[],rx=new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','g');let m;
 while((m=rx.exec(xml)))out.push(entities(m[1]));
 return out
}
function crc32(data){let c=0xffffffff;for(let i=0;i<data.length;i++){c^=data[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
async function unzip(file){
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isSafeInteger(file.size)||file.size<50||file.size>MAX_FILE||!/\.xlsx$/i.test(String(file.name||'')))fail('D365_FILE_INVALID');
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size)fail('D365_FILE_CHANGED');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(u32(view,i)===0x06054b50&&i+22+u16(view,i+20)===bytes.length){eocd=i;break}
 if(eocd<0||u16(view,eocd+4)||u16(view,eocd+6)||u16(view,eocd+8)!==u16(view,eocd+10))fail('D365_ZIP_INVALID');
 const count=u16(view,eocd+10),cdSize=u32(view,eocd+12),cdOffset=u32(view,eocd+16);
 if(!count||count>MAX_ENTRIES||count===65535||cdOffset+cdSize>eocd)fail('D365_ZIP_LIMIT');
 const list=[],seen=new Set();let offset=cdOffset,total=0,xmlCount=0;
 for(let i=0;i<count;i++){
  if(offset+46>eocd||u32(view,offset)!==0x02014b50)fail('D365_ZIP_INVALID');
  const flags=u16(view,offset+8),method=u16(view,offset+10),crc=u32(view,offset+16),csize=u32(view,offset+20),usize=u32(view,offset+24);
  const nlen=u16(view,offset+28),extra=u16(view,offset+30),comment=u16(view,offset+32),start=u32(view,offset+42);
  if(flags&1||!([0,8].includes(method))||csize===0xffffffff||usize===0xffffffff||start===0xffffffff||offset+46+nlen+extra+comment>eocd)fail('D365_ZIP_INVALID');
  const name=decode(bytes.subarray(offset+46,offset+46+nlen)),lower=name.toLowerCase();
  if(!name||name.includes('\\')||name.includes('\0')||name.startsWith('/')||name.split('/').some(s=>s==='.'||s==='..')||seen.has(lower))fail('D365_ZIP_PATH');
  seen.add(lower);offset+=46+nlen+extra+comment;total+=usize;
  if(total>MAX_EXPANDED||usize>MAX_EXPANDED)fail('D365_ZIP_LIMIT');
  if(/vbaproject|externalLinks|embeddings|activex|connections\.xml|calcchain|xl\/media\//i.test(name))fail('D365_ACTIVE_CONTENT');
  if(/^xl\/worksheets\/[^/]+\.xml$/i.test(name))xmlCount++;
  list.push({name,method,crc,csize,usize,start})
 }
 if(offset!==cdOffset+cdSize||xmlCount>MAX_SHEETS)fail('D365_ZIP_LIMIT');
 const needed=list.filter(f=>f.name==='[Content_Types].xml'||f.name==='xl/workbook.xml'||f.name==='xl/sharedStrings.xml'||f.name==='xl/_rels/workbook.xml.rels'||/^xl\/worksheets\/[^/]+\.xml$/i.test(f.name));
 const result=Object.create(null);
 for(const f of needed){
  const p=f.start;if(p+30>bytes.length||u32(view,p)!==0x04034b50||u16(view,p+8)!==f.method)fail('D365_ZIP_INVALID');
  const s=p+30+u16(view,p+26)+u16(view,p+28);
  if(s+f.csize>bytes.length)fail('D365_ZIP_INVALID');
  const compressed=bytes.subarray(s,s+f.csize);
  let uncompressed;
  if(f.method===0)uncompressed=compressed;
  else{
   if(typeof DecompressionStream!=='function')fail('D365_BROWSER_DECOMPRESSION_UNAVAILABLE');
   const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
   const chunks=[];let size=0;
   while(true){
    const part=await reader.read();if(part.done)break;
    size+=part.value.byteLength;
    if(size>f.usize||size>MAX_EXPANDED){await reader.cancel();fail('D365_ZIP_LIMIT')}
    chunks.push(part.value);
   }
   uncompressed=new Uint8Array(size);let pos=0;for(const chunk of chunks){uncompressed.set(chunk,pos);pos+=chunk.length}
  }
  if(uncompressed.length!==f.usize||crc32(uncompressed)!==f.crc)fail('D365_ZIP_CHECKSUM');
  result[f.name]=safeXml(decode(uncompressed))
 }
 if(!result['[Content_Types].xml']||!result['xl/workbook.xml'])fail('D365_XLSX_INVALID');
 return result
}
function sharedStrings(xml){
 if(!xml)return[];
 const strings=[],rx=/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;let m;
 while((m=rx.exec(xml))){
  if(strings.length>60000)fail('D365_ZIP_LIMIT');
  strings.push(tagTexts(m[1],'t').join(''))
 }
 return strings
}
function parseSheet(xml,strings){
 if(/<f(?:\s|>)/i.test(xml)||/TargetMode\s*=\s*["']External["']/i.test(xml))fail('D365_ACTIVE_CONTENT');
 const rows=[],re=/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;let row;
 while((row=re.exec(xml))){
  if(rows.length>=MAX_ROWS+1)fail('D365_ROW_LIMIT');
  const line=[],cells=/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;let cell;
  while((cell=cells.exec(row[1]))){
   const a=attrs(cell[1]),ref=/^([A-Z]{1,3})\d+$/i.exec(a.r||'');
   if(!ref)fail('D365_CELL_REFERENCE');
   const letters=ref[1].toUpperCase();let idx=0;for(const ch of letters)idx=idx*26+ch.charCodeAt(0)-64;idx--;
   if(idx<0||idx>=80)fail('D365_COLUMN_LIMIT');
   const body=cell[2]||'';
   if(/<f(?:\s|>)/i.test(body))fail('D365_ACTIVE_CONTENT');
   let val='';
   if(a.t==='inlineStr')val=tagTexts(body,'t').join('');
   else{
    const v=tagTexts(body,'v')[0]||'';
    if(a.t==='s'){const n=Number(v);if(!Number.isInteger(n)||n<0||n>=strings.length)fail('D365_SHARED_STRING');val=strings[n]}
    else val=v
   }
   if(val.length>5000||line[idx]!==undefined)fail('D365_CELL_LIMIT');
   line[idx]=val
  }
  if(line.some(v=>String(v||'').trim()))rows.push(line)
 }
 return rows
}
function header(s){return String(s||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase()}
function num(value){
 if(value===null||value===undefined)return null;
 let s=String(value).trim().replace(/\s/g,'');
 if(!s||! /^[+-]?\d[\d.,]*$/.test(s))return null;
 const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
 if(comma>=0&&dot>=0)s=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(comma>=0)s=s.replace(',','.');
 const n=Number(s);return Number.isFinite(n)?n:null
}
// Keep the exact D365 country conversion table used by the server analyzer.
const countries={
 AUT:'AT',BEL:'BE',BGR:'BG',CHE:'CH',CHN:'CN',CZE:'CZ',DEU:'DE',DNK:'DK',ESP:'ES',
 EST:'EE',FIN:'FI',FRA:'FR',GBR:'GB',GRC:'GR',HRV:'HR',HUN:'HU',IDN:'ID',
 IND:'IN',IRL:'IE',ISR:'IL',ITA:'IT',JPN:'JP',KOR:'KR',LTU:'LT',LUX:'LU',
 LVA:'LV',MEX:'MX',NLD:'NL',NOR:'NO',POL:'PL',PRT:'PT',ROU:'RO',RUS:'RU',
 SVK:'SK',SVN:'SI',SWE:'SE',THA:'TH',TUR:'TR',TWN:'TW',UKR:'UA',USA:'US',
 VNM:'VN',ZAF:'ZA',CAN:'CA',AUS:'AU',BRA:'BR',ARE:'AE'
};
function iso(v){const s=String(v||'').trim().toUpperCase();return countries[s]||s}
function docsFromSheets(entries){
 const strings=sharedStrings(entries['xl/sharedStrings.xml']);
 const paths=Object.keys(entries).filter(k=>/^xl\/worksheets\/[^/]+\.xml$/i.test(k)).sort();
 if(!paths.length)fail('D365_EMPTY_XLSX');
 const required=['PACKINGSLIPID','ITEMNUMBER','QTY','COMMODITYCODE','SHIPPEDAMOUNT'];
 const groups=new Map();let total=0;
 for(const path of paths){
  const rows=parseSheet(entries[path],strings);if(!rows.length)continue;
  const col=Object.create(null);rows[0].forEach((s,i)=>{const key=header(s);if(key&&!Object.prototype.hasOwnProperty.call(col,key))col[key]=i});
  if(!required.every(k=>Object.prototype.hasOwnProperty.call(col,k)))fail('D365_SCHEMA_MISMATCH');
  for(let i=1;i<rows.length;i++){
   const row=rows[i],get=k=>String(row[col[k]]==null?'':row[col[k]]).trim();
   const qty=num(get('QTY'));if(qty===null||qty<0)fail('D365_QUANTITY_INVALID');if(qty===0)continue;
   if(++total>MAX_POSITIONS)fail('D365_POSITION_LIMIT');
   const isBackorder=get('SALESORDERLINESTATUS').toLowerCase()==='backorder';
   let value=num(get('SHIPPEDAMOUNT'));
   if(value===null&&!isBackorder)value=num(get('LINEAMOUNT'));
   const packingSlip=get('PACKINGSLIPID')||get('SALESORDERNUMBER'),recipient=get('DELIVERYADDRESSNAME')||get('DELIVERYADDRESSDESCRIPTION');
   if(!packingSlip)fail('D365_REFERENCE_MISSING');
   const address=get('FORMATTEDDELVERYADDRESS')||[get('DELIVERYADDRESSSTREET'),get('DELIVERYADDRESSZIPCODE'),get('DELIVERYADDRESSCITY')].join('|');
   const dest=get('DELIVERYADDRESSCOUNTRYREGIONISOCODE')||iso(get('DELIVERYADDRESSCOUNTRYREGIONID'));
   const key=[packingSlip,recipient,address,dest].join('\u001f');
   if(!groups.has(key))groups.set(key,{reference:packingSlip,recipient,positions:[]});
   const position={
    itemNumber:get('ITEMNUMBER').slice(0,100),
    description:(get('PRODUCTDESCRIPTION')||get('NAME')||get('PRODUCTNAMEDE')).slice(0,500),
    quantity:qty,unit:(get('SALESUNIT')||get('UNIT')).slice(0,30),
    unitPrice:value===null?null:value/qty,value:value,
    netMassKg:num(get('SHIPPEDQTYNETWEIGHT')),grossMassKg:num(get('SHIPPEDQTYGROSSWEIGHT')),
    volumeM3:num(get('SHIPPEDQTYVOLUME'))===null?num(get('VOLUMEM3')):num(get('SHIPPEDQTYVOLUME')),
    commodityCode:get('COMMODITYCODE').replace(/\s/g,'').slice(0,12),
    originCountry:iso(get('ORIGCOUNTRYREGIONID')).slice(0,3)
   };
   groups.get(key).positions.push(position)
  }
 }
 if(!total||!groups.size)fail('D365_NO_SHIPPED_ITEMS');
 return Array.from(groups.values())
}
self.onmessage=async function(event){
 try{
  const entries=await unzip(event.data&&event.data.file);
  const docs=docsFromSheets(entries);
  self.postMessage({ok:true,docs:docs})
 }catch(e){self.postMessage({ok:false,code:/^D365_[A-Z_]+$/.test(String(e&&e.message))?e.message:'D365_READ_FAILED'})}
};
