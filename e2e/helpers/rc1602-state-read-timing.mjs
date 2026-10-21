/**
 * RC1602: Time the authenticated TESTSERVICE State-Read body and JSON parsing.
 *
 * Returns application data internally but exposes only redacted numeric metrics.
 * Do not print the payload, raw JSON, URLs, session tokens or exception messages.
 * Called by the existing TESTSERVICE-only E2E readiness gate.
 */
export async function readTimedStateResponse(response, {now=()=>performance.now()}={}) {
  if (!response || typeof response!=='object') throw new TypeError('Invalid HTTP response');
  const beforeBody=now();
  if (typeof response.text==='function') {
    const raw=await response.text();
    const bodyMs=Math.max(0,Math.round(now()-beforeBody));
    const bytes=Buffer.byteLength(String(raw??''),'utf8');
    const beforeParse=now();
    const payload=JSON.parse(raw);
    const parseMs=Math.max(0,Math.round(now()-beforeParse));
    return {payload,measurements:{bodyMs,parseMs,bodyBytes:bytes}};
  }
  // Minimal fake response for Node-only test fixtures; real fetch() has text().
  if (typeof response.json==='function') {
    const payload=await response.json();
    const bodyMs=Math.max(0,Math.round(now()-beforeBody));
    return {payload,measurements:{bodyMs,parseMs:null,bodyBytes:null}};
  }
  throw new TypeError('HTTP response body reader missing');
}

export function publicStateReadTimings({
  status,headerMs,measurements={},serverMs,authMs,teamMs
}={}) {
  const nonnegative=(value)=>Number.isFinite(value)&&value>=0?Math.round(value):null;
  return {
    status: Number.isInteger(status)&&status>=100&&status<=599?status:0,
    headerMs:nonnegative(headerMs),
    bodyMs:nonnegative(measurements.bodyMs),
    parseMs:nonnegative(measurements.parseMs),
    bodyBytes:nonnegative(measurements.bodyBytes),
    serverMs:nonnegative(serverMs),
    authMs:nonnegative(authMs),
    teamMs:nonnegative(teamMs)
  };
}
