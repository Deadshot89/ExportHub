(function(){
'use strict';
if(window.__EXPORTHUB_RC1000_DIAGNOSTICS_GUARD__)return;
window.__EXPORTHUB_RC1000_DIAGNOSTICS_GUARD__=true;
var baseFetch=window.fetch.bind(window),inflight=new Map(),negative=new Map(),metaCache=null;
function keyOf(input,init){var url=typeof input==='string'?input:(input&&input.url)||'',method=String(init&&init.method||input&&input.method||'GET').toUpperCase(),body=typeof(init&&init.body)==='string'?init.body:'';return method+' '+url+' '+body}
function cloneResponse(r){return r&&typeof r.clone==='function'?r.clone():r}
window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||'',method=String(init&&init.method||input&&input.method||'GET').toUpperCase();
  if(/\/api\/pickup-status(?:\?|$)/.test(url)){
    var m=String(url).match(/[?&]token=([^&]+)/),token='';
    try{token=m?decodeURIComponent(m[1]):''}catch(_){token=m?m[1]:''}
    if(!/^[a-f0-9]{48}$/i.test(token))return Promise.resolve(new Response(JSON.stringify({ok:false,code:'ACCESS_INVALID',message:'Dieser öffentliche Link ist ungültig.'}),{status:410,headers:{'Content-Type':'application/json'}}));
    var n=negative.get(token);
    if(n&&n>Date.now())return Promise.resolve(new Response(JSON.stringify({ok:false,code:'ACCESS_NOT_FOUND',message:'Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.'}),{status:410,headers:{'Content-Type':'application/json'}}));
    var k='pickup:'+token;
    if(inflight.has(k))return inflight.get(k).then(cloneResponse);
    var p=baseFetch(input,init).then(function(r){if(r.status===410)negative.set(token,Date.now()+60000);return r}).finally(function(){inflight.delete(k)});
    inflight.set(k,p);return p.then(cloneResponse)
  }
  if(/\/api\/exporthub-state\?mode=meta(?:&|$)/.test(url)){
    var mk='meta';
    if(metaCache&&metaCache.until>Date.now())return Promise.resolve(metaCache.response.clone());
    if(inflight.has(mk))return inflight.get(mk).then(cloneResponse);
    var mp=baseFetch(input,init).then(function(r){if(r.ok)metaCache={until:Date.now()+2000,response:r.clone()};return r}).finally(function(){inflight.delete(mk)});
    inflight.set(mk,mp);return mp.then(cloneResponse)
  }
  if(method==='POST'&&/\/api\/exporthub-state\?mode=save(?:&|$)/.test(url)){
    var sk=keyOf(input,init);
    if(inflight.has(sk))return inflight.get(sk).then(cloneResponse);
    var sp=baseFetch(input,init).finally(function(){setTimeout(function(){inflight.delete(sk)},500)});
    inflight.set(sk,sp);return sp.then(cloneResponse)
  }
  return baseFetch(input,init)
};
window.ExportHUBRC1000DiagnosticsGuard=Object.freeze({version:'RC1000',pickupNegativeCacheMs:60000,metaCacheMs:2000,exactSaveDedupe:true});
})();
