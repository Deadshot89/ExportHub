(function(root){
  'use strict';

  const replaying=new WeakSet();
  const selectionRevisions=new WeakMap();
  // Stop one defective PDF parser from blocking the shipment form indefinitely.
  const NORMALIZE_TIMEOUT_MS=3000;

  function text(value){return String(value==null?'':value).trim();}
  function isPdf(file){
    if(!file)return false;
    const name=text(file.name),type=text(file.type).toLowerCase();
    return /\.pdf$/i.test(name)&&(!type||type==='application/pdf'||type==='application/x-pdf');
  }
  function normalizer(){
    const api=root&&root.ExportHubDocumentReferenceNormalizer;
    return api&&typeof api.normalizePdfFile==='function'?api:null;
  }
  function fileCtor(){return root&&typeof root.File==='function'?root.File:null;}

  function cloneWithName(file,name){
    const FileCtor=fileCtor();
    if(!FileCtor||!file||!name||name===file.name)return file;
    try{
      return new FileCtor([file],name,{type:file.type||'application/pdf',lastModified:Number(file.lastModified)||Date.now()});
    }catch(_){return file;}
  }

  async function normalizeFile(file){
    if(!isPdf(file))return file;
    const api=normalizer();
    if(!api)return file;
    let result;
    try{result=await api.normalizePdfFile(file);}catch(_){return file;}
    if(!result||result.renamed!==true||!text(result.name)||text(result.name)===text(file.name))return file;
    return cloneWithName(file,text(result.name));
  }

  function normalizeWithDeadline(file){
    if(!isPdf(file))return Promise.resolve(file);
    if(!root||typeof root.setTimeout!=='function')return normalizeFile(file);
    return new Promise(function(resolve){
      let settled=false;
      const finish=function(value){
        if(settled)return;
        settled=true;
        if(typeof root.clearTimeout==='function')root.clearTimeout(timer);
        resolve(value||file);
      };
      const timer=root.setTimeout(function(){finish(file)},NORMALIZE_TIMEOUT_MS);
      Promise.resolve().then(function(){return normalizeFile(file)}).then(finish,function(){finish(file)});
    });
  }

  async function normalizeFiles(files){
    const input=Array.from(files||[]);
    // Independent PDFs can be inspected in parallel; preserve the user's order.
    return Promise.all(input.map(normalizeWithDeadline));
  }

  function changed(before,after){
    if(before.length!==after.length)return true;
    for(let i=0;i<before.length;i++)if(before[i]!==after[i]||text(before[i]&&before[i].name)!==text(after[i]&&after[i].name))return true;
    return false;
  }

  function replaceInputFiles(input,files){
    if(!root||typeof root.DataTransfer!=='function')return false;
    try{
      const transfer=new root.DataTransfer();
      for(const file of files)transfer.items.add(file);
      input.files=transfer.files;
      return true;
    }catch(_){return false;}
  }

  function redispatch(input){
    if(!input||typeof input.dispatchEvent!=='function'||!root||typeof root.Event!=='function')return false;
    replaying.add(input);
    try{return input.dispatchEvent(new root.Event('change',{bubbles:true}));}
    finally{
      const clear=()=>replaying.delete(input);
      if(root&&typeof root.queueMicrotask==='function')root.queueMicrotask(clear);
      else if(root&&typeof root.setTimeout==='function')root.setTimeout(clear,0);
      else clear();
    }
  }

  async function handleChange(event){
    const input=event&&event.target;
    if(!input||text(input.type).toLowerCase()!=='file'||replaying.has(input))return false;
    // Also invalidate an older PDF selection when the newer selection is not a PDF.
    const revision=(selectionRevisions.get(input)||0)+1;
    selectionRevisions.set(input,revision);
    const original=Array.from(input.files||[]);
    if(!original.length||!original.some(isPdf)||!normalizer())return false;

    if(event&&typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();

    let normalized=original;
    try{normalized=await normalizeFiles(original);}catch(_){normalized=original;}
    if(selectionRevisions.get(input)!==revision)return false;
    if(changed(original,normalized))replaceInputFiles(input,normalized);
    selectionRevisions.delete(input);
    redispatch(input);
    return true;
  }

  function install(){
    if(!root||!root.document||typeof root.document.addEventListener!=='function')return false;
    if(root.__exportHubDocumentUploadNormalizerInstalled===true)return true;
    root.__exportHubDocumentUploadNormalizerInstalled=true;
    root.document.addEventListener('change',handleChange,true);
    return true;
  }

  const api=Object.freeze({isPdf,normalizeFile,normalizeFiles,handleChange,install});
  root.ExportHubDocumentUploadNormalizer=api;
  install();
})(typeof window!=='undefined'?window:globalThis);
