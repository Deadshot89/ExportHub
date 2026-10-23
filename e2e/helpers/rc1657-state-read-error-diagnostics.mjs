// RC1657: Capture ONLY the non-sensitive API error code for TESTSERVICE
// state-read 5xx failures. Never store response messages, cookies or payloads.
export function safeStateReadErrorCode(payload) {
  const code = payload && !Array.isArray(payload) && typeof payload === 'object' &&
    typeof payload.code === 'string' ? payload.code : '';
  return /^[A-Z][A-Z0-9_]{1,63}$/.test(code) ? code : 'UNAVAILABLE';
}

export async function stateReadErrorCodeFromResponse(response) {
  if (!response || typeof response.url !== 'function' || typeof response.json !== 'function')
    return null;
  let address;
  try { address = new URL(response.url()); }
  catch { return null; }
  if (address.pathname !== '/api/exporthub-state' || address.searchParams.get('mode') !== 'read')
    return null;
  try { return safeStateReadErrorCode(await response.json()); }
  catch { return 'UNAVAILABLE'; }
}
