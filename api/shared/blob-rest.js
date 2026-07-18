// ExportHUB RC539 – integrierter Azure-Blob-REST-Adapter ohne externe npm-Abhängigkeit.
'use strict';
const https = require('https');
const crypto = require('crypto');
const { Readable } = require('stream');

const API_VERSION = '2023-11-03';

function parseConnectionString(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    const error = new Error('Azure-Speicher ist nicht konfiguriert. App-Einstellung EXPORTHUB_STORAGE_CONNECTION_STRING fehlt.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }
  if (/^UseDevelopmentStorage=true$/i.test(raw)) {
    const error = new Error('UseDevelopmentStorage=true ist nur lokal gültig. In Azure muss EXPORTHUB_STORAGE_CONNECTION_STRING eine echte Storage-Verbindungszeichenfolge enthalten.');
    error.code = 'INVALID_STORAGE_CONFIGURATION';
    error.statusCode = 503;
    throw error;
  }
  const map = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) map[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  const accountName = map.AccountName;
  const accountKey = map.AccountKey;
  const protocol = map.DefaultEndpointsProtocol || 'https';
  const suffix = map.EndpointSuffix || 'core.windows.net';
  const blobEndpoint = map.BlobEndpoint || `${protocol}://${accountName}.blob.${suffix}`;
  if (!accountName || !accountKey || !blobEndpoint) {
    const error = new Error('Die Azure-Storage-Verbindungszeichenfolge ist unvollständig. AccountName und AccountKey werden benötigt.');
    error.code = 'INVALID_STORAGE_CONFIGURATION';
    error.statusCode = 503;
    throw error;
  }
  return { accountName, accountKey, blobEndpoint: blobEndpoint.replace(/\/$/, '') };
}

function encodePath(value) {
  return String(value || '').split('/').map(encodeURIComponent).join('/');
}
function headerValue(headers, name) {
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : '';
}
function canonicalHeaders(headers) {
  return Object.keys(headers || {})
    .filter((k) => k.toLowerCase().startsWith('x-ms-'))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((k) => `${k.toLowerCase()}:${String(headers[k]).trim().replace(/\s+/g, ' ')}`)
    .join('\n') + '\n';
}
function canonicalResource(accountName, container, blobName, query) {
  let resource = `/${accountName}/${container}`;
  if (blobName) resource += `/${blobName}`;
  const keys = Object.keys(query || {}).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  for (const key of keys) {
    const values = Array.isArray(query[key]) ? query[key] : [query[key]];
    resource += `\n${key.toLowerCase()}:${values.map((v) => decodeURIComponent(String(v))).sort().join(',')}`;
  }
  return resource;
}
function authorization(config, method, container, blobName, query, headers) {
  const length = headerValue(headers, 'Content-Length');
  const contentLength = length === '0' ? '' : length;
  const stringToSign = [
    method.toUpperCase(),
    headerValue(headers, 'Content-Encoding'),
    headerValue(headers, 'Content-Language'),
    contentLength,
    headerValue(headers, 'Content-MD5'),
    headerValue(headers, 'Content-Type'),
    '',
    headerValue(headers, 'If-Modified-Since'),
    headerValue(headers, 'If-Match'),
    headerValue(headers, 'If-None-Match'),
    headerValue(headers, 'If-Unmodified-Since'),
    headerValue(headers, 'Range'),
    canonicalHeaders(headers) + canonicalResource(config.accountName, container, blobName, query)
  ].join('\n');
  const signature = crypto.createHmac('sha256', Buffer.from(config.accountKey, 'base64')).update(stringToSign, 'utf8').digest('base64');
  return `SharedKey ${config.accountName}:${signature}`;
}
function storageError(statusCode, body, headers) {
  let code = headerValue(headers, 'x-ms-error-code') || 'STORAGE_ERROR';
  let message = `Azure Storage antwortete mit HTTP ${statusCode}.`;
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
  const match = text.match(/<Message>([\s\S]*?)<\/Message>/i);
  if (match) message = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.responseBody = text.slice(0, 1000);
  return error;
}
function request(config, method, container, blobName, query = {}, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const rawBody = body == null ? null : (Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
    const base = new URL(config.blobEndpoint);
    const path = `/${encodeURIComponent(container)}${blobName ? `/${encodePath(blobName)}` : ''}`;
    const search = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      (Array.isArray(v) ? v : [v]).forEach((x) => search.append(k, String(x)));
    });
    const requestHeaders = Object.assign({}, headers, {
      'x-ms-date': new Date().toUTCString(),
      'x-ms-version': API_VERSION
    });
    if (rawBody) requestHeaders['Content-Length'] = String(rawBody.length);
    requestHeaders.Authorization = authorization(config, method, container, blobName, query, requestHeaders);
    const req = https.request({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || 443,
      method,
      path: path + (search.toString() ? `?${search}` : ''),
      headers: requestHeaders,
      timeout: 20000
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data });
        } else reject(storageError(res.statusCode, data, res.headers));
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('Zeitüberschreitung beim Azure-Speicher.'), { code: 'STORAGE_TIMEOUT', statusCode: 504 })));
    req.on('error', reject);
    if (rawBody) req.write(rawBody);
    req.end();
  });
}
function metadataHeaders(metadata) {
  const headers = {};
  Object.entries(metadata || {}).forEach(([key, value]) => {
    const safe = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (safe) headers[`x-ms-meta-${safe}`] = String(value == null ? '' : value);
  });
  return headers;
}
function extractMetadata(headers) {
  const out = {};
  Object.entries(headers || {}).forEach(([key, value]) => {
    if (key.toLowerCase().startsWith('x-ms-meta-')) out[key.slice(10).toLowerCase()] = String(value);
  });
  return out;
}

function createBlobServiceClient(connectionString) {
  const config = parseConnectionString(connectionString);
  return {
    getContainerClient(containerName) {
      const container = String(containerName);
      return {
        async createIfNotExists() {
          try { await request(config, 'PUT', container, '', { restype: 'container' }); return { succeeded: true }; }
          catch (error) {
            if (error.statusCode === 409 && /ContainerAlreadyExists/i.test(error.code || '')) return { succeeded: false };
            throw error;
          }
        },
        getBlockBlobClient(blobName) {
          const blob = String(blobName);
          return {
            async download(offset = 0) {
              const headers = offset > 0 ? { Range: `bytes=${offset}-` } : {};
              const result = await request(config, 'GET', container, blob, {}, headers);
              return {
                readableStreamBody: Readable.from(result.body),
                etag: result.headers.etag || null,
                contentType: result.headers['content-type'] || '',
                metadata: extractMetadata(result.headers),
                lastModified: result.headers['last-modified'] ? new Date(result.headers['last-modified']) : null
              };
            },
            async upload(value, length, options = {}) {
              const raw = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
              const headers = Object.assign({
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': options.blobHTTPHeaders && options.blobHTTPHeaders.blobContentType || 'application/octet-stream'
              }, metadataHeaders(options.metadata));
              if (options.conditions && options.conditions.ifMatch) headers['If-Match'] = options.conditions.ifMatch;
              if (options.conditions && options.conditions.ifNoneMatch) headers['If-None-Match'] = options.conditions.ifNoneMatch;
              const result = await request(config, 'PUT', container, blob, {}, headers, raw);
              return { etag: result.headers.etag || null };
            },
            async uploadData(value, options = {}) {
              const raw = Buffer.isBuffer(value) ? value : Buffer.from(value);
              return this.upload(raw, raw.length, options);
            },
            async getProperties() {
              const result = await request(config, 'HEAD', container, blob);
              return {
                etag: result.headers.etag || null,
                metadata: extractMetadata(result.headers),
                lastModified: result.headers['last-modified'] ? new Date(result.headers['last-modified']) : null,
                contentType: result.headers['content-type'] || ''
              };
            },
            async setMetadata(metadata) {
              const result = await request(config, 'PUT', container, blob, { comp: 'metadata' }, metadataHeaders(metadata));
              return { etag: result.headers.etag || null };
            }
          };
        }
      };
    }
  };
}

module.exports = { createBlobServiceClient, parseConnectionString, canonicalHeaders, canonicalResource, authorization };
