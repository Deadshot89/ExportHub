(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.ExportHubDocumentReferenceNormalizer=api;
  if(typeof module==='object'&&module&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  function extractDocumentReferences(value){
    const input=String(value==null?'':value);
    const pattern=/(?<![A-Za-z0-9])(DNC|SIDE)\s*(?:[-_:]\s*)?([0-9]{6,20})(?![0-9])/gi;
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

  function utf16Hex(value){
    const raw=String(value||'');let out='';
    for(let i=0;i+3<raw.length;i+=4)out+=String.fromCharCode(parseInt(raw.slice(i,i+4),16)||0);
    return out;
  }

  // Generated PDFs (D365 SalesPackingSlip, browsers, Office) write glyph ids
  // through CID fonts; only the font's ToUnicode CMap turns them into text.
  function parseToUnicode(source){
    const input=String(source||'');
    if(input.indexOf('begincmap')<0)return null;
    const space=/begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(input);
    const width=space?Math.max(1,Math.min(4,Math.floor(space[1].length/2))):2;
    const map=new Map();
    let block,entry;
    const chars=/beginbfchar([\s\S]*?)endbfchar/g;
    while((block=chars.exec(input))){
      const pair=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g;
      while((entry=pair.exec(block[1])))map.set(parseInt(entry[1],16),utf16Hex(entry[2]));
    }
    const ranges=/beginbfrange([\s\S]*?)endbfrange/g;
    while((block=ranges.exec(input))){
      const range=/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g;
      while((entry=range.exec(block[1]))){
        const lo=parseInt(entry[1],16),hi=Math.min(parseInt(entry[2],16),lo+4096);
        if(entry[3]!==undefined){
          const base=entry[3],head=base.slice(0,-4),last=parseInt(base.slice(-4),16)||0;
          for(let code=lo;code<=hi;code++)map.set(code,utf16Hex(head)+String.fromCharCode(last+code-lo));
        }else{
          const list=String(entry[4]||'').match(/<([0-9A-Fa-f]*)>/g)||[];
          list.forEach(function(item,index){if(lo+index<=hi)map.set(lo+index,utf16Hex(item.slice(1,-1)));});
        }
      }
    }
    return map.size?{width,map}:null;
  }

  function decodeWithCmap(bytes,cmap){
    let out='';
    for(let i=0;i+cmap.width<=bytes.length;i+=cmap.width){
      let code=0;
      for(let j=0;j<cmap.width;j++)code=code*256+bytes[i+j];
      out+=cmap.map.get(code)||'';
    }
    return out;
  }

  function literalBytes(value){
    const raw=decodePdfString(value),out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i)&255;
    return out;
  }

  function textStrings(source,cmaps){
    const input=String(source||''),out=[];
    const literal=/\((?:\\.|[^\\)])*\)/gs;
    let match;
    while((match=literal.exec(input)))out.push(decodePdfString(match[0].slice(1,-1)));
    const hex=/<([0-9A-Fa-f\s]{4,})>/g;
    while((match=hex.exec(input)))out.push(decodeHexPdfString(match[1]));
    // D365/ERP-PDFs can render one visible reference as many separate TJ/Tj
    // strings (including UTF-16 glyphs). Extract contiguous text-operation
    // fragments from each BT/ET block as both joined and spaced text.
    const block=/\bBT\b([\s\S]*?)\bET\b/g;
    while((match=block.exec(input))){
      const chunks=[],atoms=/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]{2,})>/g;
      let part;
      while((part=atoms.exec(match[1]))){
        const value=part[0][0]==='('?decodePdfString(part[0].slice(1,-1)):decodeHexPdfString(part[1]);
        if(value)chunks.push(value);
      }
      if(chunks.length>1){out.push(chunks.join(' '));out.push(chunks.join(''));}
      for(const cmap of cmaps||[]){
        const decoded=[],glyphs=/\((?:\\.|[^\\)])*\)|<([0-9A-Fa-f\s]{2,})>/g;
        while((part=glyphs.exec(match[1]))){
          const bytes=part[0][0]==='('?literalBytes(part[0].slice(1,-1)):hexBytes(part[1]);
          const value=decodeWithCmap(bytes,cmap);
          if(value)decoded.push(value);
        }
        if(decoded.length){out.push(decoded.join(''));out.push(decoded.join(' '));}
      }
    }
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
    const cmaps=sources.map(parseToUnicode).filter(Boolean),parts=[];
    for(const source of sources)parts.push.apply(parts,textStrings(source,cmaps));
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
