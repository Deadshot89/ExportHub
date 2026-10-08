'use strict';
const zlib=require('zlib');
const normalizer=require('../../assets/document-reference-normalizer.js');

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
function textStrings(source){
  const input=String(source||''),out=[];
  const literal=/\((?:\\.|[^\\)])*\)/gs;
  let m;
  while((m=literal.exec(input)))out.push(decodePdfString(m[0].slice(1,-1)));
  const hex=/<([0-9A-Fa-f]{4,})>/g;
  while((m=hex.exec(input))){
    try{out.push(Buffer.from(m[1].length%2?m[1]+'0':m[1],'hex').toString('latin1'))}catch(_){}
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
function normalizePdfDocument(file,buffer,mimeType){
  const input=file&&typeof file==='object'?file:{};
  const original=String(input.name||input.fileName||input.filename||'');
  if(String(mimeType||input.mimeType||input.type||'').toLowerCase()!=='application/pdf'||!/\.pdf$/i.test(original))return Object.assign({},input);
  const text=extractPdfText(buffer),result=normalizer.normalizedPdfName(original,text);
  if(!result.renamed)return Object.assign({},input);
  return Object.assign({},input,{originalName:input.originalName||original,name:result.name,documentReference:result.reference,documentReferenceType:result.reason==='side'?'SIDE':'DNC'});
}
module.exports={extractPdfText,normalizePdfDocument};
