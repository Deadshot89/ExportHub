// RC1598: non-mutating POD route presence/auth smoke. Do not log response bodies or tokens.
import {pathToFileURL} from 'node:url';

const BASE=Object.freeze({
  testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
  production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'
});

export function verifyEvidence({postStatus,postBody,optionsStatus,optionsAllow,unknownOptionsStatus}){
  // AUTH_REQUIRED is the strongest direct handler proof. Some Azure gateway
  // layers emit a different 401 body: require a handler-specific OPTIONS
  // signature AND a non-existent-route control in that case.
  const authenticatedRejection=postStatus===401&&postBody&&postBody.ok===false&&postBody.code==='AUTH_REQUIRED';
  const handlerSignature=optionsStatus===204&&/\bPOST\b/i.test(optionsAllow||'')&&/\bOPTIONS\b/i.test(optionsAllow||'')&&unknownOptionsStatus===404;
  return {
    ok:postStatus===401&&(authenticatedRejection||handlerSignature),
    authenticatedRejection:Boolean(authenticatedRejection),
    handlerSignature:Boolean(handlerSignature)
  };
}

async function probe(url,options){
  const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(20000),...options});
  const contentType=response.headers.get('content-type')||'';
  const allow=response.headers.get('allow')||'';
  let parsed=null;
  if(options.method==='POST'){
    const raw=await response.text();
    try{parsed=JSON.parse(raw)}catch(_){}
  }else await response.arrayBuffer();
  return {status:response.status,contentType,allow,data:parsed};
}

export async function run(environment){
  const base=BASE[environment];
  if(!base)throw new Error('Environment must be testservice or production');
  const expected=base+'/api/pod-quality-audit';
  const unexpected=base+'/api/rc1598-pod-quality-audit-unbound-control';
  const query='?rc1598='+encodeURIComponent(process.env.GITHUB_SHA||process.env.RELEASE_SHA||'probe');
  const [post,options,unknown]=await Promise.all([
    probe(expected+query,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"report"}'}),
    probe(expected+query,{method:'OPTIONS'}),
    probe(unexpected+query,{method:'OPTIONS'})
  ]);
  const evidence=verifyEvidence({
    postStatus:post.status,postBody:post.data,
    optionsStatus:options.status,optionsAllow:options.allow,unknownOptionsStatus:unknown.status
  });
  console.log('RC1598 POD route evidence',JSON.stringify({
    environment,postStatus:post.status,postContentType:post.contentType,
    postCode:typeof post.data?.code==='string'?post.data.code.slice(0,80):null,
    postVersion:typeof post.data?.version==='string'?post.data.version.slice(0,80):null,
    optionsStatus:options.status,optionsAllow:options.allow.slice(0,80),
    unboundOptionsStatus:unknown.status,
    authenticatedRejection:evidence.authenticatedRejection,
    handlerSignature:evidence.handlerSignature
  }));
  if(!evidence.ok)throw new Error('POD_AUDIT_ROUTE_MISSING/POD_AUDIT_ROUTE_FAILURE: backend route/auth evidence insufficient');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run(process.argv[2]).catch(error=>{console.error('RC1598 route gate failed:',error.message);process.exitCode=1});
}
