'use strict';
const zlib=require('zlib');

function decodePdfString(value){
  return String(value||'')
    .replace(/\\([()\\])/g,'$1')
    .replace(/\\n/g,'\n')
    .replace(/\\r/g,'\r')
    .replace(/\\t/g,'\t')
    .replace(/\\b/g,'\b')
    .replace(/\\f/g,'\f')
    .replace(/\\([0-7]{1,3})/g,(_m,oct)=>String.fromCharCode(parseInt(oct,8)));
}
function decodeUtf16(bytes,littleEndian,offset=0){
  let out='';
  for(let i=offset;i+1<bytes.length;i+=2){
    const code=littleEndian?(bytes[i]|(bytes[i+1]<<8)):((bytes[i]<<8)|bytes[i+1]);
    out+=String.fromCharCode(code);
  }
  return out;
}
function decodeHexPdfString(value){
  const raw=String(value||'').replace(/\s+/g,''),even=raw.length%2?raw+'0':raw;
  let bytes;
  try{bytes=Buffer.from(even,'hex')}catch(_){return''}
  if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return decodeUtf16(bytes,false,2);
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return decodeUtf16(bytes,true,2);
  if(bytes.length>=4&&bytes.length%2===0){
    let beZeros=0,leZeros=0,pairs=0;
    for(let i=0;i+1<bytes.length;i+=2){pairs++;if(bytes[i]===0)beZeros++;if(bytes[i+1]===0)leZeros++;}
    if(pairs&&beZeros/pairs>=0.6)return decodeUtf16(bytes,false,0);
    if(pairs&&leZeros/pairs>=0.6)return decodeUtf16(bytes,true,0);
  }
  return bytes.toString('latin1');
}
function textStrings(source){
  const input=String(source||''),out=[];
  const literal=/\((?:\\.|[^\\)])*\)/gs;
  let m;
  while((m=literal.exec(input)))out.push(decodePdfString(m[0].slice(1,-1)));
  const hex=/<([0-9A-Fa-f\s]{4,})>/g;
  while((m=hex.exec(input))){
    try{out.push(decodeHexPdfString(m[1]))}catch(_){}
  }
  // Text from ERP PDFs may be split character-by-character across TJ
  // arrays. Rejoin only within a single text block, never across pages.
  const blocks=/\bBT\b([\s\S]*?)\bET\b/g;
  while((m=blocks.exec(input))){
    const chunks=[],atoms=/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]{2,})>/g;
    let part;
    while((part=atoms.exec(m[1]))){
      const value=part[0][0]==='('?decodePdfString(part[0].slice(1,-1)):decodeHexPdfString(part[1]);
      if(value)chunks.push(value);
    }
    if(chunks.length>1){out.push(chunks.join(' '));out.push(chunks.join(''));}
  }
  return out;
}
function flateStreams(buffer){
  const raw=buffer.toString('latin1'),out=[];
  const marker=/stream\r?\n/g;
  let match;
  while((match=marker.exec(raw))){
    const start=match.index+match[0].length,end=raw.indexOf('endstream',start);
    if(end<0)break;
    const header=raw.slice(Math.max(0,match.index-600),match.index);
    if(/\/FlateDecode\b/.test(header)){
      let stop=end;
      while(stop>start&&(buffer[stop-1]===0x0a||buffer[stop-1]===0x0d))stop--;
      try{out.push(zlib.inflateSync(buffer.subarray(start,stop)).toString('latin1'))}catch(_){}
    }
    marker.lastIndex=end+'endstream'.length;
  }
  return out;
}
function extractPdfText(buffer){
  if(!Buffer.isBuffer(buffer))buffer=Buffer.from(buffer||[]);
  if(buffer.length<5||buffer.subarray(0,5).toString('ascii')!=='%PDF-')return'';
  const sources=[buffer.toString('latin1'),...flateStreams(buffer)],parts=[];
  for(const source of sources)parts.push(...textStrings(source));
  return parts.join('\n');
}
function extractDocumentReferences(value){
  const input=String(value==null?'':value),pattern=/(?<![A-Za-z0-9])(DNC|SIDE)\s*(?:[-_:]\s*)?([0-9]{6,20})(?![0-9])/gi,seen=new Set(),out=[];
  let match;
  while((match=pattern.exec(input))){
    const type=String(match[1]||'').toUpperCase(),number=String(match[2]||''),canonical=type+number;
    if(seen.has(canonical))continue;
    seen.add(canonical);out.push({type,number,canonical});
  }
  return out;
}
function normalizedPdfName(originalName,extractedText){
  const original=String(originalName==null?'':originalName);
  if(!/\.pdf$/i.test(original))return{name:original,renamed:false,reference:null,reason:'none'};
  // DNC is a delivery-note identifier; incidental SIDE numbers in the PDF
  // must not override a unique DNC already present in the filename.
  const contentRefs=extractDocumentReferences(extractedText),filenameRefs=extractDocumentReferences(original);
  const contentDncs=contentRefs.filter(ref=>ref.type==='DNC');
  const filenameDncs=filenameRefs.filter(ref=>ref.type==='DNC');
  const conflict=contentDncs.length>1||filenameDncs.length>1||
    (contentDncs.length===1&&filenameDncs.length===1&&contentDncs[0].canonical!==filenameDncs[0].canonical);
  if(conflict)return{name:original,renamed:false,reference:null,reason:'ambiguous'};
  const dncs=contentDncs.length?contentDncs:filenameDncs;
  const refs=dncs.length?dncs:(contentRefs.length?contentRefs:filenameRefs);
  if(!refs.length)return{name:original,renamed:false,reference:null,reason:'none'};
  if(refs.length!==1)return{name:original,renamed:false,reference:null,reason:'ambiguous'};
  const reference=refs[0];
  return{name:reference.canonical+'.pdf',renamed:(reference.canonical+'.pdf')!==original,reference:reference.canonical,reason:reference.type==='SIDE'?'side':'dncs'};
}
function normalizePdfDocument(file,buffer,mimeType){
  const input=file&&typeof file==='object'?file:{};
  const original=String(input.name||input.fileName||input.filename||'');
  const mime=String(mimeType||input.mimeType||input.type||'').toLowerCase();
  if((mime!=='application/pdf'&&mime!=='application/x-pdf')||!/\.pdf$/i.test(original))return Object.assign({},input);
  const result=normalizedPdfName(original,extractPdfText(buffer));
  if(!result.renamed)return Object.assign({},input);
  return Object.assign({},input,{originalName:input.originalName||original,name:result.name,documentReference:result.reference,documentReferenceType:result.reason==='side'?'SIDE':'DNC'});
}
module.exports={extractPdfText,extractDocumentReferences,normalizedPdfName,normalizePdfDocument};
