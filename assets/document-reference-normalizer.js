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
    const references=extractDocumentReferences(extractedText);
    if(!references.length)return{name:original,renamed:false,reference:null,reason:'none'};
    if(references.length!==1)return{name:original,renamed:false,reference:null,reason:'ambiguous'};
    const reference=references[0];
    const name=reference.canonical+'.pdf';
    return{name,renamed:name!==original,reference:reference.canonical,reason:reference.type==='DNC'?'dncs':'side'};
  }

  function printDocumentName(name){
    return String(name==null?'':name).replace(/\.pdf$/i,'');
  }

  return Object.freeze({extractDocumentReferences,normalizedPdfName,printDocumentName});
});
