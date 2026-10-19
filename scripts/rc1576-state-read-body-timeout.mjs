/* RC1576: Bound the entire authenticated Azure team-state read, including streamed body.
   Pure build transform; canonical source stays unchanged until legacy HTML is consolidated. */
const ABORT_HOOK="async function resilientFetch(url,options){";
const FETCH_HOOK="   const res=await native.fetch(url,opts);";
const READ_HOOK=" const res=await resilientFetch(url,opts);\n const txt=await res.text();let data={};";

function once(html,needle,replacement,file){
  const count=html.split(needle).length-1;
  if(count!==1)throw new Error(file+': RC1576 expected one '+needle.slice(0,48)+'; got '+count);
  return html.replace(needle,replacement);
}

export function patchRc1576StateBodyDeadline(html,file){
  if(file==='demo.html'&&!html.includes(READ_HOOK))return html;
  html=once(html,ABORT_HOOK,`var rc1576ResponseAbort=typeof WeakMap==='function'?new WeakMap():null;\n${ABORT_HOOK}`,file);
  html=once(html,FETCH_HOOK,`${FETCH_HOOK}\n   if(controller&&rc1576ResponseAbort)rc1576ResponseAbort.set(res,function(){try{controller.abort()}catch(_){}});`,file);
  const replacement=String.raw` const rc1576Started=Date.now();
 const res=await resilientFetch(url,opts);
 let txt;
 if(/[?&]mode=read(?:&|$)/i.test(String(url||''))){
  const rc1576Budget=Math.max(3000,Number(opts.timeoutMs)||25000);
  const rc1576Remaining=Math.max(1,rc1576Budget-(Date.now()-rc1576Started));
  let rc1576Timer=null;
  try{
   txt=await Promise.race([res.text(),new Promise(function(_resolve,reject){
    rc1576Timer=native.setTimeout(function(){
     var e=new Error('Zeitüberschreitung beim Lesen der Azure-Teamdaten ('+apiEndpointLabel(url)+').');
     e.code='API_TIMEOUT';reject(e);
     try{var abort=rc1576ResponseAbort&&rc1576ResponseAbort.get(res);if(abort)abort()}catch(_){}
    },rc1576Remaining)
   })])
  }finally{if(rc1576Timer!==null)native.clearTimeout(rc1576Timer);if(rc1576ResponseAbort)rc1576ResponseAbort.delete(res)}
 }else txt=await res.text();
 let data={};`;
  html=once(html,READ_HOOK,replacement,file);
  if(!html.includes("rc1576Remaining")||!html.includes("e.code='API_TIMEOUT'"))throw new Error(file+': RC1576 read deadline missing');
  return html;
}
