'use strict';

function json(status, body) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

module.exports = async function(context, req) {
  if (req.method === 'OPTIONS') {
    context.res = {status: 204, headers: {'Cache-Control':'no-store','Allow':'GET, OPTIONS'}, body: ''};
    return;
  }
  if (req.method !== 'GET') {
    context.res = json(405, {ok:false, code:'METHOD_NOT_ALLOWED'});
    return;
  }
  context.res = json(200, {
    ok: true,
    service: 'exporthub-health',
    version: 'RC654',
    runtime: process.version,
    time: new Date().toISOString()
  });
};
