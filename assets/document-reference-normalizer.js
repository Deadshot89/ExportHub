(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.ExportHubDocumentReferenceNormalizer=api;
  if(typeof module==='object'&&module&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  function extractDocumentReferences(value){
    const input=String(value==null?'':value);
    const pattern=/\b(DNC|SIDE)\s*(?:[-_:]\s*)?([0-9]{6,20})\b/gi;
    const seen=new Set();
    const out=[];
    let match;
    while((match=pattern.exec(input))){
      const type=String(match[1]||'').toUpperCase();
      const number=String(match[2]||'');
      const canonical=type+number;
      if(seen.has(canonical))continue;
      seen.add(canonical);
      out.push({type,number,canonical});
    }
    return out;
  }

  function normalizedPdfName(originalName,extractedText){
    const original=String(originalName==null?'':originalName);
    if(!/\.pdf$/i.test(original))return{name:original,renamed:false,reference:null,reason:'none'};
    // Keep a unique filename DNC when the PDF only mentions unrelated SIDE
    // paperwork; conflicting or multiple DNCs must not be guessed.
    const contentRefs=extractDocumentReferences(extractedText);
    const filenameRefs=extractDocumentReferences(original);
    const contentDncs=contentRefs.filter(ref=>ref.type==='DNC');
    const filenameDncs=filenameRefs.filter(ref=>ref.type==='DNC');
    const conflict=contentDncs.length>1||filenameDncs.length>1||
      (contentDncs.length===1&&filenameDncs.length===1&&contentDncs[0].canonical!==filenameDncs[0].canonical);
    if(conflict)return{name:original,renamed:false,reference:null,reason:'ambiguous'};
    const dncs=contentDncs.length?contentDncs:filenameDncs;
    const references=dncs.length?dncs:(contentRefs.length?contentRefs:filenameRefs);
    if(!references.length)return{name:original,renamed:false,reference:null,reason:'none'};
    if(references.length!==1)return{name:original,renamed:false,reference:null,reason:'ambiguous'};
    const reference=references[0];
    const name=reference.canonical+'.pdf';
    return{name,renamed:name!==original,reference:reference.canonical,reason:reference.type==='DNC'?'dncs':'side'};
  }

  function printDocumentName(name){
    return String(name==null?'':name).replace(/\.pdf$/i,'');
  }

  function byteString(value){
    const bytes=value instanceof Uint8Array?value:new Uint8Array(value||0);
    let out='';
    const chunk=8192;
    for(let i=0;i<bytes.length;i+=chunk){
      const end=Math.min(bytes.length,i+chunk);
      let part='';
      for(let j=i;j<end;j++)part+=String.fromCharCode(bytes[j]);
      out+=part;
    }
    return out;
  }

  function decodePdfString(value){
    return String(value||'')
      .replace(/\\([()\\])/g,'$1')
      .replace(/\\n/g,'\n')
      .replace(/\\r/g,'\r')
      .replace(/\\t/g,'\t')
      .replace(/\\b/g,'\b')
      .replace(/\\f/g,'\f')
      .replace(/\\([0-7]{1,3})/g,function(_m,oct){return String.fromCharCode(parseInt(oct,8));});
  }

  function hexBytes(value){
    const raw=String(value||'').replace(/\s+/g,'');
    const even=raw.length%2?raw+'0':raw;
    const out=new Uint8Array(Math.floor(even.length/2));
    for(let i=0;i<out.length;i++)out[i]=parseInt(even.slice(i*2,i*2+2),16)||0;
    return out;
  }

  function decodeUtf16(bytes,littleEndian,offset){
    let out='';
    for(let i=offset||0;i+1<bytes.length;i+=2){
      const code=littleEndian?(bytes[i]|(bytes[i+1]<<8)):((bytes[i]<<8)|bytes[i+1]);
      out+=String.fromCharCode(code);
    }
    return out;
  }

  function decodeHexPdfString(value){
    const bytes=hexBytes(value);
    if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return decodeUtf16(bytes,false,2);
    if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return decodeUtf16(bytes,true,2);
    if(bytes.length>=4&&bytes.length%2===0){
      let beZeros=0,leZeros=0,pairs=0;
      for(let i=0;i+1<bytes.length;i+=2){pairs++;if(bytes[i]===0)beZeros++;if(bytes[i+1]===0)leZeros++;}
      if(pairs&&beZeros/pairs>=0.6)return decodeUtf16(bytes,false,0);
      if(pairs&&leZeros/pairs>=0.6)return decodeUtf16(bytes,true,0);
    }
    return byteString(bytes);
  }

  function textStrings(source){
    const input=String(source||''),out=[];
    const literal=/\((?:\\.|[^\\)])*\)/gs;
    let match;
    while((match=literal.exec(input)))out.push(decodePdfString(match[0].slice(1,-1)));
    const hex=/<([0-9A-Fa-f\s]{4,})>/g;
    while((match=hex.exec(input)))out.push(decodeHexPdfString(match[1]));
    return out;
  }

  async function inflateDeflate(bytes){
    if(typeof DecompressionStream!=='function')return'';
    const stream=new DecompressionStream('deflate');
    const writer=stream.writable.getWriter(),reader=stream.readable.getReader(),chunks=[];
    let size=0;
    // Drain the readable side while writing: awaiting writer.close() before reading
    // can deadlock on ordinary PDFs when the decompressed output fills the stream.
    await Promise.all([
      (async()=>{await writer.write(bytes);await writer.close();})(),
      (async()=>{
        while(true){
          const part=await reader.read();
          if(part.done)break;
          const chunk=part.value instanceof Uint8Array?part.value:new Uint8Array(part.value||0);
          chunks.push(chunk);size+=chunk.length;
        }
      })()
    ]);
    const merged=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
    return byteString(merged);
  }

  async function extractPdfTextFromBytes(value){
    const bytes=value instanceof Uint8Array?value:new Uint8Array(value||0);
    if(bytes.length<5||byteString(bytes.subarray(0,5))!=='%PDF-')return'';
    const raw=byteString(bytes),sources=[raw],marker=/stream\r?\n/g;
    let match;
    while((match=marker.exec(raw))){
      const start=match.index+match[0].length,end=raw.indexOf('endstream',start);
      if(end<0)break;
      const header=raw.slice(Math.max(0,match.index-600),match.index);
      if(/\/FlateDecode\b/.test(header)){
        let stop=end;
        while(stop>start&&(bytes[stop-1]===0x0a||bytes[stop-1]===0x0d))stop--;
        try{const inflated=await inflateDeflate(bytes.subarray(start,stop));if(inflated)sources.push(inflated);}catch(_){}
      }
      marker.lastIndex=end+'endstream'.length;
    }
    const parts=[];
    for(const source of sources)parts.push.apply(parts,textStrings(source));
    return parts.join('\n');
  }

  async function normalizePdfFile(file){
    const original=String(file&&file.name||'');
    const mime=String(file&&file.type||'').toLowerCase();
    const pdfMime=!mime||mime==='application/pdf'||mime==='application/x-pdf';
    if(!/\.pdf$/i.test(original)||!pdfMime)return normalizedPdfName(original,'');
    if(!file||typeof file.arrayBuffer!=='function')return normalizedPdfName(original,'');
    try{
      const text=await extractPdfTextFromBytes(await file.arrayBuffer());
      return normalizedPdfName(original,text);
    }catch(_){
      return normalizedPdfName(original,'');
    }
  }

  return Object.freeze({extractDocumentReferences,normalizedPdfName,printDocumentName,extractPdfTextFromBytes,normalizePdfFile});
});
