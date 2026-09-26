(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1289_AUTH_TRANSPORT_FALLBACK__)return;
var original=typeof w.fetch==='function'?w.fetch.bind(w):null;
if(!original||typeof w.XMLHttpRequest!=='function')return;

var stats={version:'RC1289',fallbacks:0,lastAt:'',lastEndpoint:''};

function q(v){return String(v==null?'':v).trim()}
function endpoint(input){
  var raw='';
  try{raw=typeof input==='string'?input:input&&input.url||String(input||'')}catch(_){return''}
  try{
    var u=new URL(raw,w.location&&w.location.href||undefined);
    if(w.location&&u.origin!==w.location.origin)return'';
    return u.pathname
  }catch(_){return''}
}
function eligible(input){
  var p=endpoint(input);
  return p==='/api/exporthub-auth'||p==='/api/exporthub-auth-probe'
}
function networkFailure(error){
  if(!error)return false;
  if(q(error.name)==='AbortError')return false;
  var m=q(error.message||error);
  return q(error.name)==='TypeError'||/failed to fetch|network(?:error| request failed)|load failed/i.test(m)
}
function abortError(){
  var e=new Error('The operation was aborted.');
  e.name='AbortError';
  return e
}
function headersFrom(raw){
  var map={};
  String(raw||'').split(/\r?\n/).forEach(function(line){
    var i=line.indexOf(':');if(i<=0)return;
    var k=line.slice(0,i).trim().toLowerCase(),v=line.slice(i+1).trim();
    if(!k)return;map[k]=map[k]?map[k]+', '+v:v
  });
  return {
    get:function(name){return map[String(name||'').toLowerCase()]||null},
    has:function(name){return Object.prototype.hasOwnProperty.call(map,String(name||'').toLowerCase())},
    forEach:function(fn){Object.keys(map).forEach(function(k){fn(map[k],k)})}
  }
}
function responseLike(xhr,url){
  var body=String(xhr.responseText==null?'':xhr.responseText),status=Number(xhr.status||0),headers=headersFrom(xhr.getAllResponseHeaders&&xhr.getAllResponseHeaders());
  return {
    ok:status>=200&&status<300,
    status:status,
    statusText:q(xhr.statusText),
    url:url,
    redirected:false,
    type:'basic',
    headers:headers,
    text:function(){return Promise.resolve(body)},
    json:function(){return Promise.resolve(body?JSON.parse(body):{})},
    clone:function(){return responseLike({responseText:body,status:status,statusText:xhr.statusText,getAllResponseHeaders:function(){return xhr.getAllResponseHeaders&&xhr.getAllResponseHeaders()||''}},url)}
  }
}
function setHeaders(xhr,headers){
  if(!headers)return;
  if(typeof headers.forEach==='function'){headers.forEach(function(v,k){xhr.setRequestHeader(k,v)});return}
  if(Array.isArray(headers)){headers.forEach(function(row){if(row&&row.length>=2)xhr.setRequestHeader(row[0],row[1])});return}
  Object.keys(headers).forEach(function(k){xhr.setRequestHeader(k,headers[k])})
}
function xhrFetch(input,init){
  init=init||{};
  return new Promise(function(resolve,reject){
    var raw=typeof input==='string'?input:input&&input.url||String(input||''),url;
    try{url=new URL(raw,w.location&&w.location.href||undefined).href}catch(error){reject(error);return}
    var xhr=new w.XMLHttpRequest(),done=false,signal=init.signal;
    function finish(fn,value){if(done)return;done=true;try{if(signal&&signal.removeEventListener)signal.removeEventListener('abort',onAbort)}catch(_){}fn(value)}
    function onAbort(){try{xhr.abort()}catch(_){}finish(reject,abortError())}
    try{
      xhr.open(q(init.method||input&&input.method||'GET')||'GET',url,true);
      xhr.withCredentials=true;
      setHeaders(xhr,init.headers||input&&input.headers);
      xhr.onload=function(){finish(resolve,responseLike(xhr,url))};
      xhr.onerror=function(){finish(reject,new TypeError('Network request failed'))};
      xhr.ontimeout=function(){finish(reject,new TypeError('Network request timed out'))};
      xhr.onabort=function(){finish(reject,abortError())};
      if(signal){
        if(signal.aborted){onAbort();return}
        if(signal.addEventListener)signal.addEventListener('abort',onAbort,{once:true})
      }
      xhr.send(init.body===undefined?null:init.body)
    }catch(error){finish(reject,error)}
  })
}

w.fetch=function(input,init){
  return original(input,init).catch(function(error){
    if(!eligible(input)||!networkFailure(error))throw error;
    stats.fallbacks+=1;stats.lastAt=new Date().toISOString();stats.lastEndpoint=endpoint(input);
    return xhrFetch(input,init)
  })
};
w.__EXPORTHUB_RC1289_AUTH_TRANSPORT_FALLBACK__=stats;
})(window);
