'use strict';

// RC1950: Never equate a second container with a second storage account.
// Classify credentials without returning account names, endpoints or keys.
function identity(value) {
  const fields = new Map();
  for (const part of String(value || '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) fields.set(part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim());
  }
  const named = String(fields.get('accountname') || '').toLowerCase();
  const endpoint = String(fields.get('blobendpoint') || '');
  const match = /^https:\/\/([a-z0-9-]+)\.blob\.(?:core\.windows\.net|core\.usgovcloudapi\.net|core\.chinacloudapi\.cn)(?:\/|$)/i.exec(endpoint);
  const fromEndpoint = match ? match[1].toLowerCase() : '';
  // A custom BlobEndpoint cannot prove which storage account it addresses.
  // Never claim independence from an AccountName paired with an unknown proxy.
  if (endpoint && !fromEndpoint) return '';
  // A credential with contradictory account identifiers must not prove separation.
  if (named && fromEndpoint && named !== fromEndpoint) return '';
  return named || fromEndpoint;
}
function classifyPodArchiveStorage(primary, override) {
  const source = String(primary || '').trim();
  const secondary = String(override || '').trim();
  if (!source) return 'unconfigured';
  if (!secondary || secondary === source) return 'same-account';
  const a = identity(source), b = identity(secondary);
  if (!a || !b) return 'unverified';
  return a === b ? 'same-account' : 'separate-account';
}
module.exports = { classifyPodArchiveStorage };
