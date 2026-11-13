(function(root){
'use strict';
// SOP2 Phase 1: isolated API adapter. No automatic requests, writes or legacy SOP changes.
if (root.Sop2Client) return;
var ENDPOINT='/api/sop-documents';

function token() {
  try {
    var storage=root.sessionStorage;
    var session=JSON.parse(storage&&storage.getItem('exporthub_rc301_tab_session')||'{}');
    if (session&&typeof session.token==='string'&&session.token) return session.token;
  } catch (_) {}
  try {
    var runtime=root.ExportHUBClean&&root.ExportHUBClean.runtime;
    if (runtime&&typeof runtime.authToken==='string') return runtime.authToken;
  } catch (_) {}
  return '';
}
function apiError(code,status,errors) {
  var err=new Error(code);
  err.code=code;
  err.status=status||0;
  if (Array.isArray(errors)) err.errors=errors;
  return err;
}
async function act(action,payload) {
  if (typeof action!=='string'||!action||!(/^[a-z]+(?:-[a-z]+)*$/).test(action)) {
    throw apiError('INVALID_ACTION',400);
  }
  if (payload!==undefined&&(!payload||typeof payload!=='object'||Array.isArray(payload))) {
    throw apiError('INVALID_PAYLOAD',400);
  }
  var body=Object.assign({},payload||{},{action:action});
  var headers={'Content-Type':'application/json','Accept':'application/json'};
  var currentToken=token();
  if (currentToken) {
    headers['X-ExportHUB-Token']=currentToken;
    headers.Authorization='Bearer '+currentToken;
  }
  if (typeof root.fetch!=='function') throw apiError('NETWORK_UNAVAILABLE',0);
  var response;
  try {
    response=await root.fetch(ENDPOINT,{
      method:'POST',headers:headers,body:JSON.stringify(body),
      credentials:'same-origin',cache:'no-store',redirect:'manual',referrerPolicy:'no-referrer'
    });
  } catch (_) { throw apiError('NETWORK_UNAVAILABLE',0); }
  if (!response||response.redirected||response.type==='opaqueredirect') throw apiError('UNEXPECTED_REDIRECT',0);
  var mime=response.headers&&typeof response.headers.get==='function'
    ? String(response.headers.get('content-type')||'').toLowerCase():'';
  if (!mime.includes('application/json')) throw apiError('INVALID_API_RESPONSE',response.status);
  var data;
  try {data=await response.json();} catch (_) {throw apiError('INVALID_API_RESPONSE',response.status);}
  if (!data||typeof data!=='object'||Array.isArray(data)) throw apiError('INVALID_API_RESPONSE',response.status);
  if (!response.ok||data.ok!==true) {
    throw apiError(typeof data.code==='string'?data.code:'API_REQUEST_FAILED',response.status,data.errors);
  }
  return data;
}
async function list() {
  var result=await act('list');
  if (!Array.isArray(result.items)) throw apiError('INVALID_API_RESPONSE',200);
  return result.items;
}
async function get(id) {
  if (typeof id!=='string'||!/^SOP-EH-\d{3}$/.test(id)) throw apiError('INVALID_SOP_ID',400);
  var result=await act('get',{id:id});
  if (!result.item||typeof result.item!=='object') throw apiError('INVALID_API_RESPONSE',200);
  return result.item;
}
root.Sop2Client=Object.freeze({list:list,get:get,act:act});
})(typeof window!=='undefined'?window:globalThis);
