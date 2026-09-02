'use strict';

const handler = require('./index');
const API_VERSION = 'RC931';

function addServerVersion(response) {
  if (!response || Number(response.status || 200) >= 400) return response;

  if (response.body && typeof response.body === 'object' && !Array.isArray(response.body)) {
    if (!response.body.serverVersion) response.body.serverVersion = API_VERSION;
    return response;
  }

  if (typeof response.body !== 'string' || !response.body.trim()) return response;

  try {
    const parsed = JSON.parse(response.body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (!parsed.serverVersion) parsed.serverVersion = API_VERSION;
      response.body = JSON.stringify(parsed);
    }
  } catch (_) {
    // Nicht-JSON-Antworten unverändert lassen.
  }

  return response;
}

module.exports = async function exportHubStateVersioned(context, req) {
  await handler(context, req);
  context.res = addServerVersion(context.res);
};

module.exports.addServerVersion = addServerVersion;
module.exports.API_VERSION = API_VERSION;
