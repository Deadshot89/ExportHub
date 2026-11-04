'use strict';

// Only potentially temporary Azure/network failures may be retried.
// Concurrency (409/412), authentication (401/403), and validation stay fail-closed.
const TEMPORARY_HTTP_STATUSES=new Set([408,429,500,502,503,504]);
const TEMPORARY_NETWORK_CODES=new Set([
  'ECONNRESET','ECONNREFUSED','ETIMEDOUT','ESOCKETTIMEDOUT',
  'EAI_AGAIN','EHOSTUNREACH','ENETUNREACH','REQUEST_SEND_ERROR',
  // Node fetch/Undici reports transient connection and response timeouts
  // on error.cause.code, frequently wrapped in TypeError('fetch failed').
  // A possibly committed PUT must only be retried by saveMerged after a
  // fresh authoritative Azure readback and operationId/ETag check.
  'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET','EPIPE'
]);

function isTransientStorageWriteError(err) {
  if(!err||typeof err!=='object')return false;
  const status=Number(err.statusCode||err.status||err.response&&err.response.status||0);
  if(status===401||status===403||status===409||status===412)return false;
  if(TEMPORARY_HTTP_STATUSES.has(status))return true;
  if(status!==0)return false;
  const code=String(err.code||err.cause&&err.cause.code||'').trim().toUpperCase();
  return TEMPORARY_NETWORK_CODES.has(code)||
    /socket hang up|connection reset|timed out|temporary network error/i.test(String(err.message||''));
}

module.exports={isTransientStorageWriteError};
