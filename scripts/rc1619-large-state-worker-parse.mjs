// RC1619 P0 (#836): parse only large authenticated state-read JSON away from the UI thread.
// Build-time transformation; no Azure API, document, or persistence changes.
const FETCH_PARSE='try{data=txt?JSON.parse(txt):{}}';
const HELPER_START='async function parseLargeJson(textValue){';
const HELPER_END='\nfunction setLoginEnabled(enabled){';
const REPLACEMENT=String.raw`const rc1619LargeStateRead=/[?&]mode=read(?:&|$)/i.test(String(url||''))&&txt.length>=1048576;
 try{data=txt?(rc1619LargeStateRead?await parseLargeJson(txt):JSON.parse(txt)):{}}
`;
const SAFE_WORKER_PARSER=String.raw`async function parseLargeJson(textValue){
 if(!window.Worker||typeof Blob!=='function'||typeof URL==='undefined'||typeof URL.createObjectURL!=='function')return JSON.parse(textValue);
 const code='self.onmessage=e=>{try{self.postMessage({ok:true,value:JSON.parse(e.data)})}catch(x){self.postMessage({ok:false,error:x.message})}}';
 let url=null,worker=null,timer=null;
 try{
  url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  return await new Promise(function(resolve,reject){
   try{worker=new Worker(url)}catch(e){reject(e);return}
   worker.onmessage=function(e){if(e.data&&e.data.ok)resolve(e.data.value);else reject(new Error(e.data&&e.data.error||'JSON parse failed'))};
   worker.onerror=function(e){reject(new Error(e&&e.message||'Worker failed'))};
   worker.onmessageerror=function(){reject(new Error('Worker message failed'))};
   timer=native.setTimeout(function(){reject(new Error('State JSON worker timeout'))},20000);
   try{worker.postMessage(textValue)}catch(e){reject(e)}
  })
 }catch(_){return JSON.parse(textValue)}
 finally{if(timer!==null)native.clearTimeout(timer);if(worker)worker.terminate();if(url)URL.revokeObjectURL(url)}
}
`;
function replaceOnce(source,needle,value,file){
 const count=source.split(needle).length-1;
 if(count!==1)throw new Error(file+': RC1619 expected one matching anchor but found '+count);
 return source.replace(needle,value);
}
export function patchRc1619LargeStateWorkerParse(html,file){
 if(file==='demo.html'&&!html.includes(FETCH_PARSE))return html;
 html=replaceOnce(html,FETCH_PARSE,REPLACEMENT.trimEnd(),file);
 const start=html.indexOf(HELPER_START),end=html.indexOf(HELPER_END,start);
 if(start<0||end<=start)throw new Error(file+': RC1619 parser helper boundary missing');
 const old=html.slice(start,end);
 if(!old.includes('new Worker(url)')||!old.includes('JSON.parse(textValue)'))
  throw new Error(file+': RC1619 unexpected legacy worker parser');
 return html.slice(0,start)+SAFE_WORKER_PARSER.trimEnd()+html.slice(end);
}
