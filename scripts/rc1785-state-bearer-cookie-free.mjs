// RC1785: Azure SWA may redirect requests that carry stale platform/MS
// cookies, even if ExportHUB bearer headers are valid. Only the authenticated
// team-state endpoint is changed. Authentication and other API traffic keep
// their existing transport policy.
const START = "async function jsonFetch(url,options){";
const END = "async function parseLargeJson(textValue){";
const FETCH = " const res=await resilientFetch(url,opts);";
const MARKER = "/* RC1785: bearer-authenticated team state excludes platform cookies */";
const GUARD = [
 " // "+MARKER,
 " // ExportHUB verifies the bearer token inside the API; platform cookies are unnecessary.",
 " if(opts.credentials==='same-origin'&&/^\\/api\\/exporthub-state(?:[?#]|$)/i.test(String(url||''))&&",
 "    (opts.headers['X-ExportHUB-Token']||opts.headers['X-ExportHUB-Session']||opts.headers.Authorization||opts.headers.authorization)){",
 "  opts.credentials='omit';",
 " }"
].join('\n');

export function patchRc1785StateBearerCookies(html,file){
 if(typeof html!=='string')throw new Error(file+': RC1785 expected HTML');
 const start=html.indexOf(START),end=start<0?-1:html.indexOf(END,start+START.length);
 if(start<0||end<start)throw new Error(file+': RC1785 team-state JSON transport missing');
 const body=html.slice(start,end);
 if(body.includes(MARKER)){
  if(!body.includes(GUARD)||body.split(MARKER).length!==2)throw new Error(file+': RC1785 guard incomplete');
  return html;
 }
 if(body.split(FETCH).length!==2)throw new Error(file+': RC1785 expected exactly one state transport call');
 if(!body.includes("opts.headers=Object.assign({},opts.headers||{});"))
  throw new Error(file+': RC1785 session headers were not initialized');
 const patched=body.replace(FETCH,GUARD+'\n'+FETCH);
 return html.slice(0,start)+patched+html.slice(end);
}

export function assertRc1785ShippedStateFetch(html,file){
 const start=typeof html==='string'?html.indexOf(START):-1;
 const end=start<0?-1:html.indexOf(END,start+START.length);
 const body=start>=0&&end>start?html.slice(start,end):'';
 if(!body.includes(GUARD)||body.split(MARKER).length!==2)
  throw new Error(file+': RC1785 shipped bearer-cookie guard missing from final HTML');
 return true;
}
