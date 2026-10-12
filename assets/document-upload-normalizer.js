(function(root){
  'use strict';

  const replaying=new WeakSet();

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

  async function normalizeFiles(files){
    const input=Array.from(files||[]),out=[];
    for(const file of input)out.push(await normalizeFile(file));
    return out;
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
    const original=Array.from(input.files||[]);
    if(!original.length||!original.some(isPdf)||!normalizer())return false;

    if(event&&typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();

    let normalized=original;
    try{normalized=await normalizeFiles(original);}catch(_){normalized=original;}
    if(changed(original,normalized))replaceInputFiles(input,normalized);
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
